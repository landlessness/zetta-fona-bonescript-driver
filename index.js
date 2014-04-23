var Scout = require('zetta-scout');
var util = require('util');
var Fona = require('./fona');

var serialport = require('serialport');

var FonaScout = module.exports = function(deviceName) {
  Scout.call(this);
  this.deviceName = deviceName;
  this._serialPort = null;
};
util.inherits(FonaScout, Scout);

FonaScout.prototype.init = function(next) {
  this._serialPort = new serialport.SerialPort(this.deviceName, {
    baudRate: 115200,
    parser: serialport.parsers.readline('\r\n')
  });

  var self = this;

  this._serialPort.on('open', function(err) {
    if (err) {
      console.error('Fona error:', err);
      return;
    }
    var query = self.server.where({ type: 'fona' });
    self.server.find(query, function(err, results) {
      if(err) {
        return;
      }
      if (results.length) {
        self.provision(results[0], Fona, self._serialPort);
      } else {
        self.discover(Fona, self._serialPort);
      }
    });
    next();
  });

  this._serialPort.on('error', function(err) {
    console.log('error on serialport:', err);
  });

}