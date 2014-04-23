var Device = require('zetta-device');
var util = require('util');

var Fona = module.exports = function(serialPort) {
  Device.call(this);

  this._serialPort = serialPort;

  var self = this;
  this._serialPort.on('data', function(data){
    self.parseData(data);
  });
  
};
util.inherits(Fona, Device);

Fona.prototype.init = function(config) {
  config
  .name('Adafruit Fona')
  .type('fona')
  .monitor('adcVoltage')
  .monitor('batteryVoltage')
  .monitor('batteryPercentage')
  .state('waiting')
  .when('waiting', { allow: ['write']})
  .when('writing', { allow: [] })
  .map('write', this.write, [
    { name: 'command', type: 'text'}
  ]);
  
  var self = this;
  setInterval(function() {
    self.requestADCVoltage();
    self.requestBatteryPercentAndVoltage();
    self.requestSIMCCID();
  }, 1000);
  
};

Fona.prototype.write = function(command, cb) {
  this.state = 'writing';
  this._serialPort.write(command + '\n\r');
  this.log('writing command: ' + command);
  this.state = 'waiting';
  cb();
};

Fona.prototype.parseData = function(data) {
  this.log('data received: ' + data);
  var match = null;
  switch (true) {
    case !!(match = data.match(/^\+CADC: .*,(.*)$/)):
      this.adcVoltage = match[1];
      break;
    case !!(match = data.match(/^\+CBC: .*,(.*),(.*)$/)):
      this.batteryPercentage = match[1];
      this.batteryVoltage = match[2];
      break;
    case !!(match = data.match(/^(\d{20})$/)):
      this.simCCID = match[1];
      break;
    default:
      break;
  }
}

Fona.prototype.requestBatteryPercentAndVoltage = function() {
  this.call('write', 'AT+CBC');
}

Fona.prototype.requestADCVoltage = function() {
  this.call('write', 'AT+CADC?');
}

Fona.prototype.requestSIMCCID = function() {
  this.call('write', 'AT+CCID');
}