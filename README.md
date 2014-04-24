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

###Design
While designing and developing this node.js driver for FONA the following resources were helpful:

* [Adafruit FONA Library](https://github.com/adafruit/Adafruit_FONA_Library)
* [AT Commands at M2MSupport](http://m2msupport.net/m2msupport/at-command/) 
  * Heplful site for understanding AT commands structure and responses