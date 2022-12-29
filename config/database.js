const mongoose = require("mongoose");

const { DB_URL } = process.env;

module.exports.connect = () => {
  mongoose.set('strictQuery', false);
  // Connecting to the database
  mongoose.connect(DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.info("Successfully connected to database");
  }).catch((error) => {
    console.warn("Database connection failed. Exiting now...");
    console.error(error);
    process.exit(1);
  });
};