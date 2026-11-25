const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Courier = require("../models/Courier");
const DeliverySettings = require("../models/DeliverySettings");
const { priceOrder } = require("./orderPricing");
const { requireOpenRestaurant } = require("./orderTiming");
const { BookingError } = require("./bookingTime");
const { deliveryProviders, distanceKm } = require("./deliveryProviders");

const deliveryEnabled = () => process.env.APP_ENV === "staging" && process.env.DELIVERY_ENABLED === "true";
const gpsEnabled = () => deliveryEnabled() && process.env.DELIVERY_GPS_ENABLED === "true";
const objectId = /^[a-f0-9]{24}$/i;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const activeStates = ["assigned", "accepted", "picked_up", "en_route"];
const defaults = {
  center: { lat: 42.8746, lng: 74.5698 }, radiusKm: 8, baseFee: 100, feePerKm: 15, speedKmh: 20, demo: true,
};

function key() {
  const value = process.env.DELIVERY_CONTACT_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Invalid delivery contact key");
  return Buffer.from(value, "hex");
}

async function initializeDelivery() {
  key();
  for (const model of [Courier, DeliverySettings]) {
    try { await model.createCollection(); } catch (error) { if (error.code !== 48) throw error; }
    await model.createIndexes();
  }
  await Order.collection.createIndex({ deliveryRequestKey: 1 }, { unique: true, sparse: true });
  await Order.collection.createIndex({ deliveryCode: 1 }, { unique: true, sparse: true });
  await Order.collection.createIndex({ courierId: 1 }, { unique: true, partialFilterExpression: {
    deliveryActive: true, courierId: { $type: "objectId" },
  } });
  await Order.collection.createIndex({ channel: 1, createdAt: -1 });
  await mongoose.connection.transaction(async session => {
    await DeliverySettings.updateOne({ _id: "current" }, { $setOnInsert: defaults }, { upsert: true, session });
  });
}

async function settings() {
  return DeliverySettings.findById("current").lean();
}

function position(value) {
  const { lat, lng } = value || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new BookingError(400, "invalid_position");
  }
  return { lat, lng };
}

function quote(point, config, provider = "internal") {
  const distance = distanceKm(config.center, point);
  if (distance > config.radiusKm) throw new BookingError(422, "outside_zone");
  const preview = deliveryProviders[provider];
  if (!preview) throw new BookingError(400, "invalid_provider");
  return {
    ...preview.estimate(config.center, point, config.speedKmh),
    deliveryFee: Math.round((config.baseFee + distance * config.feePerKm) * 100) / 100,
    demo: Boolean(config.demo || preview.dispatch === "demo"), provider,
  };
}

function validateSettings(body) {
  const { radiusKm, baseFee, feePerKm, speedKmh, demo } = body || {};
  const inRange = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  if (!inRange(radiusKm, 1, 100) || !inRange(baseFee, 0, 10000) ||
      !inRange(feePerKm, 0, 1000) || !inRange(speedKmh, 5, 100) || typeof demo !== "boolean") {
    throw new BookingError(400, "invalid_settings");
  }
  return { center: position(body.center), radiusKm, baseFee, feePerKm, speedKmh, demo };
}

function text(value, max, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new BookingError(400, "invalid");
  const cleaned = value.trim();
  if (cleaned.length > max || (required && !cleaned) || /[\u0000-\u001f]/.test(cleaned)) throw new BookingError(400, "invalid");
  return cleaned;
}

function contactInput(body) {
  const phone = text(body.phone, 24, true).replace(/[ ()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone)) throw new BookingError(400, "invalid");
  return {
    name: text(body.name, 80, true), phone, address: text(body.address, 180, true),
    house: text(body.house, 35, true), apartment: text(body.apartment, 35),
    entrance: text(body.entrance, 35), comment: text(body.comment, 300), point: position(body.point),
  };
}

function encodeContact(contact) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(contact), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decodeContact(value) {
  const data = Buffer.from(value, "base64");
  const cipher = crypto.createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8"));
}

const hash = (purpose, value) => crypto.createHmac("sha256", key()).update(purpose + "\0" + value).digest("hex");
const canonical = value => JSON.stringify(value, (_, current) => current && typeof current === "object" && !Array.isArray(current)
  ? Object.fromEntries(Object.entries(current).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : current);

async function checkout(body, requestId, now, hours) {
  if (!uuid.test(requestId || "") || !Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 100) {
    throw new BookingError(400, "invalid");
  }
  const contact = contactInput(body);
  const items = body.items.map(item => ({ productId: item?.productId, qty: item?.qty, selectedOptions: item?.selectedOptions ?? {} }));
  const deliveryRequestKey = hash("request", requestId.toLowerCase());
  const deliveryFingerprint = hash("checkout", canonical({ items, contact }));
  async function replay() {
    const existing = await Order.findOne({ deliveryRequestKey }).select("+deliveryFingerprint");
    if (!existing) return null;
    if (existing.deliveryFingerprint !== deliveryFingerprint) throw new BookingError(409, "idempotency_conflict");
    return { order: existing, created: false };
  }
  const existing = await replay();
  if (existing) return existing;
  requireOpenRestaurant(now, hours);
  const { deliveryFee, distanceKm, deliveryMinutes, demo } = quote(contact.point, await settings());
  const priced = await priceOrder(items);
  const totalAmount = (Math.round(priced.totalAmount * 100) + Math.round(deliveryFee * 100)) / 100;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await Order.create({
        ...priced, totalAmount, orderType: "delivery", channel: "delivery", deliveryState: "unassigned",
        deliveryProvider: "internal", deliveryFee, deliveryDistanceKm: distanceKm, deliveryMinutes, deliveryDemo: demo,
        deliveryRevision: 0, deliveryRequestKey, deliveryFingerprint, deliveryContact: encodeContact(contact),
        deliveryCode: crypto.randomBytes(6).toString("hex").toUpperCase(),
      });
      return { order, created: true };
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await replay();
      if (winner) return winner;
      if (!error.keyPattern?.deliveryCode) throw error;
    }
  }
  throw new Error("Delivery code allocation failed");
}

