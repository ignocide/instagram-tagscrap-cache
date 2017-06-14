'use strict'
const redis = require('redis')
var RedisClient = function (opts, cb) {
  this.KEYS = {
    ACCESS_TOKEN: 'ACCESS_TOKEN',
    REQUEST_QUEUE: 'REQUEST:QUEUE',
    REQUEST_LODING: 'REQUEST:LOADING'
  }
  this.PREFIX = {
    MEDIA: 'media:',
    CACHE: 'cache:'
  }
  this._redisClient = redis.createClient(opts)

  this._redisClient.on('connect', function () {
    cb && cb()
  })
}

RedisClient.prototype.saveAccessToken = function (access_token, cb) {
  var self = this
  this._redisClient.set(self.KEYS.ACCESS_TOKEN, access_token, function () {
    cb && cb()
  })
}

RedisClient.prototype.retieveAccessToken = function (cb) {
  var self = this
  this._redisClient.get(self.KEYS.ACCESS_TOKEN, function (err, accessToken) {
    err && cb(null)
    !err && cb && cb(accessToken)
  })
}

RedisClient.prototype.deleteAccessToken = function (cb) {
  var self = this
  this._redisClient.del(self.KEYS.ACCESS_TOKEN, function (err) {
    cb && cb(err)
  })
}

RedisClient.prototype.getMediaByTags = function (tag, cb) {
  var self = this
  this._redisClient.get(self.PREFIX.MEDIA + tag, function (err, result) {
    var exist = !!result
    if (!err && result) {
      try {
        result = JSON.parse(result)
      } catch(err) {
        result = []
      }
    }

    cb(err, result, exist)
  })
}

RedisClient.prototype.setMediaByTags = function (tag, media, cb) {
  var self = this
  this._redisClient.set(self.PREFIX.MEDIA + tag, JSON.stringify(media), cb)
}

RedisClient.prototype.updateTag = function (tag, cacheTime, checkOnly, cb) {
  var self = this
  var key = self.PREFIX.CACHE + tag
  this._redisClient.get(key, function (err, updateTime) {
    var needUpdate = false
    if (updateTime == null) {
      needUpdate = true
    }else if ((+new Date()) - updateTime > cacheTime * 1000) {
      needUpdate = true
    }

    if (!checkOnly && needUpdate) {
      self._redisClient.setex(key, cacheTime, +new Date())
    }

    cb(needUpdate)
  })
}

RedisClient.prototype.pushTag = function (tag, cb) {
  var self = this
  this._redisClient.rpush(self.KEYS.REQUEST_QUEUE, tag, cb)
}

RedisClient.prototype.popTag = function (cb) {
  var self = this
  this._redisClient.lpop(self.KEYS.REQUEST_QUEUE, function (err, tag) {
    cb(tag)
  })
}

RedisClient.prototype.getLoadState = function (cb) {
  this._redisClient.get(this.KEYS.REQUEST_LODING, function (err, result) {
    result = result || false
    result = JSON.parse(result)
    cb(err, result)
  })
}

RedisClient.prototype.setLoadState = function (loading, cb) {
  this._redisClient.set(this.KEYS.REQUEST_LODING, loading, function () {
    cb && cb()
  })
}
module.exports = RedisClient
