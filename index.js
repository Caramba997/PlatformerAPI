const express = require('express'),
      userManager = require('express-user-manager');

require('dotenv').config();

var app = express();

app.post('/login', function (req, res) {
   res.send('Not implemented');
});

app.post('/register', function (req, res) {
  res.send('Not implemented');
});

var server = app.listen(process.env.port, function () {
  console.log(`App listening on port ${process.env.port}!`);
});