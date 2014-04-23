var Device = require('zetta-device');
var util = require('util');
var bone = require('bonescript');
var async = require('async');

var FONA = module.exports = function() {
  Device.call(this);
  this.smsMessages = [];
  this._serialPort = arguments[0];
  this._resetPin = arguments[1];
  
  this._serialPort.on('data', function(data) {
    console.log('RAW ===\n\n' + data + '\n\n=== RAW');
  });

};
util.inherits(FONA, Device);

FONA.prototype.init = function(config) {
  var self = this;

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
  .when('writing', { allow: ['reset-fona'] })
  .map('reset-fona', this.resetFONA)
  .map('write', this.write, [{ name: 'command', type: 'text'}])
  .map('parse', this.parse, [{ name: 'data', type: 'text'}, { name: 'regexp', type: 'text'}])
  .map('read-sms', this.readSMS, [
    { name: 'messageIndex', title: 'Message Index', type: 'range',
      min: 1, step: 1}])
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', title: 'Phone Number to Send SMS', type: 'text'},
    { message: 'message', type: 'text'},
    ]);
  
  this._setupQueue(function() {
    self.resetFONA(function() {
      self._requestVitals();
      setInterval(function() {
      // self._requestVitals();
      }, 5000);
    });
  });
  
};

FONA.prototype._setupQueue = function(cb) {

  var self = this;
  
  this._q = async.priorityQueue(function (task, processMatch) {
    console.log('1 current queue task: ', task);
    var qContext = this;
    qContext._regexpIndex = 0;
    qContext._matches = [];
    qContext._task = task;

    var parseData = function(data) {
      var task = qContext._task; // this should not be needed
      console.log('qContext._regexpIndex: ', qContext._regexpIndex);
      console.log('2 current queue task: ', task);
      console.log('task.regexps[qContext._regexpIndex]: ', task.regexps[qContext._regexpIndex]);
      self.call('parse', data, task.regexps[qContext._regexpIndex], function(match) {
        if (!!match) {
          qContext._matches.push(match);
          self.log('match: true');
        } else {
          self.log('failed match on data: ' + encodeURI(data));
          self.log('with regexp: ' + task.regexps[qContext._regexpIndex].toString());
          throw new Error('failed match');
        }
        qContext._regexpIndex++;
        if (qContext._regexpIndex >= task.regexps.length) {
          self._serialPort.removeListener('data', arguments.callee);
          processMatch(qContext._matches);
        }
      });
    };
    self._serialPort.on('data', parseData);
    self.call('write', task.command);
  }, 1);
  cb();
}

FONA.prototype.write = function(command, cb) {
  this.state = 'writing';
  this.log('writing command: ' + command);
  var self = this;
  this._serialPort.write(command + "\n\r", function(err, results) {
    if (typeof err !== 'undefined') {
      self.log('write err ' + err);
      self.log('write results ' + results);
    }
  });
  this.state = 'waiting';
  cb();
};

FONA.prototype.parse = function(data, regexp, cb) {
  this.state = 'parsing';
  this.log('parsing data: "' + data + '"');
  this.log('parsing regexp: "' + regexp + '"');
  var match = data.match(regexp);
  this.log('parsing match: ' + match);
  this.state = 'waiting';
  cb(match);
};

FONA.prototype.sendSMS = function(phoneNumber, message, cb) {
  this.state = 'sending-sms';
  this._serialPort.write('AT+CMGF=1' + "\n\r");
  this._serialPort.write('AT+CMGS="' + phoneNumber + "\"\n\r");
  this._serialPort.write(message + "\n\r");
  this._serialPort.write([0x1a]);
  this.state = 'waiting';
  cb();
};

