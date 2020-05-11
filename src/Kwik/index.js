'use strict'

const got = require('got')
const querystring = require('querystring')
const _ = require('lodash')

/* PARAM: total_service_charge -> is fetched from '/send_payment_for_task' API endpoint from key name {total_service_charge} */
/* PARAM: */

/*  TASK STATUSES:

    UPCOMING	0	The task has been assigned to a agent.
    STARTED	1	The task has been started and the agent is on the way.
    ENDED	2	The task has been completed successfully
    FAILED	3	The task has been completed unsuccessfully
    ARRIVED	4	The task is being performed and the agent has reached the destination.
    UNASSIGNED	6	The task has not been assigned to any agent.
    ACCEPTED	7	The task has been accepted by the agent which is assigned to him.
    DECLINE	8	The task has been declined by the agent which is assigned to him.
    CANCEL	9	The task has been cancelled by the agent which is accepted by him.
    DELETED	10      The task is deleted by the agent

*/

/* PAYMENT METHODS: 
  
    PAYSTACK    32      The task will be paid for using paystck card option
    CASH        8       The task will be paid for using cash in currency of local
    STRIPE      2       The task will be paid for using stripe card option
    PAGA        131072  The task will be paid for using a paga wallet
*/

/* TIMEZONES:

   INDIAN STANDARD TIME (IST)   -330    offset from UTC in minutes
   CENTRAL AFRICAN TIME (CAT)   +180    offset from UTC in minutes
   WEST AFRICAN TIME (WAT)      +60     offset from UTC in minutes

*/

/* DELIVERY ARRAY SETUP; PICKUP ARRAY SETUP
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
    params: { access_token$: String, domain_name$: String,  payment_method: Number, origin_booking: Number },
    param_defaults: { payment_method: 32, origin_booking: 1 },
    route_params: null
  },
  addMerchantCard: {
    path: '/add_cards_view',
    method: 'GET',
    params: { access_token$: String, domain_name$: String, client_email: String },
    route_params: null
  },
  deleteMerchantCard: {
    path: '/delet_merchant_card',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, card_id: String, payment_method: Number, domain_name$: String },
    param_defaults: { payment_method: 32 },
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
  listAllCorporatesPaymentInvoices: {
    path: '/list-all_payment_invoice',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, corporate_id$: Number },
    route_params: null
  },
  getEstimatedTaskFare: {
    path: '/get_bill_breakdown',
    method: 'POST',
    send_json: true,
    params: { access_token$: String, benefit_type: Number, amount: String, insurance_amount: Number, domain_name$: String, total_no_of_tasks: Number, form_id: Number, user_id$: Number, promo_value: Number, credits: Number, total_service_charge: String },
    param_defaults: { insurance_amount: 0, total_no_of_tasks: 1, form_id: 2, benefit_type: "" },
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
  calculatePricingForDeliveryTask: {
    path: '/send_payment_for_task',
    method: 'POST',
    send_json: true,
    params: { vendor_id$: Number, custom_field_template: String, pickup_custom_field_template: String, form_id: Number, access_token$: String, is_multiple_tasks: Number, domain_name$: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, user_id$: Number, layout_type: Number, deliveries: Array, payment_method: Number, pickups: Array },
    param_defaults: { custom_field_template: "pricing-template", pickup_custom_field_template: "pricing-template", form_id: 2, payment_method: 131072 /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0 },
    route_params: null
  },
  getAllDeliveryTaskDetails: {
    path:'/get_order_history_with_pagination',
    method: 'GET',
    send_json: false,
    params: { access_token$: String, limit: String, skip: String },
    param_defaults: { limit: 10, skip: 0 },
    route_params: null
  },
  getDeliveryTaskDetails: {
    path:'/view_task_by_relationship_id',
    method:'GET',
    send_json: false,
    params: { access_token$: String, unique_order_id: String },
    param_defaults: null,
    route_params: null
  },
  scheduleDeliveryTask: {
    path: '/create_task_via_vendor',
    method: 'POST',
    send_json: true,
    params: { pickup_delivery_relationship: Number, total_no_of_tasks: Number, fleet_id: String, amount: String, insurance_amount: Number, vendor_id$: Number, access_token$: String, is_multiple_tasks: Number, domain_name$: String, timezone: String, has_pickup: Number, has_delivery: Number, auto_assignment: Number, team_id: Number, layout_type: Number },
    param_defaults: { insurance_amount: 0, total_no_of_tasks: 1, pickup_delivery_relationship: 0, fleet_id:"", payment_method: 131072 /* paga wallet payment */, is_multiple_tasks: 1, has_pickup: 1, has_delivery: 1, timezone: '+60' /* West African Time: +1:00hr from UTC */, auto_assignment: 0, layout_type: 0, team_id: "" },
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
    
    if(('domain_name' in config.params)){
        if(!requestParams.domain_name){
            requestParams.domain_name = this.domainName;
        }
    }

    if (!_.isEmpty(requestParams, true)) {
      if (config.params !== null) {
        payload = setInputValues(config, requestParams)
      }

      if (config.route_params !== null) {
        pathname = setPathName(config, requestParams)
      } else{
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
        httpConfig[type] = payload[type]
      }
    }

    let reqVerb = config.method.toLowerCase()
    let baseUrl = this.httpClientBaseOptions.baseUrl

    return this.httpBaseClient[reqVerb](`${baseUrl}${pathname}`, httpConfig)
  }
}

class KwikAPI {
  constructor (domainName, isProd) {
    /* eslint-disable camelcase */
    var api_base = {
      sandbox: 'https://api.kwik.delivery',
      live: 'https://apicopy.kwik.delivery'
    }
    
    this.domainName = domainName;
      
    this.accessToken = '';
    this.vendorId = '';
    this.userId = '';

    this.httpClientBaseOptions = {
      baseUrl: (!isProd ? api_base.sandbox : api_base.live),
      headers: {
        'X-Merchant-Locale': 'en-NG'
      }
    }
    /* eslint-enable camelcase */
    this.httpBaseClient = got
  }
    
  setAccessToken (token){
    this.accessToken = token;
  }
    
  setVendorId (id){
    this.vendorId = id;
  }
    
  setUserId (id){
    this.userId = id;
  }
}

for (let methodName in apiEndpoints) {
  if (apiEndpoints.hasOwnProperty(methodName)) {
    KwikAPI.prototype[methodName] = makeMethod(apiEndpoints[methodName])
  }
}

module.exports = KwikAPI
