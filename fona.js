var Device = require('zetta-device');
var util = require('util');
var bone = require('bonescript');

var FONA = module.exports = function() {
  Device.call(this);
  this.smsMessages = [];
  this._serialPort = arguments[0];
  this._resetPin = arguments[1];
};
util.inherits(FONA, Device);

FONA.prototype.init = function(config) {
  
  config
  .name('Adafruit FONA')
  .type('FONA')
  .monitor('triangulationLatitude')
  .monitor('triangulationLongitude')
  .monitor('receivedSignalStrengthDBM')
  .monitor('receivedSignalStrengthCondition')
  .monitor('batteryPercentage')
  .monitor('smsCount')
  .monitor('batteryVoltage')
  .monitor('adcVoltage')
  .state('waiting')
  .when('resetting-fona', {allow: ['parse']})
  .when('waiting', { allow: ['reset-fona', 'write', 'parse', 'send-sms', 'read-sms']})
  .when('parsing', { allow: ['reset-fona', 'write', 'parse', 'send-sms', 'read-sms']})
  .when('writing', { allow: ['reset-fona', 'parse', 'write'] })
  .map('reset-fona', this.resetFONA)
  .map('write', this.write, [{ name: 'command', type: 'text'}])
  .map('parse', this.parse, [{ name: 'data', type: 'text'}])
  .map('read-sms', this.readSMS, [
    { name: 'index', title: 'Message Index', type: 'range',
      min: 1, step: 1}])
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', title: 'Phone Number to Send SMS', type: 'text'},
    { message: 'message', type: 'text'},
    ]);
  
  var self = this;
  this._serialPort.on('data', function(data){
    self.call('parse', data);
  });
  
  this.resetFONA(function() {
    self._requestVitals();
    setInterval(function() {
      self._requestVitals();
    }, 5000);
  });
  
};

FONA.prototype.resetFONA = function(cb) {
  var self = this;
  
  this.state = 'resetting-fona';
  
  bone.pinMode(this._resetPin, bone.OUTPUT);
  
  this.log('setting reset pin ' + this._resetPin + ' to ' + bone.HIGH);
  bone.digitalWrite(this._resetPin, bone.HIGH);
  setTimeout(function() {
    self.log('setting reset pin ' + self._resetPin + ' to ' + bone.LOW);
    bone.digitalWrite(self._resetPin, bone.LOW);
    setTimeout(function() {
      self.log('setting reset pin ' + self._resetPin + ' to ' + bone.HIGH);
      bone.digitalWrite(self._resetPin, bone.HIGH);
      self.state = 'waiting';
      cb();
    }, 100);
  }, 10);
  
}

FONA.prototype.write = function(command, cb) {
  this.state = 'writing';
  this.log('writing command: ' + command);
  var self = this;
  this._serialPort.write(command + '\n\r', function(err, results) {
    if (typeof err !== 'undefined') {
      self.log('write err ' + err);
      self.log('write results ' + results);
    }
  });
  this.state = 'waiting';
  cb();
};

FONA.prototype.parse = function(data, cb) {
  this.state = 'parsing';
  this.log('parsing data: ' + data);
  this._parseATData(data);
  this.state = 'waiting';
  cb();
};

FONA.prototype.sendSMS = function(phoneNumber, message, cb) {
  this.state = 'sending-sms';
  this._serialPort.write('AT+CMGF=1' + '\n\r');
  this._serialPort.write('AT+CMGS="' + phoneNumber + '"' + '\n\r');
  this._serialPort.write(message + '\n\r');
  this._serialPort.write([0x1a]);
  this.state = 'waiting';
  cb();
};

FONA.prototype.readSMS = function(index, cb) {
  this.log('readSMS: ' + index);
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CSDH=1');
  this.call('write', 'AT+CMGR=' + index);
  cb();
}

FONA.prototype._requestBatteryPercentAndVoltage = function() {
  this.call('write', 'AT+CBC');
}

FONA.prototype._requestADCVoltage = function() {
  this.call('write', 'AT+CADC?');
}

FONA.prototype._requestSIMCCID = function() {
  this.call('write', 'AT+CCID');
}

FONA.prototype._requestIMEI = function() {
  this.call('write', 'AT+GSN');
}

FONA.prototype._requestSMSCountAndCapacity = function() {
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CPMS?');
}

FONA.prototype._requestSMSCountAndCapacity = function() {
  this.call('write', 'AT+CMGF=1');
  this.call('write', 'AT+CPMS?');
}

FONA.prototype._requestRegistrationStatusAndAccessTechnology = function() {
  this.call('write', 'AT+CREG?');
}

FONA.prototype._requestSignalQuality = function() {
  this.call('write', 'AT+CSQ');
}

