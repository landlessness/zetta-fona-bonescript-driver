var Scout = require('zetta-scout');
var util = require('util');
var FONA = require('./fona');
var bone = require('bonescript');

var serialport = require('serialport');

var FONAScout = module.exports = function() {
  Scout.call(this);
  this.serialPortLocation = arguments[0];
  this.resetPin = arguments[1];
  this.apn = arguments[2];
  this._serialPort = null;
};
util.inherits(FONAScout, Scout);

FONAScout.prototype.init = function(next) {
  this._serialPort = new serialport.SerialPort(this.serialPortLocation, {
    baudRate: 115200,
    parser: serialport.parsers.readline('\r\n')
  });

  var self = this;

  this._serialPort.on('open', function(err) {
    if (err) {
      console.error('FONA error:', err);
      return;
    }
    var query = self.server.where({ type: 'FONA' });
    self.server.find(query, function(err, results) {
      if(err) {
        return;
      }
      if (results.length) {
        self.provision(results[0], FONA, self._serialPort, self.resetPin, self.apn);
      } else {
        self.discover(FONA, self._serialPort, self.resetPin, self.apn);
      }
    });
    next();
  });

  this._serialPort.on('error', function(err) {
    console.log('error on serialport:', err);
  });

}