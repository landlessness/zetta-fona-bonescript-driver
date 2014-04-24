var Scout = require('zetta-scout');
var util = require('util');
var FONA = require('./fona');
var bone = require('bonescript');

var FONAScout = module.exports = function() {
  Scout.call(this);
  this.resetPin = arguments[0];
  this.apn = arguments[1];
};
util.inherits(FONAScout, Scout);

FONAScout.prototype.init = function(next) {
  var queries = [
    this.server.where({ type: 'serial' })
  ];

  var self = this;
  this.server.observe(queries, function(serialDevice) {
    self.discover(FONA, serialDevice, self.resetPin, self.apn);
  });

  next();
}