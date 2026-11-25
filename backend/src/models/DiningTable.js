const mongoose = require("mongoose");

module.exports = mongoose.model("DiningTable", new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  capacity: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true },
}, { autoCreate: false, autoIndex: false }));
