'use strict'

const got = require('got')
const querystring = require('querystring')
const _ = require('lodash')

const apiEndpoints = {
  adminLogin: {
    path: '/vendor_login',
    method: 'POST',
    send_json: true,
    params: { domain_name$: String, email: String, password: String, api_login: Number },
    param_defaults: { api_login: 1 },
    route_params: null
  },
  fetchAllMerchantCards: {
    path: '/fetch_merchant_cards',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, domain_name$: String, payment_method: String, origin_booking: Number },
    param_defaults: { payment_method: '32' /* card payment */, origin_booking: 1 },
    route_params: null
  },
  addMerchantCard: {
    path: '/add_cards_view',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, domain_name$: String, client_email: String },
    route_params: null
  },
  deleteMerchantCard: {
    path: '/delet_merchant_card',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, card_id$: String, payment_method: String, domain_name$: String },
    param_defaults: { payment_method: '32' },
    route_params: null
  },
  createCorporate: {
    path: '/customer/add',
    method: 'POST',
    send_json: true,
    params: { address: String, domain: String, email: String, first_name: String, last_name: String, name: String, latitude: String, longitude: String, password: String, user_type: Number, form_ids: Number, customer_type: Number, company_rc_number: String, phone: String, sla_id: Number },
    param_defaults: { user_type: 1 },
    route_params: null
  },
  listAllCorporates: {
    path: '/list_all_corporates',
    method: 'GET',
    send_json: false,
    params: { access_token$: String },
    route_params: null
  },
  listAllCorporatesInvoices: {
    path: '/list_all_payment_invoice',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, corporate_id$: Number },
    route_params: null
  },
  getEstimatedPriceForDeliveryTask: {
    path: '/get_bill_breakdown',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, benefit_type: Number, amount: String, insurance_amount: Number, domain_name$: String, total_no_of_tasks: Number, form_id: Number, user_id$: Number, promo_value: Number, credits: Number, total_service_charge: String },
    param_defaults: { insurance_amount: 0, total_no_of_tasks: 1, form_id: 2, benefit_type: '' },
    route_params: null
  },
  cancelDeliveryTask: {
    path: '/cancel_vendor_task',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, vendor_id$: Number, job_id: String, job_status: Number, domain_name$: String },
    route_params: null,
    param_defaults: { job_status: 9 }
  },
  getExactPricingForDeliveryTask: {
    path: '/send_payment_for_task',
    method: 'POST',
    send_json: true,
    params: { vendor_id$: Number, custom_field_template: String, pickup_custom_field_template: String, form_id: Number, access_token$: String, is_multiple_tasks: Number, domain_name$: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, user_id$: Number, layout_type: Number, deliveries: Array, payment_method: String, pickups: Array },
    param_defaults: { custom_field_template: 'pricing-template', pickup_custom_field_template: 'pricing-template', form_id: 2, payment_method: '131072' /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0 },
    route_params: null
  },
  getAllDeliveryTaskDetails: {
    path: '/get_order_history_with_pagination',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, limit: String, skip: String },
    param_defaults: { limit: 10, skip: 0 },
    route_params: null
  },
  getSingleDeliveryTaskDetails: {
    path: '/view_task_by_relationship_id',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, unique_order_id: String },
    param_defaults: null,
    route_params: null
  },
  scheduleDeliveryTask: {
    path: '/create_task_via_vendor',
    method: 'POST',
    send_json: true,
    params: { pickup_delivery_relationship: Number, pickups: Array, deliveries: Array, payment_method: String, total_service_charge: Number, total_no_of_tasks: Number, fleet_id: String, amount: String, insurance_amount: Number, vendor_id$: Number, access_token$: String, is_multiple_tasks: Number, domain_name$: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, team_id: Number, layout_type: Number },
    param_defaults: { insurance_amount: 0, pickup_delivery_relationship: 0, fleet_id: '', payment_method: '131072' /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0, team_id: '' },
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

const isLiteralFalsey = (variable) => {
  return (variable === '' || variable === false || variable === 0)
}

const checkTypeName = (target, type) => {
  let typeName = ''
  if (isLiteralFalsey(target)) {
    typeName = (typeof target)
  } else {
    typeName = ('' + (target && target.constructor.name))
  }
  return !!(typeName.toLowerCase().indexOf(type) + 1)
}

const isTypeOf = (value, type) => {
  let result = false

  type = type || []

  if (typeof type === 'object') {
    if (typeof type.length !== 'number') {
      return result
    }

    let bitPiece = 0
    type = [].slice.call(type)

    type.forEach(_type => {
      if (typeof _type === 'function') {
        _type = (_type.name || _type.displayName).toLowerCase()
      }
      bitPiece |= (1 * (checkTypeName(value, _type)))
    })

    result = !!(bitPiece)
  } else {
    if (typeof type === 'function') {
      type = (type.name || type.displayName).toLowerCase()
    }

    result = checkTypeName(value, type)
  }

  return result
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
      : data)
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
    httpConfig.form = false
  } else if (config.send_form) {
    httpConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    httpConfig.form = true
  }

  return function (requestParams = {}) {
    let pathname = false
    let payload = false

    if (!isTypeOf(requestParams, 'object')) {
      throw new TypeError('invalid argument type')
    }

    if (('domain_name$' in config.params)) {
      if (!requestParams.domain_name) {
        requestParams.domain_name = this.domainName
      }
    }

    if (('access_token$' in config.params)) {
      if (!requestParams.access_token) {
        requestParams.access_token = this.accessToken
      }
    }

    if (('vendor_id$' in config.params)) {
      if (!requestParams.vendor_id) {
        requestParams.vendor_id = this.vendorId
      }
    }

    if (('user_id$' in config.params)) {
      if (!requestParams.user_id) {
        requestParams.user_id = this.userId
      }
    }

    if (('card_id$' in config.params)) {
      if (!requestParams.card_id) {
        requestParams.card_id = this.cardId
      }
    }

    if (!_.isEmpty(requestParams, true)) {
      if (config.params !== null) {
        payload = setInputValues(config, requestParams)
      }

      if (config.route_params !== null) {
        pathname = setPathName(config, requestParams)
      } else {
        pathname = config.path
      }
    } else {
      if (config.params !== null ||
             config.route_params !== null) {
        throw new Error('requestParam(s) Are Not Meant To Be Empty!')
      }
    }

    if (payload === false) {
      payload = {}
    }

    for (let type in payload) {
      if (payload.hasOwnProperty(type)) {
        httpConfig[type] = (type === 'query') ? payload[type] : JSON.parse(payload[type])
      }
    }

    let reqVerb = config.method.toLowerCase()
    let baseUrl = this.httpClientBaseOptions.baseUrl

    return this.httpBaseClient[reqVerb](`${baseUrl}${pathname}`, httpConfig)
  }
}

class KwikAPI {
  constructor (domainName = 'app.kwik.delivery', isProd = true) {
    /* eslint-disable camelcase */
    var api_base = {
      sandbox: (domainName || '').startsWith('staging-') ? 'https://staging-api-test.kwik.delivery' : 'https://api.kwik.delivery',
      live: 'https://apicopy.kwik.delivery'
    }

    this.domainName = domainName

    this.accessToken = ''
    this.vendorId = ''
    this.userId = ''

    this.httpClientBaseOptions = {
      baseUrl: (!isProd ? api_base.sandbox : api_base.live)
    }
    /* eslint-enable camelcase */
    this.httpBaseClient = got
  }

  setAccessToken (token) {
    this.accessToken = token
  }

  setVendorId (id) {
    this.vendorId = id
  }

  setUserId (id) {
    this.userId = id
  }

  setCardId (id) {
    this.cardId = id
  }
}

for (let methodName in apiEndpoints) {
  if (apiEndpoints.hasOwnProperty(methodName)) {
    KwikAPI.prototype[methodName] = makeMethod(apiEndpoints[methodName])
  }
}

module.exports = KwikAPI
