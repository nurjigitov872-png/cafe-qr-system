const express = require("express");
const Order = require("../models/Order");
const { requireAdmin, signToken } = require("../middleware/auth");
const { BookingError } = require("../utils/bookingTime");
const { orderNow } = require("../utils/orderTiming");
const { InvalidOrder } = require("../utils/orderPricing");
const { pickupEnabled, pickupTimes, createPickup, collectPickup, pickupOrderView, revealPickupContact } = require("../utils/pickup");

const router = express.Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!pickupEnabled()) return res.sendStatus(404);
  if (!req.app.get("pickupReady")) return res.status(503).json({ code: "unavailable" });
  next();
});

function handle(action) {
  return async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof BookingError) {
      if (error.status === 429) res.set("Retry-After", "900");
      return res.status(error.status).json({ code: error.code });
    }
      if (error instanceof InvalidOrder) return res.status(400).json({ code: "invalid" });
      console.warn("Pickup request failed.");
      res.status(500).json({ code: "unavailable" });
    }
  };
}

async function publish(req, kind, order) {
  const io = req.app.get("io");
  io?.to(["admin", "kitchen"]).emit(kind === "order.new" ? "order:new" : "order:updated", order);
  await req.app.get("notifications")?.publish(kind, order);
}

router.get("/times", handle(async (req, res) => res.json({ times: pickupTimes(req.query.day) })));

router.post("/", handle(async (req, res) => {
  const { order, created } = await createPickup(
    req.body, req.get("Idempotency-Key"), orderNow(req), req.app.get("restaurantOrderHours"),
  );
  const view = pickupOrderView(order);
  if (created) await publish(req, "order.new", view);
  res.status(created ? 201 : 200).json({ order: view, orderToken: signToken({ role: "customer" }, order._id) });
}));

router.get("/:id/contact", requireAdmin, handle(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw new BookingError(400, "invalid");
  const order = await Order.findOne({
    _id: req.params.id, channel: "pickup", status: { $in: ["pending", "preparing", "ready"] },
  }).select("+pickupContact");
  if (!order?.pickupContact) throw new BookingError(404, "missing");
  res.json(revealPickupContact(order.pickupContact));
}));

router.patch("/:id/collect", requireAdmin, handle(async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!/^[A-F0-9]{10}$/.test(code) || !/^[a-f0-9]{24}$/i.test(req.params.id)) throw new BookingError(400, "invalid");
  const order = await collectPickup(req.params.id, code);
  const view = pickupOrderView(order);
  await publish(req, "order.status", view);
  res.json(view);
}));

module.exports = router;
