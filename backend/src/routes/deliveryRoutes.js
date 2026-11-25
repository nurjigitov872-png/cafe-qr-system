const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Courier = require("../models/Courier");
const DeliverySettings = require("../models/DeliverySettings");
const { requireAdmin, requireOrderAccess, signToken, verifyToken } = require("../middleware/auth");
const { orderNow } = require("../utils/orderTiming");
const { BookingError } = require("../utils/bookingTime");
const { InvalidOrder } = require("../utils/orderPricing");
const service = require("../utils/delivery");

const router = express.Router();
const usernamePattern = /^[a-z0-9][a-z0-9_.-]{2,39}$/;
const loginAttempts = new Map();
const dummy = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!service.deliveryEnabled()) return res.sendStatus(404);
  if (!req.app.get("deliveryReady")) return res.status(503).json({ code: "unavailable" });
  next();
});
router.param("id", (req, res, next, id) => service.objectId.test(id) ? next() : res.status(404).json({ code: "missing" }));

function handle(action) {
  return async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof BookingError) return res.status(error.status).json({ code: error.code });
      if (error instanceof InvalidOrder) return res.status(400).json({ code: "invalid" });
      if (error.code === 11000) return res.status(409).json({ code: "conflict" });
      console.warn("Delivery request failed.");
      res.status(500).json({ code: "unavailable" });
    }
  };
}

function emit(req, order, kind, kitchenEvent) {
  const io = req.app.get("io");
  const signal = { orderId: String(order._id) };
  io?.to(["admin", "order:" + order._id]).emit(kind, signal);
  if (kitchenEvent) io?.to(["admin", "kitchen"]).emit(kitchenEvent, service.view(order));
}

async function courierOnly(req, res, next) {
  try {
    const claims = verifyToken(req.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1]);
    if (claims.role !== "courier" || !service.objectId.test(claims.sub) || !Number.isSafeInteger(claims.version)) return res.sendStatus(403);
    const courier = await Courier.findOne({ _id: claims.sub, active: true, sessionVersion: claims.version });
    if (!courier) return res.sendStatus(403);
    req.courier = courier;
    next();
  } catch { res.sendStatus(401); }
}

router.get("/zone", handle(async (req, res) => {
  const { center, radiusKm, demo } = await service.settings();
  res.json({ center, radiusKm, demo, gpsEnabled: service.gpsEnabled() });
}));

router.post("/quote", handle(async (req, res) => res.json(service.quote(service.position(req.body?.point), await service.settings()))));

router.post("/orders", handle(async (req, res) => {
  const { order, created } = await service.checkout(req.body, req.get("Idempotency-Key"), orderNow(req), req.app.get("restaurantOrderHours"));
  if (created) emit(req, order, "delivery:updated", "order:new");
  res.status(created ? 201 : 200).json({ order: service.view(order), orderToken: signToken({ role: "customer" }, order._id) });
}));

router.get("/orders/:id", requireOrderAccess, handle(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, channel: "delivery" }).select("+deliveryContact +deliveryGps +deliveryCode");
  if (!order) throw new BookingError(404, "missing");
  const owner = req.auth.role === "customer";
  const active = !["delivered", "cancelled"].includes(order.deliveryState);
  res.json({
    ...service.view(order),
    ...(owner && active && order.deliveryContact && { destination: service.decodeContact(order.deliveryContact).point }),
    ...(owner && ["picked_up", "en_route"].includes(order.deliveryState) && { deliveryCode: order.deliveryCode }),
    tracking: service.tracking(order, await service.settings()),
  });
}));

router.patch("/orders/:id/cancel", requireOrderAccess, handle(async (req, res) => {
  const order = await service.cancel(req.params.id, req.auth.role === "customer");
  emit(req, order, "delivery:updated", "order:updated");
  res.json(service.view(order));
}));

router.get("/admin/settings", requireAdmin, handle(async (req, res) => res.json(await service.settings())));
router.put("/admin/settings", requireAdmin, handle(async (req, res) => {
  const config = service.validateSettings(req.body);
  await DeliverySettings.updateOne({ _id: "current" }, { $set: config });
  res.json(config);
}));

router.post("/admin/provider-preview", requireAdmin, handle(async (req, res) => {
  const provider = req.body?.provider;
  if (!["internal", "yandex", "glovo"].includes(provider)) throw new BookingError(400, "invalid_provider");
  const config = await service.settings();
  res.json(service.quote(service.position(req.body?.point), config, provider));
}));

router.get("/admin/orders", requireAdmin, handle(async (req, res) => {
  const filter = req.query.state;
  const states = ["unassigned", ...service.activeStates, "delivered", "cancelled"];
  if (filter && !states.includes(filter)) throw new BookingError(400, "invalid");
  const orders = await Order.find({ channel: "delivery", ...(filter && { deliveryState: filter }) })
    .select("+deliveryGps +deliveryContact").sort({ createdAt: -1 }).limit(100);
  const config = await service.settings();
  res.json(orders.map(order => ({ ...service.view(order), tracking: service.tracking(order, config) })));
}));

router.patch("/admin/orders/:id/assign", requireAdmin, handle(async (req, res) => {
  const order = await service.assign(req.params.id, req.body?.courierId, req.body?.revision);
  emit(req, order, "delivery:updated");
  res.json(service.view(order));
}));

