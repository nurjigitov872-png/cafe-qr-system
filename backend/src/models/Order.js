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
    tableNumber: { type: Number, required() { return !["pickup", "delivery"].includes(this.channel); }, default() { return ["pickup", "delivery"].includes(this.channel) ? undefined : 1; } },
    channel: { type: String, enum: ["pickup", "delivery"] },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: "Courier" },
    deliveryState: String,
    deliveryProvider: String,
    deliveryFee: Number,
    deliveryDistanceKm: Number,
    deliveryMinutes: Number,
    deliveryDemo: Boolean,
    deliveryRevision: Number,
    deliveryActive: Boolean,
    deliveredAt: Date,
    deliveryContact: { type: String, select: false },
    deliveryCode: { type: String, select: false },
    deliveryCodeAttempts: { type: Number, select: false },
    deliveryCodeAttemptUntil: { type: Date, select: false },
    deliveryRequestKey: { type: String, select: false },
    deliveryFingerprint: { type: String, select: false },
    deliveryGps: { type: new mongoose.Schema({ lat: Number, lng: Number, updatedAt: Date }, { _id: false }), select: false },
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