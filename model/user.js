const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String },
  createdLevels: { type: [String] },
  savedLevels: { type: [String] },
}, {
  collection: 'users'
});

module.exports = mongoose.model("user", userSchema);