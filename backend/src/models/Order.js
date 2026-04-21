const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(v) => v.length > 0, "Order items required"],
    },
    comment: { type: String, default: "" },

    orderType: {
      type: String,
      enum: ["dinein", "takeaway", "delivery"],
      default: "dinein",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "online"],
      default: "cash",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "cancelled"],
      default: "pending",
    },

    totalAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);