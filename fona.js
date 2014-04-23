var Device = require('zetta-device');
var util = require('util');

var Fona = module.exports = function(serialPort) {
  Device.call(this);

  this.smsMessages = [];
  this._serialPort = serialPort;
  
  var self = this;
  this._serialPort.on('data', function(data){
    self._parseATData(data);
  });
  
};
util.inherits(Fona, Device);

Fona.prototype.init = function(config) {
  
  config
  .name('Adafruit Fona')
  .type('fona')
  .monitor('receivedSignalStrengthDBM', {title: 'Received Signal Strength', units: 'dBm' })
  .monitor('receivedSignalStrengthCondition')
  .monitor('batteryPercentage')
  .monitor('smsCount')
  .monitor('batteryVoltage')
  .monitor('adcVoltage')
  .state('waiting')
  .when('waiting', { allow: ['write', 'send-sms', 'read-sms']})
  .when('writing', { allow: [] })
  .map('write', this.write, [{ name: 'command', type: 'text'}])
  .map('read-sms', this.readSMS, [
    { name: 'index', title: 'Message Index', type: 'range',
      min: 1, step: 1}])
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', title: 'Phone Number to Send SMS', type: 'text'},
    { message: 'message', type: 'text'},
    ]);
  
  this._requestVitals();
  var self = this;
  setInterval(function() {
    self._requestVitals();
  }, 5000);
  
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

Fona.prototype.readSMS = function(index, cb) {
  this.log('readSMS: ' + index);
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CSDH=1');
  this.call('write', 'AT+CMGR=' + index);
  cb();
}

Fona.prototype._requestBatteryPercentAndVoltage = function() {
  this.call('write', 'AT+CBC');
}

Fona.prototype._requestADCVoltage = function() {
  this.call('write', 'AT+CADC?');
}

Fona.prototype._requestSIMCCID = function() {
  this.call('write', 'AT+CCID');
}

Fona.prototype._requestSMSCountAndCapacity = function() {
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CPMS?');
}

Fona.prototype._requestSMSCountAndCapacity = function() {
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CPMS?');
}

Fona.prototype._requestRegistrationStatusAndAccessTechnology = function() {
  this.call('write', 'AT+CREG?');
}

Fona.prototype._requestSignalQuality = function() {
  this.call('write', 'AT+CSQ');
}

Fona.prototype._requestVitals = function(context) {
  this._requestADCVoltage();
  this._requestBatteryPercentAndVoltage();
  this._requestSMSCountAndCapacity();
  this._requestSIMCCID();
  this._requestRegistrationStatusAndAccessTechnology();
  this._requestSignalQuality();
}

Fona.prototype._parseATData = function(data) {
  var match = null;
  this.log('parsing AT data: ' + data);
  
  switch (true) {
    case !!(match = data.match(/^\+CADC: .*,(.*)$/)):
      this.adcVoltage = match[1];
      break;
    case !!(match = data.match(/^\+CREG: (.*),(.*)$/)):
      this.registrationStatus = match[1];
      this.accessTechnology = match[2];
      break;
    case !!(match = data.match(/^\+CSQ: (\d*),(\d*)$/)):
      this.receivedSignalStrength = match[1];
      this.receivedSignalStrengthDBM = this._receivedSignalStrengthIndicatorMap[match[1]]['dBm'];
      this.receivedSignalStrengthCondition = this._receivedSignalStrengthIndicatorMap[match[1]]['condition'];
      this.bitErrorRate = match[2];
      break;
    case !!(match = data.match(/^\+CBC: .*,(.*),(.*)$/)):
      this.batteryPercentage = match[1];
      this.batteryVoltage = match[2];
      break;
    case !!(match = data.match(/^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/)):
      this.smsCount = match[1];
      this.smsCapacity = match[2];
      break;
    case !!(match = data.match(/^\+CMGR: "([A-Z]+) ([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+).*$/)):
      this.smsMessages.push(
        {
          receivedState: match[1],
          readState: match[2],
          sendersPhoneNumber: match[3],
          timeStamp: match[5],
        }
      );
      break;
    case !!(match = data.match(/^(\d[a-zA-Z0-9]*)$/)):
      // keep check got SIM CCIDone last
      this.simCCID = match[1];
      break;
    default:
      break;
  }
}

Fona.prototype._receivedSignalStrengthIndicatorMap = {
  2: {dBm: -109,
    condition: 'Marginal'},
  3: {dBm: -107,
    condition: 'Marginal'},
  4: {dBm: -105,
    condition: 'Marginal'},
  5: {dBm: -103,
    condition: 'Marginal'},
  6: {dBm: -101,
    condition: 'Marginal'},
  7: {dBm: -99,
    condition: 'Marginal'},
  8: {dBm: -97,
    condition: 'Marginal'},
  9: {dBm: -95,
    condition: 'Marginal'},
  10: {dBm: -93,
    condition: 'OK'},
  11: {dBm: -91,
    condition: 'OK'},
  12: {dBm: -89,
    condition: 'OK'},
  13: {dBm: -87,
    condition: 'OK'},
  14: {dBm: -85,
    condition: 'OK'},
  15: {dBm: -83,
    condition: 'Good'},
  16: {dBm: -81,
    condition: 'Good'},
  17: {dBm: -79,
    condition: 'Good'},
  18: {dBm: -77,
    condition: 'Good'},
  19: {dBm: -75,
    condition: 'Good'},
  20: {dBm: -73,
    condition: 'Excellent'},
  21: {dBm: -71,
    condition: 'Excellent'},
  22: {dBm: -69,
    condition: 'Excellent'},
  23: {dBm: -67,
    condition: 'Excellent'},
  24: {dBm: -65,
    condition: 'Excellent'},
  25: {dBm: -63,
    condition: 'Excellent'},
  26: {dBm: -61,
    condition: 'Excellent'},
  27: {dBm: -59,
    condition: 'Excellent'},
  28: {dBm: -57,
    condition: 'Excellent'},
  29: {dBm: -55,
    condition: 'Excellent'},
  30: {dBm: -53,
    condition: 'Excellent'}
}