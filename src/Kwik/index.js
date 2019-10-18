'use strict'

const got = require('got')
const querystring = require('querystring')
const _ = require('lodash')

/* PAYMENT_METHODS: (32=paystack|8=cash|2=stripe|131072=paga_wallet) */
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
  /*
      {
  
          "deliveries": [
            {
              "address": "Sector 19, Chandigarh, India",
              "name": "",
              "latitude": 30.72936309999999,
              "longitude": 76.79197279999994,
              "time": "2019-09-03 12:48:24",
              "phone": "+919646297487",
              "has_return_task": false,
              "is_package_insured": 0
            }
          ],

          "pickups": [
            {
              "address": "CDCL, Madhya Marg, 28B, Sector 28B, Chandigarh, India",
              "name": "Jovani Predovic",
              "latitude": 30.7188978,
              "longitude": 76.81029809999995,
              "time": "2019-09-03 12:48:24",
              "phone": "+917837905578",
              "email": "lead@yopmail.com"
            }
          ]
          
      }
  */
  calculatePricing: {
    path: '/send_payment_for_task',
    method: 'POST',
    params: { vendor_id$: Number, custom_field_template: String, pickup_custom_field_template: String, form_id: Number, access_token: String, is_multiple_tasks: Number, domain_name: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, user_id: Number, layout_type: Number, deliveries: Array, form_id:Number, payment_method: Number, pickups: Array,  },
    param_defaults: { custom_field_template: "pricing-template", pickup_custom_field_template: "pricing-template", form_id: 2, payment_method: 131072 /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0, user_id:  },
    route_params: null
  },
  getAllDeliveryRequests: {
    
  },
  scheduleDeliveryRequest: {
    path: '/create_task_via_vendor',
    method: 'POST',
    send_json: true,
    params: { pickup_delivery_relationship: Number, total_no_of_tasks: Number, amount: String, insurance_amount: Number, vendor_id$: Number, access_token$: String, is_multiple_tasks: Number, domain_name: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, team_id: Number, layout_type: Number },
    param_defaults: { insurance_amount: 0, total_no_of_tasks: 1, pickup_delivery_relationship: 0, payment_method: 131072 /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0, team_id: "" },
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