function view(order) {
  const { _id, items, orderType, channel, status, paymentMethod, paymentStatus, totalAmount, estimatedReadyAt,
    estimatedPrepMinutes, deliveryState, deliveryProvider, deliveryFee, deliveryDistanceKm, deliveryMinutes,
    deliveryDemo, deliveryRevision, courierId, createdAt, updatedAt } = order;
  return { _id, items, orderType, channel, status, paymentMethod, paymentStatus, totalAmount, estimatedReadyAt,
    estimatedPrepMinutes, deliveryState, deliveryProvider, deliveryFee, deliveryDistanceKm, deliveryMinutes,
    deliveryDemo, deliveryRevision, courierId, createdAt, updatedAt };
}

function tracking(order, config) {
  if (!gpsEnabled() || order.deliveryState !== "en_route" || !order.deliveryGps) return undefined;
  const { lat, lng, updatedAt } = order.deliveryGps;
  const point = { lat, lng };
  const destination = decodeContact(order.deliveryContact).point;
  return { ...point, updatedAt, ...deliveryProviders.internal.estimate(point, destination, config.speedKmh) };
}

async function assign(id, courierId, revision) {
  if (!objectId.test(id) || !objectId.test(courierId || "") || !Number.isSafeInteger(revision)) throw new BookingError(400, "invalid");
  try {
    return await mongoose.connection.transaction(async session => {
      const courier = await Courier.findOneAndUpdate({ _id: courierId, active: true }, {
        $inc: { assignmentVersion: 1 },
      }, { session });
      if (!courier) throw new BookingError(409, "courier_unavailable");
      const order = await Order.findOneAndUpdate({
        _id: id, channel: "delivery", deliveryRevision: revision, deliveryState: { $in: ["unassigned", "assigned", "accepted"] },
      }, { $set: { courierId, deliveryState: "assigned", deliveryActive: true }, $inc: { deliveryRevision: 1 } },
      { session, new: true });
      if (!order) throw new BookingError(409, "conflict");
      return order;
    });
  } catch (error) {
    if (error.code === 11000) throw new BookingError(409, "courier_busy");
    throw error;
  }
}

async function cancel(id, ownerOnly) {
  const order = await Order.findOneAndUpdate({
    _id: id, channel: "delivery",
    deliveryState: { $in: ownerOnly ? ["unassigned"] : ["unassigned", "assigned", "accepted", "picked_up", "en_route"] },
    ...(ownerOnly && { status: "pending" }),
  }, { $set: { status: "cancelled", deliveryState: "cancelled", deliveryActive: false },
    $unset: { deliveryContact: 1, deliveryGps: 1 }, $inc: { deliveryRevision: 1 } }, { new: true });
  if (!order) throw new BookingError(409, "conflict");
  return order;
}

async function advance(id, courierId, next, code) {
  const transitions = { accepted: "assigned", picked_up: "accepted", en_route: "picked_up", delivered: "en_route" };
  const previous = Object.hasOwn(transitions, next) ? transitions[next] : undefined;
  if (!previous) throw new BookingError(400, "invalid_transition");
  const base = { _id: id, channel: "delivery", courierId, deliveryActive: true, deliveryState: previous,
    ...(next === "picked_up" && { status: "ready" }) };
  const delivered = next === "delivered";
  const now = new Date();
  const open = { $or: [{ deliveryCodeAttempts: { $exists: false } }, { deliveryCodeAttempts: { $lt: 5 } },
    { deliveryCodeAttemptUntil: { $lte: now } }] };
  if (delivered && !/^[A-F0-9]{12}$/.test(code || "")) throw new BookingError(400, "invalid_code");
  const order = await Order.findOneAndUpdate({
    ...base, ...(delivered && { ...open, deliveryCode: code }),
  }, { $set: { deliveryState: next, ...(delivered && { deliveryActive: false, status: "served", deliveredAt: now }) },
    $inc: { deliveryRevision: 1 }, ...(delivered && { $unset: {
      deliveryContact: 1, deliveryGps: 1, deliveryCodeAttempts: 1, deliveryCodeAttemptUntil: 1,
    } }) }, { new: true });
  if (order) return order;
  if (delivered) {
    const failed = await Order.findOneAndUpdate({ ...base, ...open, deliveryCode: { $ne: code } },
      [{ $set: {
        deliveryCodeAttempts: { $cond: [{ $gt: ["$deliveryCodeAttemptUntil", now] },
          { $add: [{ $ifNull: ["$deliveryCodeAttempts", 0] }, 1] }, 1] },
        deliveryCodeAttemptUntil: new Date(+now + 900_000),
      } }], { new: true }).select("+deliveryCodeAttempts");
    if (failed?.deliveryCodeAttempts >= 5 || (!failed && await Order.exists({
      ...base, deliveryCodeAttempts: { $gte: 5 }, deliveryCodeAttemptUntil: { $gt: now },
    }))) throw new BookingError(429, "code_locked");
  }
  throw new BookingError(409, "conflict");
}

module.exports = { deliveryEnabled, gpsEnabled, objectId, activeStates, initializeDelivery, settings, validateSettings,
  position, quote, checkout, view, tracking, assign, cancel, advance, decodeContact, text };
