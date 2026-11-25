const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: "DiningTable", required: true },
  slotStart: { type: Date, required: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", required: true, index: true },
}, { autoCreate: false, autoIndex: false });
schema.index({ tableId: 1, slotStart: 1 }, { unique: true });
schema.index({ slotStart: 1 });

module.exports = mongoose.model("TableSlot", schema);