FONA.prototype.readSMS = function(messageIndex, cb) {
  var smsMessage = {};
  
  this.log('readSMS: ' + messageIndex);
  var self = this;
  this._enqueue({command: 'AT+CMGF=1', regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._enqueue({command: 'AT+CSDH=1', regexps: [/^AT\+CSDH=1/,/OK/]}, function() {});
  this._enqueue(
    { command: 'AT+CMGR=' + messageIndex, 
      regexps: [/^AT\+CMGR=\d+/,
        /^\+CMGR: "([A-Z]+) ([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/,
        /^(.*)$/,
        /^$/,
        /^OK$/]},
    function (matches) {
      smsMessage = {
        receivedState: matches[1][1],
        readState: matches[1][2],
        sendersPhoneNumber: matches[1][3],
        timeStamp: matches[1][5],
        body: matches[2][0]
      };
      self.log(smsMessage);
      self.smsMessages[messageIndex] = smsMessage;
      cb();
    });
}

FONA.prototype._requestBatteryPercentAndVoltage = function() {
  var self = this;
  this._enqueue({command: 'AT+CBC', regexps: /^AT\+CBC\r\r\n\+CBC: .*,(.*),(.*)/},
    function (match) {
      self.batteryPercentage = match[1];
      self.batteryVoltage = match[2];
    });
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

FONA.prototype._requestRegistrationStatusAndAccessTechnology = function() {
  this.call('write', 'AT+CREG?');
}

FONA.prototype._requestSignalQuality = function() {
  this.call('write', 'AT+CSQ');
}

FONA.prototype._requestAllSMSMessages = function() {
  // the SMS array is 1-based (not 0-based)
  for (messageIndex = 1; messageIndex <= this.smsCount; messageIndex++) {
    this.readSMS(messageIndex, function() {});
  }
}

FONA.prototype._requestSMSCountAndCapacity = function() {
  var self = this;

  this._enqueue({command: 'AT+CMGF=1', regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});

  this._enqueue(
    { command: 'AT+CPMS?', 
      regexps: [
        /^AT\+CPMS\?/,
        /^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/,
        /^$/,
        /^OK$/]},
    function (matches) {
      self.smsCount = matches[1][1];
      self.smsCapacity = matches[1][2];
    });
}

FONA.prototype._requestVolume = function() {
  var self = this;
  this._enqueue(
    { command: 'AT+CLVL?', 
      regexps: [
        /^AT\+CLVL\?/,
        /^\+CLVL: (\d+)/,
        /^$/,
        /^OK$/]},
    function (matches) {self.volume = matches[1][1]});
}

FONA.prototype._requestFMVolume = function() {
  var self = this;
  this._enqueue(
    { command: 'AT+FMVOLUME?', 
      regexps: [
        /^AT\+FMVOLUME\?/,
        /^\+FMVOLUME: (\d+)/,
        /^$/,
        /^OK$/]},
    function (matches) {self.fmVolume = matches[1][1]});
}

FONA.prototype._requestDeviceDateTime = function() {
  this.call('write', 'AT+CCLK?');
}

FONA.prototype._requestPacketDomainServiceStatus = function() {
  this.call('write', 'AT+CGATT?');
}

FONA.prototype._requestTriangulatedLocation = function() {
  var self = this;
  // TODO: get this working
  this._enqueue({command: 'AT+SAPBR=1,1', regexps: /^AT\+SAPBR=1,1\r\r\nOK/}, function() {});
    
  this._enqueue({command: 'AT+CIPGSMLOC=1,1', regexps: /^AT\+CIPGSMLOC=1,1\r\r\n\+CIPGSMLOC: (\d+)/},
    function (match) {self.fmVolume = match[1]});
}

FONA.prototype._requestVitals = function(context) {
  if (this.available('write')) {
    this._requestFMVolume();
    this._requestVolume();
    // this._requestSMSCountAndCapacity();
    // this._requestAllSMSMessages();
    // this._requestDeviceDateTime();
    // this._requestPacketDomainServiceStatus();
    // this._requestADCVoltage();
    // this._requestBatteryPercentAndVoltage();
    // this._requestSIMCCID();
    // this._requestIMEI();
    // this._requestRegistrationStatusAndAccessTechnology();
    // this._requestSignalQuality();
    // this._requestTriangulatedLocation();
  }
}

FONA.prototype._enqueue = function(command, cb) {
  var self = this;
  this._q.push(
    command,
    1,
    function (err) {
      var matches = arguments[0];
      cb(matches);
    });
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
          timeStamp: match[5]
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