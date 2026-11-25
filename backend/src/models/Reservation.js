const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: "DiningTable", required: true },
  tableNumber: { type: Number, required: true },
  guestCount: { type: Number, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ["pending", "confirmed", "cancelled", "expired"], required: true },
  holdUntil: { type: Date, required: true },
  contact: { type: String, select: false },
  contactExpiresAt: { type: Date, required: true },
}, { timestamps: true, autoCreate: false, autoIndex: false });
schema.index({ status: 1, holdUntil: 1 });
schema.index({ startsAt: 1 });
schema.index({ contactExpiresAt: 1 });

module.exports = mongoose.model("Reservation", schema);
