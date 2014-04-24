var zetta = require('zetta');
var SerialDevice = require('zetta-serial-device-driver');
var FONAScout = require('../index');
var app = require('./app');

//   .use(FONA, 'P9_23', 'epc.tmobile.com')

zetta()
  .use(SerialDevice, '/dev/ttyO1')
  .use(FONAScout, 'P9_23', 'epc.tmobile.com')
  .use(app)
  .listen(1337);
