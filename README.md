## Node library for Adafruit's FONA with BeagleBone Black on Zetta

###Install

```
$> npm install zetta-fona-bonescript-driver
```

###Usage

```
var zetta = require('zetta');
var FONA = require('zetta-fona-bonescript-driver');

zetta()
  .use(FONA)
  .listen(1337)
```

### Hardware

* BeagleBone Black
* Adafruit FONA

###Transitions

#####write(command)

Write to the FONA via AT commands.

#####read-sms(index)

Read the message at the index location.

#####send-sms(phoneNumber, message)

Send a text message to the phoneNumber.

### Design

#### Queueing
The Zetta FONA driver uses a `queue` to execute underlying `serial` commands. The driver periodically executes `serial` commands in order to `monitor` key properties of the device. The internally-generated `serial` requests are `push`ed onto the back of the queue. Requests created by API consumers and other clients are `unshift`ed to the front of the queue.

#### Writing
Write operations to the `serial` port are non-blocking.

#### Parsing

Parsing of the `serial` data is via an event emitter.

#### Reconciling
So, in order for a long-running command - like requesting triangulated location - to finish before the next `serial` command is attempted the data parsing must send a signal to control the execution of the next write command.


This is accomplished by a `queue` worker that executes the `write` command, `pause`s the `queue` and then goes into an async `whilst` loop waiting for the `emit`ted data to be parsed by the parser. Once the expected data is returned the worker `resume`s the queue.

###Resources
While designing and developing this node.js driver for FONA the following resources were helpful:

* [Adafruit FONA Library](https://github.com/adafruit/Adafruit_FONA_Library)
* [Adafruit FONA Arduino Test](https://learn.adafruit.com/adafruit-fona-mini-gsm-gprs-cellular-phone-module/arduino-test)
* [Adafruit FONA Tethering to Raspberry Pi or BeagleBone Black](https://learn.adafruit.com/fona-tethering-to-raspberry-pi-or-beaglebone-black/overview)
* [AT Commands at M2MSupport](http://m2msupport.net/m2msupport/at-command/) 
  * Helpful site for understanding AT commands structure and responses
* [SIM 800L Hardware Design (PDF)](http://www.headele.com/Datasheet/Wireless%20module/GPRS/SIMCOM/SIM800L_Hardware_Design_V1.00.pdf)
* [Sim900 Geolocation without GPS, AT+CIPGSMLOC](http://signusx.com/sim900-geolocalization-without-gps-atcipgsmloc/)
* [BeagleBone Serial ports / UART](http://beaglebone.cameon.net/home/serial-ports-uart)

