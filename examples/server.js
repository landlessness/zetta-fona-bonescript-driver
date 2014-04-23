var zetta = require('zetta');
var Fona = require('../index');
var app = require('./app');

zetta()
  .use(Fona, '/dev/ttyO4')
  .use(app)
  .listen(1337);
