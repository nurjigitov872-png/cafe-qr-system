const mongoose = require("mongoose");

module.exports = mongoose.model("DeliverySettings", new mongoose.Schema({
  _id: String,
  center: { lat: Number, lng: Number },
  radiusKm: Number,
  baseFee: Number,
  feePerKm: Number,
  speedKmh: Number,
  demo: Boolean,
}, { autoCreate: false, autoIndex: false }));
