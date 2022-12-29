const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema({
  json: { type: String },
  creator: { type: String },
  thumbnail: { type: String },
  version: { type: Number },
  createdAt: { type: Date },
  lastModified: { type: Date }
}, {
  collection: 'levels'
});

module.exports = mongoose.model("level", levelSchema);