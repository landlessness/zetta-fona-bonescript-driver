var Scout = require('zetta-scout');
var util = require('util');
var FONA = require('./fona');

var serialport = require('serialport');

var FONAScout = module.exports = function(deviceName) {
  Scout.call(this);
  this.deviceName = deviceName;
  this._serialPort = null;
};
util.inherits(FONAScout, Scout);

FONAScout.prototype.init = function(next) {
  this._serialPort = new serialport.SerialPort(this.deviceName, {
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
        self.provision(results[0], FONA, self._serialPort);
      } else {
        self.discover(FONA, self._serialPort);
      }
    });
    next();
  });

  this._serialPort.on('error', function(err) {
    console.log('error on serialport:', err);
  });

}