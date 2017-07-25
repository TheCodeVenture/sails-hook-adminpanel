/* globals sails */
/**
 * Image service
 *
 * Handle file upload and download from amazon s3 and mongodb-gridfs
 *
 * Your model should contain those attributes:
 * @picture {string}
 * @pictureFd {string}
 *
 * Enviromment variables:
 * @AWSAccessKeyId {env}
 * @AWSSecretKey {env}
 * @BUCKET_NAME {env}
 */

const faker = require('faker')
const s3 = require('s3')
const formidable = require('formidable')
const mongodb = require('mongodb')
const mongoconnection = require('../../config/connections').connections[
  sails.config.models.connection
]
const AWS = require('aws-sdk')

AWS.util.date.getDate = function() {
  return new Date(new Date().getTime())
}

const s3sdk = new AWS.S3({
  accessKeyId: process.env.AWSAccessKeyId,
  secretAccessKey: process.env.AWSSecretKey,
  region: 'eu-west-1',
  signatureVersion: 'v4'
})

const client = s3.createClient({
  maxAsyncS3: 20, // this is the default
  s3RetryCount: 3, // this is the default
  s3RetryDelay: 1000, // this is the default
  multipartUploadThreshold: 20971520, // this is the default (20 MB)
  multipartUploadSize: 15728640, // this is the default (15 MB)
  s3Client: s3sdk,
  s3Options: {
    accessKeyId: process.env.AWSAccessKeyId,
    secretAccessKey: process.env.AWSSecretKey,
    region: 'eu-west-1'
  }
})

// Connection URI
const isDEV = process.env.NODE_ENV === 'development'
const uri = `mongodb://${mongoconnection.host}:${mongoconnection.port}/${mongoconnection.database}`

const update = (type, id, pictureFd, picture) => {
  const model = sails.models[type]
  return model.update(id, { picture, pictureFd })
}

const create = (type, pictureFd, picture) => {
  const model = sails.models[type]
  return model.create({ picture, pictureFd })
}

const upload = (req, res, type, shouldUpdate = true) => {
  return new Promise((resolve, reject) => {
    if (!type || (shouldUpdate && !req.param('id'))) {
      return reject('Request is not Valid, Please specify type!')
    }
    if (isDEV) {
      return req.file('file').upload({
        adapter: require('skipper-gridfs'),
        uri: `${uri}.images`
      }, (err, uploadedFiles) => {
        if (err) {
          return reject(err)
        }
        // only one file being processed!!!
        if (!uploadedFiles.length) {
          return reject('No file was uploaded')
        }
        let pictureFd = uploadedFiles[0].fd
        let id = req.param('id') || faker.random.uuid()
        let picture = `/${type}/picture/${id}`
        if (shouldUpdate) {
          return resolve(update(type, id, pictureFd, picture))
        } else {
          return resolve(create(type, pictureFd, picture))
        }
      })
    }

    let form = new formidable.IncomingForm()
    var files = []
    let params = {
      s3Params: {
        Bucket: process.env.BUCKET_NAME
      }
    }
    form
      .on('file', function(field, file) {
        files.push(file)
      })
      .on('end', function() {
        const id = req.param('id') || faker.random.uuid()

        params.Body = files[0]
        params.localFile = files[0].path
        params.s3Params['ContentType'] = files[0].type
        params.s3Params['Key'] = id

        const uploader = client.uploadFile(params)

        uploader.on('error', function(err) {
          console.error('Enable to upload:', err.stack)
        })

        // uploader.on('progress', function () {
        // console.log('progress', uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal)
        // })

        uploader.on('end', function(data) {
          const pictureFd = id
          const picture = `/${type}/picture/${id}`
          if (shouldUpdate) {
            return resolve(update(type, id, pictureFd, picture))
          } else {
            return resolve(create(type, pictureFd, picture))
          }
        })
      })
    return form.parse(req)
  })
}

const download = (res, pictureFd) => {
  if (isDEV) {
    return mongodb.MongoClient.connect(uri, function(err, db) {
      if (err) return res.badRequest(err)
      var bucket = new mongodb.GridFSBucket(db, {
        chunkSizeBytes: 1024,
        bucketName: 'images'
      })
      bucket
        .openDownloadStreamByName(pictureFd)
        .pipe(res)
        .on('error', error => res.badRequest(error))
        .on('finish', () => db.close())
    })
  }
  let params = { Bucket: process.env.BUCKET_NAME, Key: pictureFd }
  client
    .downloadStream(params)
    .on('error', error => res.badRequest(error))
    .pipe(res)
}

module.exports = {
  create,
  update,
  upload,
  download
}
