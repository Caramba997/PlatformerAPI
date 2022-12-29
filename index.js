const http = require('http'),
      app = require('./app'),
      server = http.createServer(app);

require('dotenv').config();

server.listen(process.env.PORT, () => {
  console.info(`App listening on port ${process.env.PORT}`);
});