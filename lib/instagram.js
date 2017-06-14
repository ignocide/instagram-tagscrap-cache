'use strict'
const RedisClient = require('./redisClient')
const images = require('./images')
const ig = require('instagram-tagscrape')

var Instagram = function (opts) {
  var self = this

  this._config = {
    cacheTime: 60 * 30,
    force: false,
    enableFirstTime: false,
    count: 20
  }

  // redis default config
  this._redisConfig = {}

  this._redisClient = null

  if (opts.config) {
    const configOpt = ['cacheTime', 'force', 'count', 'enableFirstTime']
    for (let key of configOpt) {
      if (opts.config[key] !== undefined) {
        this._config[key] = opts.config[key]
      }
    }
  }

  this._redisConfig = opts.redis
  this._redisClient = new RedisClient(this.redisConfig, function () {
    self._redisClient.setLoadState(false, function () {
      self.loadQueue()
    })
  })
}

Instagram.prototype.searchMediaByTag = function (tag, cb) {
  ig.scrapeTagPage(encodeURIComponent(tag)).then(function (result) {
    cb(null, result)
  })
}

Instagram.prototype.getMedia = function (tag, cb) {
  var self = this

  self._redisClient.getMediaByTags(tag, function (err, result, exist) {
    if (err) {
      return cb(err)
    }
    if (exist || !self._config.enableFirstTime) {
      result = new images(result)
      cb(err, result)
    } else {
      self.searchMediaByTag(tag, function (err, result) {
        result = new images(result.media)
        cb(err, result)
      })
    }
  })

  self.insertQueue(tag)
}

Instagram.prototype.updateTag = function (tag, cb) {
  var self = this
  self._redisClient.updateTag(tag, self._config.cacheTime, false, function (needUpdate) {
    if (self._config.force || needUpdate) {
      self.searchMediaByTag(tag, function (err, result) {
        if (err) {
          return cb(err)
        }
        var list = result.media
        self._redisClient.setMediaByTags(tag, list, cb)
      })
    }else {
      cb()
    }
  })
}

Instagram.prototype.loadQueue = function (cb) {
  var self = this
  self._redisClient.getLoadState(function (err, loading) {
    if (loading) {
      cb && cb()
    } else {
      self._redisClient.setLoadState(true, function () {
        self.loadQueueTask()
      })
    }
  })
}

Instagram.prototype.loadQueueTask = function () {
  var self = this
  self._redisClient.popTag(function (tag) {
    if (tag) {
      self.updateTag(tag, function () {
        self.loadQueueTask()
      })
    }else {
      self._redisClient.setLoadState(false)
    }
  })
}

Instagram.prototype.insertQueue = function (tag, cb) {
  var self = this
  self._redisClient.updateTag(tag, self._config.cacheTime, true, function (needUpdate) {
    if (needUpdate) {
      self._redisClient.pushTag(tag, function () {
        self.loadQueue()
      })
    }

    cb && cb()
  })
}

module.exports = Instagram