router.get("/admin/couriers", requireAdmin, handle(async (req, res) => {
  const [couriers, busy] = await Promise.all([Courier.find().sort({ name: 1 }), Order.distinct("courierId", { deliveryActive: true })]);
  const assigned = new Set(busy.map(String));
  res.json(couriers.map(({ _id, name, username, active }) => ({ _id, name, username, active, busy: assigned.has(String(_id)) })));
}));

async function courierInput(body, creating) {
  const name = service.text(body?.name, 80, true);
  const username = service.text(body?.username, 40, true).toLowerCase();
  if (!usernamePattern.test(username)) throw new BookingError(400, "invalid");
  const password = body?.password;
  if (creating || password) {
    if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 72) throw new BookingError(400, "invalid");
    return { name, username, passwordHash: await bcrypt.hash(password, 12) };
  }
  return { name, username };
}

router.post("/admin/couriers", requireAdmin, handle(async (req, res) => {
  const courier = await Courier.create(await courierInput(req.body, true));
  res.status(201).json({ _id: courier._id, name: courier.name, username: courier.username, active: true });
}));
router.put("/admin/couriers/:id", requireAdmin, handle(async (req, res) => {
  const update = await courierInput(req.body, false);
  const courier = await Courier.findOneAndUpdate({ _id: req.params.id, active: true }, {
    $set: update, ...(update.passwordHash && { $inc: { sessionVersion: 1 } }),
  }, { new: true });
  if (!courier) throw new BookingError(404, "missing");
  res.json({ _id: courier._id, name: courier.name, username: courier.username, active: courier.active });
}));
router.delete("/admin/couriers/:id", requireAdmin, handle(async (req, res) => {
  await mongoose.connection.transaction(async session => {
    const courier = await Courier.findOneAndUpdate({ _id: req.params.id, active: true }, {
      $set: { active: false }, $inc: { sessionVersion: 1, assignmentVersion: 1 },
    }, { session });
    if (!courier) throw new BookingError(404, "missing");
    if (await Order.exists({ courierId: courier._id, deliveryActive: true }).session(session)) throw new BookingError(409, "courier_busy");
  });
  res.sendStatus(204);
}));

router.post("/courier/login", handle(async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = req.body?.password;
  if (!usernamePattern.test(username) || typeof password !== "string" || !password || Buffer.byteLength(password) > 72) return res.sendStatus(401);
  const now = Date.now();
  for (const [key, value] of loginAttempts) if (value.until <= now) loginAttempts.delete(key);
  const attempts = loginAttempts.get(username) ?? { count: 0, until: now + 900_000 };
  if (attempts.count >= 6 || (!loginAttempts.has(username) && loginAttempts.size >= 1000)) return res.sendStatus(429);
  attempts.count++;
  loginAttempts.set(username, attempts);
  const courier = await Courier.findOne({ username, active: true }).select("+passwordHash");
  const valid = await bcrypt.compare(password, courier?.passwordHash ?? dummy);
  if (!valid || !courier) return res.sendStatus(401);
  loginAttempts.delete(username);
  res.json({ token: signToken({ role: "courier", version: courier.sessionVersion }, courier._id, "8h"), name: courier.name });
}));

router.get("/courier/orders", courierOnly, handle(async (req, res) => {
  const match = { channel: "delivery", courierId: req.courier._id };
  const [orders, delivered, cancelled] = await Promise.all([
    Order.find(match).select("+deliveryContact").sort({ deliveryActive: -1, updatedAt: -1 }).limit(100),
    Order.countDocuments({ ...match, deliveryState: "delivered" }),
    Order.countDocuments({ ...match, deliveryState: "cancelled" }),
  ]);
  res.json({
    name: req.courier.name, gpsEnabled: service.gpsEnabled(), delivered, cancelled,
    orders: orders.map(order => ({
      ...service.view(order),
      ...(order.deliveryActive && order.deliveryContact && { contact: service.decodeContact(order.deliveryContact) }),
    })),
  });
}));

router.patch("/courier/orders/:id/state", courierOnly, handle(async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : undefined;
  const order = await service.advance(req.params.id, req.courier._id, req.body?.state, code);
  emit(req, order, "delivery:updated", "order:updated");
  res.json(service.view(order));
}));

router.patch("/courier/orders/:id/gps", courierOnly, handle(async (req, res) => {
  if (!service.gpsEnabled()) return res.sendStatus(404);
  const point = service.position(req.body);
  const now = new Date();
  const active = {
    _id: req.params.id, channel: "delivery", courierId: req.courier._id, deliveryActive: true, deliveryState: "en_route",
  };
  const intervalMs = 4_000;
  const order = await Order.findOneAndUpdate({
    ...active, $or: [
      { deliveryGps: { $exists: false } }, { "deliveryGps.updatedAt": { $lte: new Date(+now - intervalMs) } },
    ],
  }, { $set: { deliveryGps: { ...point, updatedAt: now } } }, { new: true, timestamps: false });
  if (!order) {
    if (!(await Order.exists(active))) throw new BookingError(409, "tracking_inactive");
    res.set("Retry-After", String(intervalMs / 1000));
    throw new BookingError(429, "gps_rate_limited");
  }
  emit(req, order, "delivery:gps");
  res.sendStatus(204);
}));

module.exports = router;