FONA.prototype._requestVolume = function() {
  this.call('write', 'AT+CLVL?');
}

FONA.prototype._requestFMVolume = function() {
  this.call('write', 'AT+FMVOLUME?');
}

FONA.prototype._requestDeviceDateTime = function() {
  this.call('write', 'AT+CCLK?');
}

FONA.prototype._requestPacketDomainServiceStatus = function() {
  this.call('write', 'AT+CGATT?');
}

FONA.prototype._requestTriangulatedLocation = function() {
  this.call('write', 'AT+SAPBR=1,1');
  this.call('write', 'AT+CIPGSMLOC=1,1');
}

FONA.prototype._requestVitals = function(context) {
  if (this.available('write')) {
    this._requestDeviceDateTime();
    this._requestPacketDomainServiceStatus();
    this._requestVolume();
    this._requestFMVolume();
    this._requestADCVoltage();
    this._requestBatteryPercentAndVoltage();
    this._requestSMSCountAndCapacity();
    this._requestSIMCCID();
    this._requestIMEI();
    this._requestRegistrationStatusAndAccessTechnology();
    this._requestSignalQuality();
    this._requestTriangulatedLocation();
  }
}

FONA.prototype._parseATData = function(data) {
  var match = null;
  this.log('parsing AT data: ' + data);
  
  switch (true) {
    case !!(match = data.match(/^\+CIPGSMLOC: \d+,([0-9\-\.]+),([0-9\-\.]+),([0-9/]+),([0-9:]+)$/)):
      this.triangulationLongitude = match[1];
      this.triangulationLatitude = match[2];
      this.triangulationDate = match[3];
      this.triangulationTime = match[4];
      break;
    case !!(match = data.match(/^\+CGATT: (\d+)$/)):
      this.packetDomainServiceStatus = match[1];
      this.packetDomainServiceStatusDescription = this._packetDomainServiceStatusMap[match[1]]['description'];
      break;
    case !!(match = data.match(/^\+CLVL: (\d+)$/)):
      this.volume = match[1];
      break;
    case !!(match = data.match(/^\+FMVOLUME: (\d+)$/)):
      this.fmVolume = match[1];
      break;
    case !!(match = data.match(/^\+CADC: .*,(.*)$/)):
      this.adcVoltage = match[1];
      break;
    case !!(match = data.match(/^\+CREG: (.*),(.*)$/)):
      this.registrationStatus = match[1];
      this.registrationStatusDescription = this._registrationStatusMap[match[1]]['description'];
      this.accessTechnology = match[2];
      this.accessTechnologyDescription = this._accessTechnologyMap[match[1]]['description'];
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
    case !!(match = data.match(/^\+CCLK: "([^"]*)"/)):
      this.deviceDateTime = match[1];
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
    case !!(match = data.match(/^(\d{15})$/)):
      // keep check got SIM CCIDone last
      this.imei = match[1];
      break;
    case !!(match = data.match(/^(\d[a-zA-Z0-9]*)$/)):
      // keep check got SIM CCIDone last
      this.simCCID = match[1];
      break;
    default:
      break;
  }
}

FONA.prototype._receivedSignalStrengthIndicatorMap = {
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

FONA.prototype._registrationStatusMap = {
  0: {description: 'not registered, MT is not currently searching a new operator to register to'},
  1: {description: 'registered, home network'},
  2: {description: 'not registered, but MT is currently searching a new operator to register to'},
  3: {description: 'registration denied'},
  4: {description: 'unknown (e.g. out of GERAN/UTRAN/E-UTRAN coverage)'},
  5: {description: 'registered, roaming'},
  6: {description: 'registered for "SMS only", home network (applicable only when indicates E-UTRAN)'},
  7: {description: 'registered for "SMS only", roaming (applicable only when indicates E-UTRAN)'},
  8: {description: 'attached for emergency bearer services only (see NOTE 2) (not applicable)'},
  9: {description: 'registered for "CSFB not preferred", home network (applicable only when indicates E-UTRAN)'},
  10: {description: 'registered for "CSFB not preferred", roaming (applicable only when indicates E-UTRAN)'}
}

FONA.prototype._accessTechnologyMap = {
  0: {description: 'GSM'},
  1: {description: 'GSM Compact'},
  2: {description: 'UTRAN'},
  3: {description: 'GSM w/EGPRS'},
  4: {description: 'UTRAN w/HSDPA'},
  5: {description: 'UTRAN w/HSUPA'},
  6: {description: 'UTRAN w/HSDPA and HSUPA'},
  7: {description: 'E-UTRAN'}
}

FONA.prototype._packetDomainServiceStatusMap = {
  0: {description: 'not attached'},
  1: {description: 'attached'},
}