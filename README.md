# kwikng 

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

A NodeJS Wrapper for [Kwik Delivery](https://kwik.delivery)

## Overview
This project provides an easy-to-use object-oriented API to access endpoints delineated at https://apikwik.docs.apiary.io/#reference OR https://liveapikwik.docs.apiary.io/#reference

## Getting Started

>Install from the NPM Registry

```bash

    $ npm i --save kwik-node

```

## API Values Format Codes ( Chart )

API REQUEST STATUSES:
====================

| Title               | Code | Description                |
|---------------------|------|----------------------------|
|PARAMETER_MISSING    | 100  |  A parameter is missing    |
|INVALID_KEY          | 101  |  Invalid access token      |
|ACTION_COMPLETE      | 200  |  Successful request        |
|ERROR_IN_EXECUTION   | 404  |  An Error Occured          |



TASK/JOB STATUSES:
=================

| Title     | Code | Description
|-----------|------|--------------------------------------------------------------------|
|UPCOMING   |  0   |  The task has been assigned to a agent                             |
|STARTED    |  1   |  The task has been started and the agent is on the way             |
|ENDED	    |  2   |  The task has been completed successfully                          |
|FAILED	    |  3   |  The task has not been completed successfully                      |
|ARRIVED    |  4   |  The task is being performed;agent has reached the destination     |
|UNASSIGNED |  6   |  The task has not been assigned to any agent                       |
|ACCEPTED   |  7   |  The task has been accepted by the agent which is assigned to him  |
|DECLINE    |  8   |  The task has been declined by the agent which is assigned to him  |
|CANCEL	    |  9   |  The task has been cancelled by the agent which is accepted by him |
|DELETED    |  10  |  The task is deleted by the agent                                  |



PAYMENT METHODS:
===============

| Title        | Code   | Description                                                |
|--------------|--------|------------------------------------------------------------|
|CARD          | 32     |  The task will be paid for using paystack card option       |
|CASH          | 8      |  The task will be paid for using cash in currency of local |
|STRIPE        | 2      |  The task will be paid for using stripe card option        |
|WALLET (PAGA) | 131072 |  The task will be paid for using a paga wallet option      |



VEHICLE SIZES:
=============

| Code | Description          |
|------|----------------------|
|  0   |  A motorcycle (bike) |
|  1   |  A small car         |
|  2   |  A medium car        |
|  3   |  A large truck       |



DELIVERY CHARGES:
================

| Code | Description                                                |
|------|------------------------------------------------------------|
|  1   |  Paid by the buyer (your own customer whom you deliver to) |
|  2   |  Paid by the kwik customer (you whom are using this API)   |



TIMEZONES:
=========

| Title                     | Code | Description                  |
|---------------------------|------|------------------------------|
|INDIAN STANDARD TIME (IST) | -330 |  offset from UTC in minutes  |
|CENTRAL AFRICAN TIME (CAT) | +180 |  offset from UTC in minutes  |
|WEST AFRICAN TIME (WAT)    | +60  |  offset from UTC in minutes  |


# Usage

```js

const Kwik = require('kwik-node')
const express = require('express')


const domainName = process.env.KWIK_DOMAIN_NAME; // 'app-test.kwik.delivery'
const environment = process.env.NODE_ENV; // 'production'

const kwikClient = new Kwik(
    domainName, 
    environment === 'production'
);

const app = express()
const port = 3000

/* setup a middleware to load up the API access_token via auth */
app.use('/create/delivery', async (req, res, next) => {
  if(req.method.toLowercase() === 'post'){
    let response = {
        body: {
            status:0,
            data: {
                access_token: '',
                vendor_details: {
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
    } catch(error) {
        throw error;
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



/* global error handler */
app.use(function (err, req, res, next) {
  res.status(500).send(err.message)
});


/* standard app endpoint to create a delivery task for dispatch by kwik dispatch riders */
app.post('/create/delivery', async (req, res) => {
    const today = new Date()
    const deliveries = [
            {
              address: req.body.delivery_address,
              name: req.body.business_name,
              latitude: req.body.choords.delivery_lat,
              longitude: req.body.choords.delivery_long,
              time: "2022-06-03 12:48:24",
              phone: req.body.mobile_number,
              email: req.body.email,
              has_return_task: false,
            }
    ];
    const pickups = [
            {
              address: req.body.pickup_address,
              name: "My Business name",
              latitude: req.body.choords.pickup_lat,
              longitude": req.body.choords.pickup_long,
              time: "2022-06-03 11:02:30",
              phone: "+2347045804049",
              email: "my.business@gmail.com"
            }
    ];

    /* NOTE: 
        no need to include 'domain_name', 'access_token' and 'vendor_id'
        as they are included automatically as long as the express middleware
        above obtains the details correctly in the middleware above using
        kwikClient.adminLogin() and sets all the details accordingly
    */

    /* HINT:
       It's vital to get Loaders and Vehicles info for your delivery task before
       that delivery task can be scheduled/created
    */

    /* Loaders info */
    const loaderDetails = await kwikClient.fetchAllLoadersOnAmount()

    /* Vehicles info */
    const vehicleDetails = await kwikClient.fetchAllAvailableDeliveryVehicles({
        size: 1 /* a small car (see API values format codes above 👆🏾) */
    });

    const deliveryTaskDetails = await kwikClient.getExactPricingForDeliveryTask({
        custom_field_template: 'pricing-template',
        auto_assignment: 1,
        layout_type: 1,
        pickup_custom_field_template: 'pricing-template',
        has_pickup: 1,
        has_delivery: 1,
        vehicle_id: vehicleDetails.body.data[0].vehicle_id,
        parcel_amount: 0,
        is_cod_job: 0, /* No collect on delivery */
        delivery_images: 'https://res.cloudinary.com/kwiky/image/upload/v1648282178/mova/item.png', /* The URL of the image of the item being delivered */
        delivery_instruction: 'Please, hand it over to the nanny', /* The instruction for the person who's to recieve the item being delivered */
        is_loader_required: loaderDetails.body.data.is_loader_enabled, /* equals 0; no loaders enabled */
        is_multiple_tasks: 1,
        payment_method: 32, /* payment via card */
        is_schedule_task: 0, /* task will not be scheduled in future */
        deliveries,
        pickups
    });

    console.log(
        'CURRENCY: ', 
        JSON.stringify(deliveryTaskDetails.body.data.currency, null, '\t')
    );

    console.log(
        'COST PER TASK (AMOUNT): ', 
        deliveryTaskDetails.body.data.per_task_cost
    );

    const cost_per_task = deliveryTaskDetails.body.data.per_task_cost

    const deliveryPaymentBreakDownDetails = await kwikClient.getEstimatedPriceForDeliveryTask({
        promo_value: 0,
        amount: String(cost_per_task),
        pickup_time: today.toISOString().replace('T', ' ').replace(/(?:\.[\d]{2,3}Z)/, ''),
        total_service_charge: deliveryTaskDetails.body.data.total_service_charge,
        vehicle_id: deliveryTaskDetails.body.data.vehicle_id,
        delivery_images: deliveryTaskDetails.body.data.delivery_images,
        delivery_instruction: deliveryTaskDetails.body.data.delivery_instruction,
        delivery_charge_by_buyer: 1, /* buyer pays for delivery charge (see API values format codes above 👆🏾) */
        is_cod_job: deliveryTaskDetails.body.data.is_cod_job,
        parcel_amount: deliveryTaskDetails.body.data.parcel_amount,
        is_loader_required: deliveryTaskDetails.body.data.is_loader_required,
    });

    const response = await kwikClient.scheduleDeliveryTask({
        team_id: 2, /* get your `team_id` from your admin dashboard */
        timezone: '+60', /* west african timezone (see API values format codes above 👆🏾) */
        auto_assignment: 1,
        layout_type: 1,
        is_multiple_tasks: 1,
        is_cod_job: deliveryTaskDetails.body.data.is_cod_job,
        delivery_charge_by_buyer: deliveryPaymentBreakDownDetails.body.data.delivery_charge_by_buyer,
        delivery_charge: deliveryPaymentBreakDownDetails.body.data.DELIVERY_CHARGE,
        collect_on_delivery: deliveryPaymentBreakDownDetails.body.data.COLLECT_ON_DELIVERY,
        surge_cost: deliveryPaymentBreakDownDetails.body.data.SURGE_PRICING,
        surge_type: deliveryPaymentBreakDownDetails.body.data.SURGE_TYPE,
        cash_handling_charges: deliveryPaymentBreakDownDetails.body.data.CASH_HANDLING_CHARGE,
        cash_handling_percentage: deliveryPaymentBreakDownDetails.body.data.CASH_HANDLING_PERCENTAGE,
        net_processed_amount: deliveryPaymentBreakDownDetails.body.data.NET_CASH_PROCEEDS,
        kwister_cash_handling_charge: deliveryPaymentBreakDownDetails.body.data.KWISTER_CASH_HANDLING_CHARGE,
        is_loader_required: deliveryTaskDetails.body.data.is_loader_required,
        delivery_images: deliveryTaskDetails.body.data.delivery_images,
        delivery_instruction: deliveryTaskDetails.body.data.delivery_instruction,
        insurance_amount: deliveryTaskDetails.body.data.insurance_amount,
        total_no_of_tasks: deliveryTaskDetails.body.data.total_no_of_tasks,
        total_service_charge: deliveryTaskDetails.body.data.total_service_charge,
        parcel_amount: deliveryTaskDetails.body.data.parcel_amount,
        payment_method: 32, /* payment via card (see API values format codes above 👆🏾) */
        amount: String(cost_per_task),
        deliveries: deliveryTaskDetails.body.data.deliveries,
        pickups: deliveryTaskDetails.body.data.pickups
    });

    res.status(response.body.status).send(response.body.message)
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});


```

## API Resources

>Each method expects an object literal with both **route parameters** and **request parameters (query / body)**. Please, go through the _src/Kwik/index.js_ `apiEndpoints` object to see the specific items that should make up the object literal for each method and their types

- **Tasks**
  - kwikClient.cancelDeliveryTask()
  - kwikClient.scheduleDeliveryTask()
- **Vehicles**
  - kwikClient.fetchAllAvailableDeliveryVehicles()
- **Loaders**
  - kwikClient.fetchAllLoadersOnAmount()
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
  - kwikClient.listAllCustomersPerCorporates()
  - kwikClient.listAllCorporatesInvoicesSub()
- **Task Details ( Jobs )**
  - kwikClient.getSingleDeliveryTaskDetails()
  - kwikClient.getAllDeliveryTaskDetails()
  - kwikClient.getDeliveryTaskStatus()

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
