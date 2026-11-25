const mongoose = require("mongoose");
const crypto = require("node:crypto");
const DiningTable = require("../models/DiningTable");
const FloorPlan = require("../models/FloorPlan");
const Reservation = require("../models/Reservation");
const TableSlot = require("../models/TableSlot");
const { BookingError } = require("./bookingTime");

const planKey = "restaurant";
const defaultTables = [2,2,2,4,4,4,4,4,4,6,6,8];
const contactRetentionMs = 30 * 86400_000;

function contactKey() {
  const key = process.env.RESERVATION_CONTACT_KEY || "";
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("Invalid reservation contact key");
  return Buffer.from(key, "hex");
}

function encryptContact(name, phone) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", contactKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ name, phone }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function revealContact(value) {
  if (!value) return undefined;
  const bytes = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", contactKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}

async function initializeReservations() {
  contactKey();
  for (const model of [DiningTable, FloorPlan, Reservation, TableSlot]) {
    try { await model.createCollection(); }
    catch (error) { if (error.code !== 48) throw error; }
    await model.createIndexes();
  }
  const indexes = await TableSlot.collection.indexes();
  if (!indexes.some(index => index.unique === true && !index.partialFilterExpression && !index.sparse &&
      Object.keys(index.key).join(",") === "tableId,slotStart" && index.key.tableId === 1 && index.key.slotStart === 1)) {
    throw new Error("Missing unique table slot index");
  }
  await mongoose.connection.transaction(async session => {
    await DiningTable.bulkWrite(defaultTables.map((capacity, index) => ({
      updateOne: { filter: { number: index + 1 }, update: { $setOnInsert: { capacity, active: true } }, upsert: true },
    })), { session, ordered: true });
    await FloorPlan.updateOne({ key: planKey }, { $setOnInsert: {
      positions: defaultTables.map((_, index) => ({ number: index + 1, row: Math.floor(index / 4) + 1, column: index % 4 + 1 })),
    } }, { session, upsert: true, setDefaultsOnInsert: true });
  });
}

async function expireReservations(filter = {}) {
  const now = new Date();
  const candidates = await Reservation.find({ ...filter, status: "pending", holdUntil: { $lte: now } }).select("_id").limit(100).lean();
  for (const candidate of candidates) {
    await mongoose.connection.transaction(async session => {
      const expired = await Reservation.findOneAndUpdate(
        { _id: candidate._id, status: "pending", holdUntil: { $lte: now } },
        { $set: { status: "expired" }, $unset: { contact: 1 } }, { session },
      );
      if (expired) await TableSlot.deleteMany({ reservationId: candidate._id }, { session });
    });
  }
}

async function maintainReservations() {
  let running = false;
  async function maintainOnce() {
    if (running) return;
    running = true;
    try {
      await expireReservations();
      const now = new Date();
      await TableSlot.deleteMany({ slotStart: { $lt: now } });
      await Reservation.updateMany({ contactExpiresAt: { $lte: now }, contact: { $exists: true } }, { $unset: { contact: 1 } });
    } finally { running = false; }
  }
  await maintainOnce();
  const timer = setInterval(() => {
    maintainOnce().catch(() => console.warn("Reservation maintenance failed."));
  }, 60_000);
  timer.unref();
  return timer;
}

async function createReservation(table, guestCount, window, name, phone) {
  const { startsAt, endsAt, holdUntil, slots } = window;
  const contact = encryptContact(name, phone);
  await expireReservations({ tableId: table._id });
  try {
    return await mongoose.connection.transaction(async session => {
      if (+holdUntil <= Date.now()) throw new BookingError(409, "conflict");
      const [reservation] = await Reservation.create([{
        tableId: table._id, tableNumber: table.number, guestCount, startsAt, endsAt, holdUntil,
        status: "pending", contact, contactExpiresAt: new Date(+endsAt + contactRetentionMs),
      }], { session });
      await TableSlot.insertMany(slots.map(slotStart => ({
        tableId: table._id, slotStart, reservationId: reservation._id,
      })), { session, ordered: true });
      return reservation;
    });
  } catch (error) {
    if (error.code === 11000) throw new BookingError(409, "conflict");
    throw error;
  }
}

async function changeReservation(id, status) {
  return mongoose.connection.transaction(async session => {
    const now = new Date();
    const filter = status === "confirmed"
      ? { status: "pending", holdUntil: { $gt: now } }
      : { status: { $in: ["pending", "confirmed"] }, startsAt: { $gt: now } };
    const update = status === "cancelled" ? { $set: { status }, $unset: { contact: 1 } } : { $set: { status } };
    const reservation = await Reservation.findOneAndUpdate({ _id: id, ...filter }, update, { new: true, session });
    if (!reservation) throw new BookingError(409, "conflict");
    if (status === "cancelled") await TableSlot.deleteMany({ reservationId: id }, { session });
    return reservation;
  });
}

module.exports = { initializeReservations, maintainReservations, expireReservations, createReservation, changeReservation, revealContact, planKey };
