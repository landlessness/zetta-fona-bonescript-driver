var Device = require('zetta-device');
var util = require('util');

var Fona = module.exports = function(serialPort) {
  Device.call(this);

  this._serialPort = serialPort;
  this.simCCID = null; // gets populated after data is parsed from device

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
  .when('waiting', { allow: ['write', 'send-sms']})
  .when('writing', { allow: [] })
  .map('write', this.write, [{ name: 'command', type: 'text'}])
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', type: 'text'},
    { message: 'message', type: 'text'},
    ]);
  
  var self = this;
  setInterval(function() {
    self.requestADCVoltage();
    self.requestBatteryPercentAndVoltage();
    self.requestSIMCCID();
  }, 10000);
  
};

Fona.prototype.write = function(command, cb) {
  this.state = 'writing';
  this._serialPort.write(command + '\n\r');
  this.log('writing command: ' + command);
  this.state = 'waiting';
  cb();
};

Fona.prototype.sendSMS = function(phoneNumber, message, cb) {
  this.state = 'sending-sms';
  
  this._serialPort.write('AT+CMGF=1' + '\n\r');
  this._serialPort.write('AT+CMGS="' + phoneNumber + '"' + '\n\r');
  this._serialPort.write(message + '\n\r');
  this._serialPort.write([0x1a]);

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
    case !!(match = data.match(/^(\d[a-zA-Z0-9]*)$/)):
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