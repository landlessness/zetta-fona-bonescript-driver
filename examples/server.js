var zetta = require('zetta');
var FONA = require('../index');
var app = require('./app');

zetta()
  .use(FONA, '/dev/ttyO1', 'P9_23', 'epc.tmobile.com')
  .use(app)
  .listen(1337);
