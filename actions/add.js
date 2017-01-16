'use strict'

var util = require('../lib/adminUtil')
var request = require('../lib/requestProcessor')
// var views = require('../helper/viewsHelper')
var fieldsHelper = require('../helper/fieldsHelper')

var async = require('async')

module.exports = function (req, res) {
  var instance = util.findInstanceObject(req)
  if (!instance.model) {
    return res.notFound()
  }
  if (!instance.config.add) {
    return res.redirect(instance.uri)
  }
  var modelFields = fieldsHelper.getFields(req, instance, 'add')
  var data = {} // list of field values
  async.series([
    function loadAssociations (done) {
      fieldsHelper.loadAssociations(modelFields, function (err, result) {
        if (err) done(err)
        modelFields = result
        done()
      })
    },

    function checkPost (done) {
      if (req.method.toUpperCase() === 'POST') {
        request.processRequest(req, modelFields, function (err, reqData) {
          if (err) done(err)
          instance.model.create(reqData).exec(function (err, record) {
            if (err) {
              req._sails.log.error(err)
              req.flash('adminError', err.details || 'Something went wrong...')
              data = reqData
              return done(err)
            }
            req.flash('adminSuccess', 'Your record was created !')
            return done()
          })
        })
      } else {
        done()
      }
    }
  ], function () {
    return res.viewAdmin({
      instance: instance,
      fields: modelFields,
      data: data
    })
  })
}
