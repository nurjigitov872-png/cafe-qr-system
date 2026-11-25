const mongoose = require("mongoose");

const position = new mongoose.Schema({
  number: { type: Number, required: true },
  row: { type: Number, required: true, min: 1 },
  column: { type: Number, required: true, min: 1 },
}, { _id: false });

module.exports = mongoose.model("FloorPlan", new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  positions: [position],
  settings: {
    opensAt: { type: String, default: "09:00" },
    closesAt: { type: String, default: "23:00" },
    slotMinutes: { type: Number, default: 15 },
    durationMinutes: { type: Number, default: 120 },
    bufferMinutes: { type: Number, default: 15 },
    advanceDays: { type: Number, default: 14 },
    holdMinutes: { type: Number, default: 15 },
    timeZone: { type: String, default: "Asia/Bishkek" },
  },
}, { autoCreate: false, autoIndex: false }));
