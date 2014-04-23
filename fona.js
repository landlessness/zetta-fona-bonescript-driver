var Device = require('zetta-device');
var util = require('util');
var bone = require('bonescript');
var async = require('async');
var AT = require('./lib/at');

var FONA = module.exports = function() {
  Device.call(this);
  this._serialPort = arguments[0];
  this._resetPin = arguments[1];
  this._apn = arguments[2];

  this._serialPort.on('data', function(data) {
    console.log('RAW ===\n\n' + data + '\n\n=== RAW');
  });
  
  // Properties
  this.accessTechnology = null;
  this.adcVoltage = null;
  this.batteryPercentage = null;
  this.batteryVoltage = null;
  this.deviceDateTime = null;
  this.fmVolume = null;
  this.imei = null;
  this.packetDomainServiceStatus = null;
  this.packetDomainServiceStatusDescription = null;
  this.receivedSignalStrengthCondition = null;
  this.receivedSignalStrengthDBM = null;
  this.simCCID = null;
  this.smsCount = null;
  this.smsMessages = {};
  this.triangulationLongitude = null;
  this.triangulationLongitude = null;
  this.volume = null;
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
    { name: 'message', title: 'Body of the SMS', type: 'text'},
    ]);

  this._setupWriteParseQueue(function() {
    self.resetFONA(function() {
      self._requestFundamentals();
      self._requestVitals();
      setInterval(function() {
        self._requestVitals();
      }, 60000);
    });
  });
};

FONA.prototype.write = function(command, cb) {
  this.state = 'writing';
  var self = this;
  this.log('command: ' + command);
  this.log('command (encoded): ' + encodeURI(command));
  this._serialPort.write(command, function(err, results) {
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
  if (!!match) {
    this.log('match: true');
  } else {
    this.log('failed match on data: ' + data);
    this.log('with regexp: ' + this._regexps[this._regexpIndex].toString());
    this.log('URI encoded data: ' + encodeURI(data));
    throw new Error('failed match');
  }
  this.state = 'waiting';
  this.log('match: ' + match);
  cb(null, match);
};

FONA.prototype._setupWriteParseQueue = function(cb) {

  var self = this;
  
  this._q = async.priorityQueue(function (task, callback) {
    self._regexpIndex = 0;
    self._regexps = task.regexps;
    self._matches = [];
    self._callback = callback;

    // TODO: add a sanity check timeout for 
    // cases where data doesn't come back
    // so that we can either error out or callback 
    //to queue to execute next task

    // Prepare to Parse
    self.log('add serial port listener');
    self._serialPort.on('data', parseData);
     
    // Write
    if (!!task.rawCommand) {
      self.call('write', task.rawCommand);
    } else {
      self.call('write', task.command + "\n\r");
    }

  }, 1);


  // Parse
  var parseData = function(data) {
    var regexp = self._regexps[self._regexpIndex];
    self.call('parse', data, regexp, function(err, match) {
      self.log('add match to matches array');
      console.log('match: ', match);
      self._matches.push(match);
      self._regexpIndex++;
      if (self._regexpIndex >= self._regexps.length) {
        self.log('remove serial port listener');
        self._serialPort.removeListener('data', parseData);
        console.log('matches: ', self._matches);
        self._callback(self._matches);
      }
    });
  }

  cb();
}

FONA.prototype.sendSMS = function(phoneNumber, message, cb) {
  
  this.state = 'sending-sms';

  var self = this;
  
  this.log('sendSMS #phoneNumber: ' + phoneNumber + ' #message: ' + message);
  
  this._enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._enqueue({
    command: 'AT+CMGS="' + phoneNumber + '"',
    regexps: [new RegExp('^AT\\+CMGS="' + phoneNumber + '"\\s*')]}, function() {});
  this._enqueue({
    rawCommand: message + '\u001a',
    regexps: [new RegExp('^> ' + message + '\\s*'), /^\+CMGS: (\d+)/,/^$/,/OK/]}, function() {});
  
  this.state = 'waiting';

  cb();
};

FONA.prototype.readSMS = function(messageIndex, cb) {
  var smsMessage = {};
  
  this.log('readSMS: ' + messageIndex);
  var self = this;
  this._enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._enqueue({
    command: 'AT+CSDH=1', 
    regexps: [/^AT\+CSDH=1/,/OK/]}, function() {});
  this._enqueue({ 
    command: 'AT+CMGR=' + messageIndex, 
    regexps: [/^AT\+CMGR=\d+/,
      /^\+CMGR: "([A-Z]+) ([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/,
      /^(.*)$/,
      /^$/,
      /^OK$/]},
    function (matches) {
      self.smsMessages[messageIndex] = {
        receivedState: matches[1][1],
        readState: matches[1][2],
        sendersPhoneNumber: matches[1][3],
        timeStamp: matches[1][5],
        body: matches[2][0]
      };
      cb();
    });
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

FONA.prototype._requestBatteryPercentAndVoltage = function() {
  var self = this;
  this._enqueueSimple('AT+CBC', /^\+CBC: .*,(.*),(.*)/, function (matches) {
    self.batteryPercentage = matches[1][1];
    self.batteryVoltage = matches[1][2];
  });
}

FONA.prototype._requestADCVoltage = function() {
  var self = this;
  this._enqueueSimple('AT+CADC?', /^\+CADC: .*,(.*)/, function (matches) {
    self.adcVoltage = matches[1][1];
  });
}

FONA.prototype._requestSIMCCID = function() {
  var self = this;
  this._enqueueSimple('AT+CCID', /^(\d[a-zA-Z0-9]*)$/, function (matches) {
    self.simCCID = matches[1][1];
  });
}

FONA.prototype._requestIMEI = function() {
  var self = this;
  this._enqueueSimple('AT+GSN', /^(\d{15})$/, function (matches) {
      self.imei = matches[1][1];
  });
}

FONA.prototype._requestRegistrationStatusAndAccessTechnology = function() {
  var self = this;
  this._enqueueSimple('AT+CREG?', /^\+CREG: (.*),(.*)$/, function (matches) {
    self.registrationStatus = matches[1][1];
    self.registrationStatusDescription = AT.registrationStatusMap[self.registrationStatus]['description'];
    self.accessTechnology = matches[1][2];
    self.accessTechnologyDescription = AT.accessTechnologyMap[self.accessTechnology]['description'];
  });
}

FONA.prototype._requestSignalQuality = function() {
  var self = this;
  this._enqueueSimple('AT+CSQ', /^\+CSQ: (\d*),(\d*)$/, function (matches) {
    self.receivedSignalStrength = matches[1][1];
    self.receivedSignalStrengthDBM = AT.receivedSignalStrengthIndicatorMap[self.receivedSignalStrength]['dBm'];
    self.receivedSignalStrengthCondition = AT.receivedSignalStrengthIndicatorMap[self.receivedSignalStrength]['condition'];
    self.bitErrorRate = matches[1][2];
  });
}

FONA.prototype._requestAllSMSMessages = function() {
  var self = this;
  this._requestSMSCountAndCapacity(function() {
    for (messageIndex = 1; messageIndex <= self.smsCount; messageIndex++) {
      self.readSMS(messageIndex, function() {});
    }});
}

FONA.prototype._requestSMSCountAndCapacity = function(cb) {
  var self = this;
  this._enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._enqueueSimple('AT+CPMS?', /^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/, function (matches) {
    self.smsCount = matches[1][1];
    self.smsCapacity = matches[1][2];
    cb();
  });
}

FONA.prototype._requestVolume = function() {
  var self = this;
  this._enqueueSimple('AT+CLVL?', /^\+CLVL: (\d+)/, function (matches) {
    self.volume = matches[1][1]
  });
}

FONA.prototype._requestFMVolume = function() {
  var self = this;
  this._enqueueSimple('AT+FMVOLUME?', /^\+FMVOLUME: (\d+)/, function (matches) {
    self.fmVolume = matches[1][1]
  });
}

FONA.prototype._requestDeviceDateTime = function() {
  var self = this;
  this._enqueueSimple('AT+CCLK?', /^\+CCLK: "([^"]*)"/, function (matches) {
    self.deviceDateTime = matches[1][1]
  });
}

