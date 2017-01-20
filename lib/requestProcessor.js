var _ = require('lodash')
// var async = require('async')
var queryString = require('querystring')
var formidable = require('formidable')

/**
 * Default helper that will contain all methods
 * that should help with processing request details and bind
 *
 * @type {*}
 */
module.exports = {
  /**
   * Will add new HTTP GET params to current params and will return a new string of GET query params.
   *
   * @param {Request} req
   * @param {Object} params
   * @returns {String}
   */
  addGetParams: function (req, params) {
    if (!req || !_.isPlainObject(req.query)) throw new Error('Wrong request given !')
    if (!_.isPlainObject(params)) {
      params = {}
    }
    var query = _.merge(_.clone(req.query), _.clone(params))
    return queryString.stringify(query)
  },

  // /**
  //  * upload file to server
  //  *
  //  * @param {string} key
  //  * @param {*} val
  //  * @param {Object} field
  //  * @param {Function=} [cb]
  //  * @returns {?string}
  //  */
  // uploadFile: function(key, val, field, cb) {
  //   if (!key || !val || !field) {
  //     return null
  //   }
  //   if (!req.file || !_.isFunction(req.file)) {
  //     return null
  //   }
  //   var options = {}
  //   if (field.config.uploadPath) {
  //     options.dirname = field.config.uploadPath;
  //   }
  //   req.file(key).upload(options, cb);
  // },
  /**
   * Will fetch all files from request. That should be stored
   *
   * @param {Request} req
   * @param {Object} fields List of fileds config
   * @param {Function=} [cb]
   */
  // processFiles: function(req, fields, cb) {
  //     var fileFieldKeys = [];
  //     _.forIn(fields, function(field, key) {
  //         if (field.config && field.config.file) {
  //             fileFieldKeys.push(key);
  //         }
  //     });
  //     if (fileFieldKeys.length == 0) {
  //         return cb();
  //     }
  //     var files = {};
  //     async.eachLimit(fileFieldKeys, 10, function(key, done) {
  //         // req.file(key).upload(function(err, file) {
  //         //     if (err) {
  //         //         return done(err);
  //         //     }
  //         //     files[key] = file;
  //         //     done();
  //         // });
  //     }, function(err, result) {
  //         cb(err, files);
  //     });
  // },

  /**
   * Will try to find all fields that should be used in model
   *
   * @param {Request} req
   * @param {Object} fields
   * @param {Function=} [cb]
   * @see AdminUtil#getFields to know what data should be passed into fields
   * @returns {Object} List of processed values from request
   */
  processRequest: (req, modelFields, cb) => {
    var booleanFields = _.pick(modelFields, function (field, key) {
      return (field.config.type === 'boolean')
    })
    var form = new formidable.IncomingForm()
    form.parse(req, function (err, formFields, files) {
      if (err) cb(err)
      var postParams = _.pick(formFields, function (value, key) {
        return Boolean(modelFields[key])
      })
      _.forIn(postParams, function (val, key) {
        var field = modelFields[key]
        if (field.model.type === 'boolean') {
          if (val === '0') {
            val = false
          }
          postParams[key] = Boolean(val)
        }
        console.log('TYPE', field.model.type, val, new Date(val))
        if (field.model.type === 'datetime') {
          postParams[key] = new Date(val)
        }

        if (field.model.type === 'integer') {
          postParams[key] = parseInt(val)
        }

        if (field.model.type === 'float' || field.model.type === 'number') {
          postParams[key] = parseFloat(val)
        }
        // remove empty field from list
        if (field.model.type === 'association' && !postParams[key]) {
          delete postParams[key]
        }
       // if (field.config.file) {
       //    // need to upload file
       //    this.uploadFile(key, val, field, function(err, file) {
       //        console.log(file);
       //    });
       // }
      })
      _.forEach(booleanFields, function (field, key) {
        if (!postParams[key]) {
          postParams[key] = false
        }
      })
      console.log('CB')
      return cb(null, postParams)
    })
  }
}
