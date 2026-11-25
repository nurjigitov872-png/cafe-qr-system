const mongoose = require("mongoose");

module.exports = mongoose.model("Courier", new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0 },
  assignmentVersion: { type: Number, default: 0 },
}, { timestamps: true, autoCreate: false, autoIndex: false }));