FONA.prototype._requestPacketDomainServiceStatus = function() {
  var self = this;
  this._enqueueSimple('AT+CGATT?', /^\+CGATT: (\d+)/, function (matches) {
    self.packetDomainServiceStatus = matches[1][1];
    self.packetDomainServiceStatusDescription = AT.packetDomainServiceStatusMap[self.packetDomainServiceStatus]['description'];
  });
}

FONA.prototype._requestTriangulatedLocation = function() {
  var self = this;

  var setBearer = 'AT+SAPBR=3,1,"CONTYPE","GPRS"';
  this._enqueue({
    command: setBearer, 
    regexps: [new RegExp(RegExp.quote(setBearer)), /OK/]}, function() {});

  var setAPN = 'AT+SAPBR=3,1,"APN","' + this._apn + '"';
  this._enqueue({
    command: setAPN,
    regexps: [new RegExp(RegExp.quote(setAPN)), /OK/]}, function() {});

  var activateBearer = 'AT+SAPBR=1,1';
  this._enqueue({
    command: activateBearer,
    regexps: [new RegExp(RegExp.quote(activateBearer)), /OK|ERROR/]}, function() {});

  this._enqueueSimple('AT+CIPGSMLOC=1,1', /^\+CIPGSMLOC: (\d+),([0-9\-\.]+),([0-9\-\.]+),([0-9/]+),([0-9:]+)$/, function (matches) {
    self.triangulationMysteryParam = matches[1][1];
    self.triangulationLongitude = matches[1][2];
    self.triangulationLatitude = matches[1][3];
    self.triangulationDate = matches[1][4];
    self.triangulationTime = matches[1][5];
  });
}

FONA.prototype._requestFundamentals = function(context) {
  if (this.available('write')) {
    this._requestSIMCCID();
    this._requestIMEI();
  }
}

FONA.prototype._requestVitals = function(context) {
  if (this.available('write')) {
    this._requestFMVolume();
    this._requestVolume();
    this._requestDeviceDateTime();
    this._requestPacketDomainServiceStatus();
    this._requestADCVoltage();
    this._requestBatteryPercentAndVoltage();
    this._requestRegistrationStatusAndAccessTechnology();
    this._requestSignalQuality();
    this._requestTriangulatedLocation();
    this._requestAllSMSMessages();
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
  this.log(
    'queue #length: ' + this._q.length() +
    ' #started: ' + this._q.started +
    ' #running: ' + this._q.running() +
    ' #idle: ' + this._q.idle() +
    ' #concurrency: ' + this._q.concurrency +
    ' #paused: ' + this._q.paused
  );
}

FONA.prototype._enqueueSimple = function(command, regexp, cb) {
  this._enqueue({
    command: command, 
    regexps: [new RegExp(RegExp.quote(command) + '\\s*'), regexp, /^$/, /OK/]},
    function (matches) {
      cb(matches);
    });
}

RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};