const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtemp, realpath, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { basename, dirname, join } = require("node:path");
const { createServer } = require("node:net");
const mongoose = require("mongoose");

const executable = process.env.RESERVATION_TEST_MONGOD;
test("isolated MongoDB replica set enforces reservation transactions and access rules", { skip: !executable, timeout: 90_000 }, async () => {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  const tempRoot = await realpath(tmpdir());
  const dbpath = await realpath(await mkdtemp(join(tempRoot, "cafe-booking-mongo-")));
  const url = "mongodb://127.0.0.1:" + port;
  const replica = spawn(executable, ["--bind_ip", "127.0.0.1", "--port", String(port), "--replSet", "bookingtest", "--dbpath", dbpath], { stdio: "ignore" });
  const closed = new Promise(resolve => { replica.once("close", resolve); replica.once("error", resolve); });
  const { MongoClient } = mongoose.mongo;
  const direct = new MongoClient(url + "/?directConnection=true", { serverSelectionTimeoutMS: 30_000 });
  let server;

  try {
    await direct.connect();
    await direct.db("admin").command({ replSetInitiate: {
      _id: "bookingtest", members: [{ _id: 0, host: "127.0.0.1:" + port }],
    } });
    await mongoose.connect(url + "/cafe_booking_test?replicaSet=bookingtest");
    process.env.RESERVATION_CONTACT_KEY = crypto.randomBytes(32).toString("hex");
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    process.env.ADMIN_USERNAME = "booking-test-admin";

    const service = require("../src/utils/reservations");
    const Reservation = require("../src/models/Reservation");
    const TableSlot = require("../src/models/TableSlot");
    const { signToken } = require("../src/middleware/auth");
    const express = require("express");
    await service.initializeReservations();
    const app = express();
    app.use(express.json());
    app.set("reservationsReady", true);
    app.use(require("../src/routes/reservationRoutes"));
    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bishkek" }).format(Date.now() + 86_400_000);
    const body = { day, time: "10:00", tableNumber: 1, guestCount: 2, name: "Synthetic Guest", phone: "+996700000001" };
    const admin = signToken({ role: "admin" }, process.env.ADMIN_USERNAME);
    const request = (path, method, payload, token) => fetch(base + path, {
      method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
      body: payload && JSON.stringify(payload),
    });

    const attempts = await Promise.all([
      request("/", "POST", body),
      request("/", "POST", { ...body, time: "12:00" }),
    ]);
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
    const winner = await attempts.find(response => response.ok).json();
    const id = winner.reservation.id;
    assert.equal(await Reservation.countDocuments(), 1);
    assert.equal(await TableSlot.countDocuments(), 135);
    assert.equal(winner.reservation.contact, undefined);
    assert.equal((await request("/" + id)).status, 403);
    const otherReservation = signToken({ role: "reservation" }, "000000000000000000000002");
    const orderToken = signToken({ role: "customer" }, id);
    for (const token of [otherReservation, orderToken]) {
      assert.equal((await request("/" + id, "GET", null, token)).status, 403);
    }
    const receipt = await request("/" + id, "GET", null, winner.token);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.headers.get("Cache-Control"), "no-store");
    const publicResult = await receipt.json();
    assert.equal(publicResult.status, "pending");
    assert.equal(publicResult.contact, undefined);
    assert.equal((await request("/admin/calendar?day=" + day)).status, 401);
    const calendar = await (await request("/admin/calendar?day=" + day, "GET", null, admin)).json();
    assert.equal(calendar.tables.length, 12);
    assert.deepEqual(calendar.reservations[0].contact, { name: body.name, phone: body.phone });
    const availability = await (await request("/availability?" + new URLSearchParams({ day, time: "12:00", guests: 2 }))).json();
    assert.equal(availability.tables[0].available, false);
    assert.equal(availability.tables[0].contact, undefined);
    const stored = await Reservation.findById(id).select("+contact").lean();
    assert.equal(stored.contact.includes(body.phone), false);

    await Reservation.updateOne({ _id: id }, { holdUntil: new Date(0) });
    assert.equal((await request("/admin/" + id, "PATCH", { status: "confirmed" }, admin)).status, 409);
    clearInterval(await service.maintainReservations());
    assert.equal(await TableSlot.countDocuments(), 0);
    assert.equal((await Reservation.findById(id).select("+contact").lean()).contact, undefined);
    const retried = await request("/", "POST", body);
    assert.equal(retried.status, 201);
    const fresh = await retried.json();
    assert.equal((await request("/admin/" + fresh.reservation.id, "PATCH", { status: "confirmed" }, admin)).status, 200);
    assert.equal((await request("/" + fresh.reservation.id + "/cancel", "PATCH", null, fresh.token)).status, 200);
    assert.equal(await TableSlot.countDocuments(), 0);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await mongoose.disconnect();
    await direct.close();
    replica.kill();
    await closed;
    if (dirname(dbpath) === tempRoot && basename(dbpath).startsWith("cafe-booking-mongo-")) {
      await rm(dbpath, { recursive: true, force: true });
    }
  }
});
