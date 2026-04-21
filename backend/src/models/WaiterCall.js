const mongoose = require("mongoose");

const waiterCallSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "done"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WaiterCall", waiterCallSchema);