const express = require("express");
const DiningTable = require("../models/DiningTable");
const FloorPlan = require("../models/FloorPlan");
const Reservation = require("../models/Reservation");
const TableSlot = require("../models/TableSlot");
const { requireAdmin, signToken, verifyToken } = require("../middleware/auth");
const { BookingError, dayStart, timeOptions, slotsFor } = require("../utils/bookingTime");
const { createReservation, changeReservation, expireReservations, revealContact, planKey } = require("../utils/reservations");

const router = express.Router();
const DAY = 86400_000;
const safeId = /^[a-f0-9]{24}$/i;

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!req.app.get("reservationsReady")) return res.status(503).json({ code: "unavailable" });
  next();
});

function handle(action) {
  return async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof BookingError) return res.status(error.status).json({ code: error.code });
      console.warn("Reservation request failed.");
      res.status(500).json({ code: "unavailable" });
    }
  };
}

function view(record) {
  const { _id, tableNumber, guestCount, startsAt, endsAt, status, holdUntil } = record;
  return { id: String(_id), tableNumber, guestCount, startsAt, endsAt, status, holdUntil };
}

function requireReservation(req) {
  if (!safeId.test(req.params.id)) throw new BookingError(404, "missing");
  try {
    const claims = verifyToken(req.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1]);
    if (claims.role === "reservation" && claims.sub === req.params.id) return;
  } catch { /* Invalid token. */ }
  throw new BookingError(403, "forbidden");
}

async function currentPlan() {
  return FloorPlan.findOne({ key: planKey }).lean();
}

function guests(value) {
  const count = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(count) || count < 1 || count > 100) {
    throw new BookingError(400, "invalid");
  }
  return count;
}

router.get("/availability", handle(async (req, res) => {
  const { day, time } = req.query;
  const count = guests(req.query.guests);
  const { settings, positions } = await currentPlan();
  const now = Date.now();
  const times = timeOptions(day, settings, now);
  if (time === undefined) return res.json({ times, settings });
  const { slots } = slotsFor(day, time, settings, now);
  await expireReservations();
  const blocked = new Set((await TableSlot.distinct("tableId", {
    slotStart: { $gte: slots[0], $lte: slots.at(-1) },
  })).map(String));
  const tables = await DiningTable.find({ active: true }).sort({ number: 1 }).lean();
  res.json({ times, settings, tables: tables.map(table => ({
    number: table.number, capacity: table.capacity,
    position: positions.find(position => position.number === table.number),
    available: table.capacity >= count && !blocked.has(String(table._id)),
  })) });
}));

router.post("/", handle(async (req, res) => {
  const { day, time, tableNumber, guestCount, name, phone } = req.body || {};
  const count = guests(guestCount);
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanPhone = typeof phone === "string" ? phone.trim() : "";
  if (!Number.isSafeInteger(tableNumber) || tableNumber < 1 ||
      !cleanName || cleanName.length > 80 || /[\u0000-\u001f]/.test(cleanName) ||
      !/^\+?[\d ()-]{7,24}$/.test(cleanPhone) || !/^\d{7,15}$/.test(cleanPhone.replace(/\D/g, ""))) {
    throw new BookingError(400, "invalid");
  }
  const { settings } = await currentPlan();
  const window = slotsFor(day, time, settings);
  const table = await DiningTable.findOne({ number: tableNumber, active: true, capacity: { $gte: count } }).lean();
  if (!table) throw new BookingError(409, "conflict");
  const reservation = await createReservation(table, count, window, cleanName, cleanPhone);
  res.status(201).json({ reservation: view(reservation), token: signToken({ role: "reservation" }, reservation._id) });
}));

router.get("/admin/calendar", requireAdmin, handle(async (req, res) => {
  const startsAt = dayStart(req.query.day);
  await expireReservations();
  const [plan, tables, reservations] = await Promise.all([
    currentPlan(), DiningTable.find().sort({ number: 1 }).lean(),
    Reservation.find({ startsAt: { $gte: new Date(startsAt), $lt: new Date(startsAt + DAY) } })
      .select("+contact").sort({ startsAt: 1 }).lean(),
  ]);
  res.json({ settings: plan.settings, positions: plan.positions, tables: tables.map(({ number, capacity, active }) => ({ number, capacity, active })),
    reservations: reservations.map(record => ({
      ...view(record),
      contact: +record.contactExpiresAt > Date.now() ? revealContact(record.contact) : undefined,
    })),
  });
}));

router.patch("/admin/:id", requireAdmin, handle(async (req, res) => {
  if (!safeId.test(req.params.id) || !["confirmed", "cancelled"].includes(req.body?.status)) throw new BookingError(400, "invalid");
  res.json(view(await changeReservation(req.params.id, req.body.status)));
}));

router.get("/:id", handle(async (req, res) => {
  requireReservation(req);
  await expireReservations({ _id: req.params.id });
  const reservation = await Reservation.findById(req.params.id).lean();
  if (!reservation) throw new BookingError(404, "missing");
  res.json(view(reservation));
}));

router.patch("/:id/cancel", handle(async (req, res) => {
  requireReservation(req);
  res.json(view(await changeReservation(req.params.id, "cancelled")));
}));

module.exports = router;
