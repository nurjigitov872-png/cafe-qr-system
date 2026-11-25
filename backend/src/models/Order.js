const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    qty: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    selectedOptions: { type: Object, default: {} },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required() { return this.channel !== "pickup"; }, default() { return this.channel === "pickup" ? undefined : 1; } },
    channel: { type: String, enum: ["pickup"] },
    scheduledFor: Date,
    estimatedPrepMinutes: Number,
    estimatedReadyAt: Date,
    pickupContact: { type: String, select: false },
    pickupRequestKey: { type: String, select: false },
    pickupFingerprint: { type: String, select: false },
    pickupCode: { type: String, select: false },
    pickupAttempts: { type: Number, select: false },
    pickupAttemptUntil: { type: Date, select: false },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(v) => Array.isArray(v) && v.length > 0, "Order items required"],
    },
    comment: { type: String, default: "" },
    orderType: {
      type: String,
      enum: ["dinein", "takeaway", "delivery"],
      default: "dinein",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "online", "card_online"],
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
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);