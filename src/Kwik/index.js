'use strict'

const got = require('got')
const querystring = require('querystring')
const _ = require('lodash')

const apiEndpoints = {
  getEstimatedTaskFare: {
    path: '/get_bill_breakdown',
    method: 'POST',
    params: {},
    route_params: null
  },
  cancelDeliveryTask: {
    path: '/cancel_vendor_task',
    method: 'POST',
    params: { access_token$: String, vendor_id: Number, job_id: String, job_status: Number, domain_name: String },
    route_params: null,
    param_defaults: { job_status: 9 }
  },
  calculatePricing: {
    path: '/send_payment_for_task',
    method: 'POST',
    params: { },
    route_params: { order_id: String }
  },
  getOrderPickupWindows: {
    path: '/orders/windows',
    method: 'POST',
    params: { pickup_datetime$: Date },
    route_params: null
  },
  getDeliveryRequest: {
    path: '/{:order_id}',
    method: 'GET',
    params: null,
    route_params: { order_id: String }
  },
  getPickUpWindow: {
    path: '/pricings/estimate',
    method: 'POST',
    params: { origin$: Object, destination$: Object, service_id$: String },
    route_params: null
  },
  getAllDeliveryRequests: {
    path: '/{:app_id}/orders',
    method: 'GET',
    params: { limit: Number, offset: Number },
    param_defaults: { limit: 0, offset: 0 },
    route_params: { app_id: String }
  },
  scheduleDeliveryRequest: {
    path: '/order',
    method: 'POST',
    send_json: true,
    params: { origin$: Object, destination$: Object, sender_name$: String, sender_phone$: String, recipient_name$: String, payee: String, cod_amount: Number, is_card: Boolean, recipient_phone$: String, pickup_window$: Object, pickup_instruction: String, delivery_instruction: String, manifest: Array, is_cod: Boolean, is_wallet: Boolean, is_cash: Boolean, service_id$: String },
    param_defaults: { is_card: false, is_cod: false, is_cash: false, is_wallet: true, pickup_instruction: 'Please deliver this as soon as you can!' },
    route_params: null
  }
}

/*
 * Provides a convenience extension to _.isEmpty which allows for
 * determining an object as being empty based on either the default
 * implementation or by evaluating each property to undefined, in
 * which case the object is considered empty.
 */
_.mixin(function () {
  // reference the original implementation
  var _isEmpty = _.isEmpty
  return {
    // If defined is true, and value is an object, object is considered
    // to be empty if all properties are undefined, otherwise the default
    // implementation is invoked.
    isEmpty: function (value, defined) {
      if (defined && _.isObject(value)) {
        return !_.some(value, function (value, key) {
          return value !== undefined
        })
      }
      return _isEmpty(value)
    }
  }
}())

const isTypeOf = (_value, type) => {
  let value = Object(_value)
  return (value instanceof type)
}

const setPathName = (config, values) => {
  return config.path.replace(/\{:([\w]+)\}/g, function (
    match,
    string,
    offset) {
    let _value = values[string]
    return isTypeOf(
      _value,
      config.route_params[string]
    )
      ? _value
      : null
  })
}

const _jsonify = (data) => {
  return !data ? 'null'
    : (typeof data === 'object'
      ? (data instanceof Date ? data.toDateString() : (('toJSON' in data) ? data.toJSON().replace(/T|Z/g, ' ') : JSON.stringify(data)))
      : String(data))
}

const setInputValues = (config, inputs) => {
  let httpReqOptions = {}
  let inputValues = {}
  let label = ''

  switch (config.method) {
    case 'GET':
    case 'HEAD':
      label = 'query'
      break

    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      label = 'body'
      break
  }

  httpReqOptions[label] = {}

  if (config.param_defaults) {
    inputs = Object.assign({}, config.param_defaults, inputs)
  }

  for (var input in config.params) {
    if (config.params.hasOwnProperty(input)) {
      let param = input.replace('$', '')
      let _input = inputs[param]
      let _type = config.params[input]
      let _required = false

      if ((input.indexOf('$') + 1) === (input.length)) {
        _required = true
      }

      if (_input === void 0 || _input === '' || _input === null) {
        if (_required) { throw new Error(`param: "${param}" is required but not provided; please provide as needed`) }
      } else {
        httpReqOptions[label][param] = isTypeOf(_input, _type)
          ? (label === 'query'
            ? querystring.escape(_jsonify(_input))
            : _jsonify(_input))
          : null

        if (httpReqOptions[label][param] === null) {
          throw new Error(`param: "${param}" is not of type ${_type.name}; please provided as needed`)
        }
      }
    }
  }

  inputValues[label] = (label === 'body'
    ? (config.send_form
      ? httpReqOptions[label]
      : JSON.stringify(httpReqOptions[label])
    )
    : querystring.stringify(httpReqOptions[label]))

  return inputValues
}

const makeMethod = function (config) {
  let httpConfig = {
    headers: {
      'Cache-Control': 'no-cache',
      'Accept': 'application/json'
    },
    json: true
  }

  if (config.send_json) {
    httpConfig.headers['Content-Type'] = httpConfig.headers['Accept']
    httpConfig.form = true
  } else if (config.send_form) {
    httpConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    httpConfig.form = false
  }

  return function (requestParams = {}) {
    let pathname = false
    let payload = false

    if (config.params !== null &&
             config.params.service_id$ === String) {
      requestParams.service_id = this.api_service_id
    }

    if (!_.isEmpty(requestParams, true)) {
      if (config.params !== null) {
        pathname = config.path
        payload = setInputValues(config, requestParams)
      }

      if (config.route_params !== null) {
        pathname = setPathName(config, requestParams)
        if (payload === false) {
          payload = {}
        }
      }
    } else {
      if (config.params !== null ||
                 config.route_params !== null) {
        throw new Error('requestParam(s) Are Not Meant To Be Empty!')
      }
    }

    for (let type in payload) {
      if (payload.hasOwnProperty(type)) {
        httpConfig[type] = payload[type]
      }
    }

    let reqVerb = config.method.toLowerCase()
    let baseUrl = this.httpClientBaseOptions.baseUrl

    return this.httpBaseClient[reqVerb](`${baseUrl}${pathname}`, httpConfig)
  }
}

class KwikAPI {
  constructor (apiKey, isProd) {
    /* eslint-disable camelcase */
    var api_base = {
      sandbox: 'https://api.kwik.delivery/',
      live: 'https://api.kwik.delivery/'
    }


    this.api_service_id = !isProd ? api_service_ids['sandbox'] : api_service_ids['live'];

    this.httpClientBaseOptions = {
      baseUrl: (!isProd ? api_base.sandbox : api_base.live),
      headers: {
        'Authorization': apiKey
      }
    }
    /* eslint-enable camelcase */
    this.httpBaseClient = got
  }
}

for (let methodName in apiEndpoints) {
  if (apiEndpoints.hasOwnProperty(methodName)) {
    KwikAPI.prototype[methodName] = makeMethod(apiEndpoints[methodName])
  }
}

module.exports = KwikAPI
