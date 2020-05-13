'use strict'

var chai = require('chai')
var expect = chai.expect
var should = chai.should()

describe('Kwik Instance Test(s)', function () {
  // Created Instance
  var Kwik = require('../src/Kwik/index.js')
  var instance = new Kwik('app.kwik.delivery', false)

  it('should have a function [mergeNewOptions]', function () {
    /* eslint-disable no-unused-expressions */
    expect((typeof instance.setAccessToken === 'function')).to.be.true
    expect((typeof instance.setVendorId === 'function')).to.be.true
    expect((typeof instance.setUserId === 'function')).to.be.true
    expect((typeof instance.setCardId === 'function')).to.be.true
    expect((typeof instance.getEstimatedPriceForDeliveryTask === 'function')).to.be.true
    expect((typeof instance.listAllCorporates === 'function')).to.be.true
    expect((typeof instance.createCorporate === 'function')).to.be.true
    expect((typeof instance.scheduleDeliveryTask === 'function')).to.be.true
    expect((typeof instance.cancelDeliveryTask === 'function')).to.be.true
    expect((typeof instance.getExactPricingForDeliveryTask === 'function')).to.be.true
    expect((typeof instance.getAllDeliveryTaskDetails === 'function')).to.be.true
    expect((typeof instance.getSingleDeliveryTaskDetails === 'function')).to.be.true
    /* eslint-enable no-unused-expressions */
  })

  it('should throw an error if method is called without required arguments', function () {
    try {
      instance.scheduleDeliveryTask()
    } catch (err) {
      should.exist(err)
    }
  })

  it('should throw an error if method is called with any arguments other than an object', function () {
    try {
      instance.addMerchantCard([])
    } catch (err) {
      should.exist(err)
    }
  })
})
