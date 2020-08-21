# kwikng 

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

A NodeJS Wrapper for [Kwik Delivery](https://kwik.delivery)

## Overview
This project provides an easy-to-use object-oriented API to access endpoints delineated at https://liveapikwik.docs.apiary.io/#reference

## Getting Started

>Install from the NPM Registry

```bash

    $ npm i --save kwik-node

```

## Format Codes

API REQUEST STATUSES:
====================

| Title               | Code | Description               |
|---------------------|------|---------------------------|
| PARAMETER_MISSING   | 100  | A parameter is missing    |
| INVALID_KEY         | 101  | Invalid access token      |
| ACTION_COMPLETE     | 200  | Successful request        |
| ERROR_IN_EXECUTION  | 404  | An Error Occured          |


TASK/JOB STATUSES:
=================

| Title     | Code | Description
|-----------|------|--------------------------------------------------------|
|UPCOMING |	0 |	The task has been assigned to a agent. |
|STARTED |	1 |	The task has been started and the agent is on the way. |
|ENDED	 |  2 |	The task has been completed successfully |
|FAILED	 |  3 |	The task has been completed unsuccessfully |
|ARRIVED |	4 |	The task is being performed;agent has reached the destination.|
|UNASSIGNED| 6 |	The task has not been assigned to any agent. |
|ACCEPTED |	7 |	The task has been accepted by the agent which is assigned to him.|
|DECLINE |	8 |	The task has been declined by the agent which is assigned to him.|
|CANCEL	 |  9 |	The task has been cancelled by the agent which is accepted by him.|
|DELETED |  10 |  The task is deleted by the agent |



PAYMENT METHODS:
===============

| Title    | Code | Description                                           |
|----------|------|-------------------------------------------------------|
|CARD      | 32 |    The task will be paid for using paystck card option|
|CASH      | 8  |   The task will be paid for using cash in currency of local|
|STRIPE    | 2   |   The task will be paid for using stripe card option|
|WALLET    | 131072 | The task will be paid for using a paga wallet option|


TIMEZONES:
=========

| Title                     | Code | Description                  |
|---------------------------|------|------------------------------|
|INDIAN STANDARD TIME (IST) | -330 |  offset from UTC in minutes  |
|CENTRAL AFRICAN TIME (CAT) | +180 |  offset from UTC in minutes  |
|WEST AFRICAN TIME (WAT)    | +60  |  offset from UTC in minutes  |


# Usage

>PS: total_no_of_tasks, total_service_charge -> is fetched from '/send_payment_for_task' API endpoint from JSON object key name(s): { total_service_charge, total_no_of_tasks }

```js

const Kwik = require('kwik-node')
const express = require('express')

const domainName = process.env.KWIK_DOMAIN_NAME; // 'app.kwik.delivery'
const environment = process.env.NODE_ENV; // 'production'

const kwikClient = new Kwik(
    domainName, 
    environment === 'production'
);

const app = express()
const port = 3000

// setup a middleware to laod up the api access_token via AUTH
app.use('/create/delivery', async (req, res, next) => {
  if(req.method.toLowercase() === 'post'){
    let response = {
        body:{
            status:0,
            data:{
                access_token: '',
                vendor_details:{
                    vendor_id: '',
                    card_id: '',
                    user_id: ''
                }
            }
        }
    }

    try {
        response = await kwikClient.adminLogin({ 
            email: process.env.KWIK_ACCOUNT_EMAIL,
            password: process.env.KWIK_ACCOUNT_PASSWORD
        });
    }catch(e){
        throw e;
    }


    kwikClient.setAccessToken(
        response.body.data.access_token
    );

    kwikClient.setVendorId(
        response.body.data.vendor_details.vendor_id
    );

    kwikClient.setUserId(
        response.body.data.vendor_details.user_id
    );

    kwikClient.setCardId(
        response.body.data.vendor_details.card_id
    );
  }

  next();
});



// error handler
app.use(function (err, req, res, next) {
  res.status(500).send(err.message)
});



app.post('/create/delivery', async (req, res) => {

    const deliveries = [
            {
              "address": req.body.delivery_address,
              "name": req.body.business_name,
              "latitude": req.body.choords.delivery_lat,
              "longitude": req.body.choords.delivery_lon,
              "time": "2020-06-03 12:48:24",
              "phone": req.body.mobile_number,
              "has_return_task": false,
              "is_package_insured": 0,
              "template_data": [ ]
            }
    ];

    const pickups = [
            {
              "address": req.body.pickup_address,
              "name": "My Business name",
              "latitude": req.body.choords.pickup_lat,
              "longitude": req.body.choords.pickup_lon,
              "time": "2020-06-03 11:02:30",
              "phone": "+2347045804049",
              "email": "my.business@gmail.com",
              "template_data": [ ]
            }
    ];

    /* NOTE: 
        no need to include 'domain_name', 'access_token' and 'vendor_id'
        as they are included automatically as long as the express middleware
        above obtains the details using kwikClient.adminLogin() and sets all
        the details
    */
    const payload = await kwikClient.getExactPricingForDeliveryTask({
        custom_field_template: 'pricing-template',
        auto_assignment: 1,
        layout_type: 1,
        pickup_custom_field_template: 'pricing-template',
        has_pickup: 1,
        has_delivery: 1,
        is_multiple_tasks: 1,
        payment_method: '32', /* payment via card */
        is_schedule_task: 1,
        deliveries,
        pickups
    });

    console.log(
        'CURRENCY: ', 
        JSON.stringify(payload.body.data.currency, null, '\t')
    );

    console.log(
        'COST PER TASK: ', 
        payload.body.data.per_task_cost
    );

    const cost_per_task = parseFloat(payload.body.data.per_task_cost);

    const response = await kwikClient.scheduleDeliveryTask({
        team_id: 2,
        timezone: '+60', /* west african timezone */
        auto_assignment: 1,
        layout_type: 1,
        is_multiple_tasks: 1,
        insurance_amount: payload.body.data.insurance_amount,
        total_no_of_tasks: payload.body.data.total_no_of_tasks,
        total_service_charge: payload.body.data.total_service_charge,
        payment_method: '32', /* payment via card */
        amount: String(cost_per_task * deliveries.length),
        deliveries: payload.body.data.deliveries,
        pickups: payload.body.data.pickups
    });

    res.status(response.body.status).send(response.body.message)
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));


```

## API Resources

>Each method expects an object literal with both **route parameters** and **request parameters (query / body)**. Please, go through the _src/Kwik/index.js_ `apiEndpoints` object to see the specific items that should make up the object literal for each method and their types

- **Tasks**
  - kwikClient.cancelDeliveryTask()
  - kwikClient.scheduleDeliveryTask()
- **Pricing**
  - kwikClient.getExactPricingForDeliveryTask()
  - kwikClient.getEstimatedPriceForDeliveryTask()
- **Payments**
  - kwikClient.fetchAllMerchantCards()
  - kwikClient.addMerchantCard()
  - kwikClient.deleteMerchantCard()
- **Corporates**
  - kwikClient.createCorporate()
  - kwikClient.listAllCorporates()
  - kwikClient.listAllCorporatesInvoices()
- **Task Details ( Jobs )**
  - kwikClient.getSingleDeliveryTaskDetails()
  - kwikClient.getAllDeliveryTaskDetails()

# License

MIT

# Credits

- [Ifeora Okechukwu](https://twitter.com/isocroft)

# Contributing

See the [CONTRIBUTING.md](https://github.com/stitchng/kwikng/blob/master/CONTRIBUTING.md) file for info

[npm-image]: https://img.shields.io/npm/v/kwik-node.svg?style=flat-square
[npm-url]: https://npmjs.org/package/kwik-node

[travis-image]: https://img.shields.io/travis/stitchng/kwikng/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/stitchng/kwikng

## Support 

**Coolcodes** is a non-profit software foundation (collective) created by **Oparand** - parent company of StitchNG, Synergixe based in Abuja, Nigeria. You'll find an overview of all our work and supported open source projects on our [Facebook Page](https://www.facebook.com/coolcodes/).

>Follow us on facebook if you can to get the latest open source software/freeware news and infomation.

Does your business depend on our open projects? Reach out and support us on [Patreon](https://www.patreon.com/coolcodes/). All pledges will be dedicated to allocating workforce on maintenance and new awesome stuff.
