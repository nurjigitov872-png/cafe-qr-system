const crypto = require("node:crypto");
const Order = require("../models/Order");
const { BookingError, timeOptions } = require("./bookingTime");
const { priceOrder } = require("./orderPricing");
const { requireOpenRestaurant } = require("./orderTiming");

const schedule = { opensAt: "09:00", closesAt: "23:00", advanceDays: 14, slotMinutes: 15, durationMinutes: 15, bufferMinutes: 0 };
const leadTime = 15 * 60_000;
const pickupEnabled = () => process.env.APP_ENV === "staging" && process.env.PICKUP_ENABLED === "true";
const pickupTimes = (day, now = Date.now()) => timeOptions(day, schedule, now + leadTime);

function key() {
  const secret = process.env.PICKUP_CONTACT_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error("Pickup contact key is missing or invalid");
  return Buffer.from(secret, "hex");
}

const digest = (purpose, value) => crypto.createHmac("sha256", key()).update(purpose + "\0" + value).digest("hex");

function encryptContact(contact) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(contact), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

function revealPickupContact(value) {
  const data = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}

async function initializePickup() {
  key();
  await Order.collection.createIndex({ pickupRequestKey: 1 }, { unique: true, sparse: true });
  await Order.collection.createIndex({ pickupCode: 1 }, { unique: true, sparse: true });
}

function checkoutInput(body, requestKey) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestKey || "")) {
    throw new BookingError(400, "invalid");
  }
  const { items, name, phone, comment } = body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanPhone = typeof phone === "string" && /^\+?[\d ()-]{7,24}$/.test(phone.trim()) ? phone.replace(/[^+\d]/g, "") : "";
  if (!cleanName || cleanName.length > 80 || /[\u0000-\u001f]/.test(cleanName) ||
      !/^\+?\d{7,15}$/.test(cleanPhone) || !Array.isArray(items) || items.length < 1 || items.length > 100 ||
      (comment !== undefined && (typeof comment !== "string" || comment.length > 600))) throw new BookingError(400, "invalid");
  const selectedItems = items.map(item => ({
    productId: item?.productId, qty: item?.qty,
    selectedOptions: item?.selectedOptions ?? {},
  }));
  return { items: selectedItems, contact: { name: cleanName, phone: cleanPhone }, comment: comment || "" };
}

function pickupOrderView(order, includeReadyCode = false) {
  const { _id, items, comment, orderType, channel, scheduledFor, estimatedPrepMinutes, estimatedReadyAt, paymentMethod, paymentStatus, status, totalAmount, createdAt, updatedAt } = order;
  const view = { _id, items, comment, orderType, channel, scheduledFor, estimatedPrepMinutes, estimatedReadyAt, paymentMethod, paymentStatus, status, totalAmount, createdAt, updatedAt };
  if (includeReadyCode && status === "ready") view.pickupCode = order.pickupCode;
  return view;
}

async function createPickup(body, requestKey, now = Date.now(), orderHours) {
  const input = checkoutInput(body, requestKey);
  const pickupRequestKey = digest("pickup-request", requestKey.toLowerCase());
  const fingerprintFor = value => digest("pickup-payload", JSON.stringify(value, (_, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
      : value));
  const fingerprint = fingerprintFor(input);
  const legacyFingerprint = typeof body?.day === "string" && typeof body?.time === "string"
    ? fingerprintFor({ ...input, day: body.day, time: body.time }) : null;
  async function replay() {
    const existing = await Order.findOne({ pickupRequestKey }).select("+pickupFingerprint");
    if (!existing) return null;
    if (![fingerprint, legacyFingerprint].includes(existing.pickupFingerprint)) throw new BookingError(409, "idempotency_conflict");
    return { order: existing, created: false };
  }
  const existing = await replay();
  if (existing) return existing;
  requireOpenRestaurant(now, orderHours);
  const priced = await priceOrder(input.items);
  const pickupContact = encryptContact(input.contact);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pickupCode = crypto.randomBytes(5).toString("hex").toUpperCase();
      const order = await Order.create({
        ...priced, orderType: "takeaway", channel: "pickup", comment: input.comment,
        paymentMethod: "cash", paymentStatus: "pending", status: "pending",
        pickupContact, pickupRequestKey, pickupFingerprint: fingerprint, pickupCode,
      });
      return { order, created: true };
    } catch (error) {
      if (error.code !== 11000) throw error;
      const repeated = await replay();
      if (repeated) return repeated;
      if (!error.keyPattern?.pickupCode) throw error;
    }
  }
  throw new Error("Unable to allocate pickup code");
}

const maxAttempts = 5;
const attemptWindowMs = 15 * 60_000;

async function collectPickup(id, code) {
  const now = new Date();
  const ready = { _id: id, channel: "pickup", status: "ready" };
  const unlocked = { $or: [
    { pickupAttempts: { $exists: false } },
    { pickupAttempts: { $lt: maxAttempts } },
    { pickupAttemptUntil: { $lte: now } },
  ] };

  const order = await Order.findOneAndUpdate(
    { ...ready, ...unlocked, pickupCode: code },
    { $set: { status: "served" }, $unset: { pickupContact: 1, pickupAttempts: 1, pickupAttemptUntil: 1 } },
    { new: true },
  );
  if (order) return order;

  const failed = await Order.findOneAndUpdate(
    { ...ready, ...unlocked, pickupCode: { $ne: code } },
    [{ $set: {
      pickupAttempts: { $cond: [
        { $gt: ["$pickupAttemptUntil", now] },
        { $add: [{ $ifNull: ["$pickupAttempts", 0] }, 1] },
        1,
      ] },
      pickupAttemptUntil: new Date(+now + attemptWindowMs),
    } }],
    { new: true },
  ).select("+pickupAttempts");
  if (failed?.pickupAttempts >= maxAttempts || (!failed && await Order.exists({
    ...ready, pickupAttempts: { $gte: maxAttempts }, pickupAttemptUntil: { $gt: now },
  }))) throw new BookingError(429, "pickup_code_locked");
  throw new BookingError(409, "conflict");
}

module.exports = { collectPickup, pickupEnabled, pickupTimes, initializePickup, createPickup, pickupOrderView, revealPickupContact };
