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

###Transitions

#####write(command)

Write to the FONA via AT commands.

#####read-sms(index)

Read the message at the index location.

#####send-sms(phoneNumber, message)

Send a text message to the phoneNumber.

###Resources
While designing and developing this node.js driver for FONA the following resources were helpful:

* [Adafruit FONA Library](https://github.com/adafruit/Adafruit_FONA_Library)
* [Adafruit FONA Arduino Test](https://learn.adafruit.com/adafruit-fona-mini-gsm-gprs-cellular-phone-module/arduino-test)
* [Adafruit FONA Tethering to Raspberry Pi or BeagleBone Black](https://learn.adafruit.com/fona-tethering-to-raspberry-pi-or-beaglebone-black/overview)
* [AT Commands at M2MSupport](http://m2msupport.net/m2msupport/at-command/) 
  * Heplful site for understanding AT commands structure and responses
* [SIM 800L Hardware Design (PDF)](http://www.headele.com/Datasheet/Wireless%20module/GPRS/SIMCOM/SIM800L_Hardware_Design_V1.00.pdf)
* [Sim900 Geolocation without GPS, AT+CIPGSMLOC](http://signusx.com/sim900-geolocalization-without-gps-atcipgsmloc/)
* [BeagleBone Serial ports / UART](http://beaglebone.cameon.net/home/serial-ports-uart)

