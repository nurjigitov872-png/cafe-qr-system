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
test("isolated MongoDB enforces reservation and pickup concurrency, access and order rules", { skip: !executable, timeout: 90_000 }, async () => {
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

    const Order = require("../src/models/Order");
    const Product = require("../src/models/Product");
    process.env.APP_ENV = "staging";
    process.env.PICKUP_ENABLED = "true";
    process.env.PICKUP_CONTACT_KEY = crypto.randomBytes(32).toString("hex");
    await require("../src/utils/pickup").initializePickup();
    const events = [];
    const socketEvents = [];
    const pickupApp = express();
    pickupApp.use(express.json());
    pickupApp.set("pickupReady", true);
    pickupApp.set("io", { to: rooms => ({ emit: (event, payload) => socketEvents.push({ rooms, event, payload }) }) });
    pickupApp.set("notifications", { publish: (kind, order) => events.push({ kind, order }) });
    pickupApp.use("/pickup", require("../src/routes/pickupRoutes"));
    pickupApp.use("/orders", require("../src/routes/orderRoutes"));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    server = pickupApp.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const pickupBase = "http://127.0.0.1:" + server.address().port;
    const stagingAdmin = signToken({ role: "admin" }, process.env.ADMIN_USERNAME);
    const product = await Product.create({ name: "Synthetic meal", price: 55, discountPrice: 45, category: "Tests" });
    const checkout = { ...body, time: "10:00", paymentStatus: "paid", totalAmount: 1, items: [{ productId: String(product._id), qty: 2, price: 1 }] };
    const key = crypto.randomUUID();
    const call = (path, method = "GET", payload, token, requestKey) => fetch(pickupBase + path, {
      method, headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: "Bearer " + token }),
        ...(requestKey && { "Idempotency-Key": requestKey }),
      }, body: payload && JSON.stringify(payload),
    });
    const [first, retry] = await Promise.all([
      call("/pickup", "POST", checkout, null, key), call("/pickup", "POST", checkout, null, key),
    ]);
    assert.deepEqual([first.status, retry.status].sort(), [200, 201]);
    const accepted = await first.json();
    const orderId = accepted.order._id;
    assert.equal((await retry.json()).order._id, orderId);
    assert.equal(await Order.countDocuments(), 1);
    assert.equal(accepted.order.tableNumber, undefined);
    assert.equal(accepted.order.totalAmount, 90);
    assert.equal(accepted.order.paymentStatus, "pending");
    assert.equal(accepted.order.pickupCode, undefined);
    const persisted = await Order.findById(orderId).select("+pickupContact +pickupCode").lean();
    assert.equal(persisted.tableNumber, undefined);
    assert.ok(!persisted.pickupContact.includes(body.phone));
    assert.equal(events.filter(event => event.kind === "order.new").length, 1);
    assert.equal(events[0].order.pickupCode, undefined);
    assert.equal(events[0].order.pickupContact, undefined);
    assert.equal((await call("/pickup", "POST", { ...checkout, name: "Different" }, null, key)).status, 409);
    assert.equal((await call("/pickup/" + orderId + "/contact", "GET", null, accepted.orderToken)).status, 403);
    assert.equal((await (await call("/pickup/" + orderId + "/contact", "GET", null, stagingAdmin)).json()).phone, body.phone);
    const updatePath = "/orders/" + orderId + "/status";
    assert.equal((await call(updatePath, "PATCH", { status: "served" }, stagingAdmin)).status, 409);
    const collect = "/pickup/" + orderId + "/collect";
    assert.equal((await call(collect, "PATCH", { code: persisted.pickupCode }, stagingAdmin)).status, 409);
    for (const status of ["preparing", "ready"]) assert.equal((await call(updatePath, "PATCH", { status }, stagingAdmin)).status, 200);
    const tracking = await call("/orders/" + orderId, "GET", null, accepted.orderToken);
    assert.equal(tracking.headers.get("Cache-Control"), "no-store");
    const ready = await tracking.json();
    assert.equal(ready.pickupCode, persisted.pickupCode);
    assert.equal((await (await call("/orders/" + orderId, "GET", null, stagingAdmin)).json()).pickupCode, undefined);
    const otherOrder = signToken({ role: "customer" }, "000000000000000000000002");
    assert.equal((await call("/orders/" + orderId, "GET", null, otherOrder)).status, 403);
    assert.equal((await call(collect, "PATCH", { code: ready.pickupCode }, accepted.orderToken)).status, 403);
    const wrongCode = ready.pickupCode === "0000000000" ? "FFFFFFFFFF" : "0000000000";
    const guesses = await Promise.all(Array.from({ length: 5 }, () => call(collect, "PATCH", { code: wrongCode }, stagingAdmin)));
    assert.deepEqual(guesses.map(response => response.status).sort(), [409, 409, 409, 409, 429]);
    const locked = await call(collect, "PATCH", { code: ready.pickupCode }, stagingAdmin);
    assert.equal(locked.status, 429);
    assert.equal(locked.headers.get("Retry-After"), "900");
    await Order.updateOne({ _id: orderId }, { pickupAttemptUntil: new Date(0) });
    const collections = await Promise.all(Array.from({ length: 2 }, () => call(collect, "PATCH", { code: ready.pickupCode }, stagingAdmin)));
    assert.deepEqual(collections.map(response => response.status).sort(), [200, 409]);
    const listing = await (await call("/orders", "GET", null, stagingAdmin)).json();
    assert.equal(listing[0].pickupCode, undefined);
    assert.equal(listing[0].pickupContact, undefined);
    assert.ok(socketEvents.some(event => event.event === "order:new"));
    assert.ok(socketEvents.some(event => event.payload.status === "ready"));
    assert.ok(socketEvents.some(event => event.payload.status === "served"));
    for (const event of socketEvents) {
      assert.deepEqual(event.rooms, ["admin", "kitchen"]);
      const serialized = JSON.stringify(event.payload);
      for (const value of ["pickupContact", "pickupCode", "pickupRequestKey", "pickupFingerprint", "pickupAttempts", body.phone, body.name, ready.pickupCode]) {
        assert.ok(!serialized.includes(value));
      }
    }
    assert.equal((await (await call("/orders/" + orderId, "GET", null, accepted.orderToken)).json()).pickupCode, undefined);
    assert.equal((await call("/pickup/" + orderId + "/contact", "GET", null, stagingAdmin)).status, 404);
    const second = await (await call("/pickup", "POST", checkout, null, crypto.randomUUID())).json();
    const secondStored = await Order.findById(second.order._id).select("+pickupCode");
    assert.notEqual(secondStored.pickupCode, persisted.pickupCode);
    process.env.APP_ENV = "production";
    assert.equal((await call("/pickup/times?day=" + day)).status, 404);
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
