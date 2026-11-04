const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

// No dotenv, MongoDB connection, real credentials, or Telegram requests are used.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ADMIN_USERNAME = "test-admin";
process.env.ADMIN_PASSWORD = crypto.randomBytes(24).toString("hex");
const secret = process.env.JWT_SECRET;
const auth = require("../src/middleware/auth");
const id = "000000000000000000000001";
const otherId = "000000000000000000000002";
const order = { _id: id, tableNumber: 1, items: [{ name: "Mock", price: 10, qty: 1 }], status: "pending", totalAmount: 10, createdAt: new Date() };
let reads = 0, writes = 0, notifications = 0, cancelFilter;
const list = () => { reads++; return { sort: async () => [order] }; };
const readOne = async () => { reads++; return order; };
const writeOne = async () => { writes++; return order; };
class Product {
  constructor(body) { Object.assign(this, body); }
  async save() { return writeOne(); }
  static find = list;
  static findById = readOne;
  static findByIdAndUpdate = writeOne;
  static findByIdAndDelete = writeOne;
}
const Order = { find: list, findById: readOne, create: writeOne, findByIdAndUpdate: writeOne,
  findOneAndUpdate: async (filter) => { cancelFilter = filter; return writeOne(); } };
const WaiterCall = { find: list, create: writeOne, findByIdAndUpdate: writeOne };
for (const [name, stub] of Object.entries({ Product, Order, WaiterCall })) {
  const filename = require.resolve("../src/models/" + name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: stub };
}
const telegramFile = require.resolve("../src/utils/telegram");
require.cache[telegramFile] = { id: telegramFile, filename: telegramFile, loaded: true,
  exports: { sendOrderNotification: async () => { notifications++; return true; } } };
const app = express();
app.use(express.json());
for (const [prefix, file] of [["auth", "authRoutes"], ["products", "productRoutes"], ["orders", "orderRoutes"], ["waiter-calls", "waiterCallRoutes"]]) {
  app.use("/api/" + prefix, require("../src/routes/" + file));
}
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port + "/api";
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
async function request(method, path, token, body = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(base + path, { method, headers, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const admin = () => auth.signToken({ role: "admin" }, process.env.ADMIN_USERNAME);
const customer = () => auth.signToken({ role: "customer" }, id);
const signCustom = (claims, options = {}, key = secret) => jwt.sign(claims, key, {
  algorithm: "HS256", issuer: "cafe-qr-backend", audience: "cafe-qr-api", subject: "test-admin", expiresIn: "7d", ...options,
});
const adminRoutes = [
  ["GET", "/orders"], ["GET", "/orders/dashboard/stats"], ["GET", "/waiter-calls"], ["GET", "/auth/me"],
  ["POST", "/products"], ["PUT", "/products/" + id], ["DELETE", "/products/" + id],
  ["PATCH", "/orders/" + id + "/status"], ["PATCH", "/waiter-calls/" + id + "/done"],
];
for (const [name, token, expected] of [
  ["missing", undefined, 401], ["malformed", "not-a-jwt", 401],
  ["bad signature", signCustom({ role: "admin" }, {}, "wrong-test-key"), 401],
  ["expired", signCustom({ role: "admin" }, { expiresIn: -1 }), 401],
  ["wrong algorithm", signCustom({ role: "admin" }, { algorithm: "HS384" }), 401],
  ["wrong issuer", signCustom({ role: "admin" }, { issuer: "wrong" }), 401],
  ["wrong audience", signCustom({ role: "admin" }, { audience: "wrong" }), 401],
  ["customer role", customer(), 403], ["non-admin role", signCustom({ role: "waiter" }), 403],
  ["missing role", signCustom({}), 403], ["different admin", signCustom({ role: "admin" }, { subject: "other-admin" }), 403],
]) {
  test("all admin routes reject " + name + " before accessing models", async () => {
    const baseline = { reads, writes, notifications };
    for (const [method, path] of adminRoutes) assert.equal((await request(method, path, token)).status, expected, method + " " + path);
    assert.deepEqual({ reads, writes, notifications }, baseline);
  });
}
test("signed token without expiry is rejected", async () => {
  const token = jwt.sign({ role: "admin", sub: "test-admin" }, secret, { issuer: "cafe-qr-backend", audience: "cafe-qr-api" });
  assert.equal((await request("GET", "/orders", token)).status, 401);
});
test("valid admin token reaches all admin route handlers", async () => {
  for (const [method, path] of adminRoutes) {
    const result = await request(method, path, admin(), { status: "ready", name: "Mock" });
    assert.ok([200, 201].includes(result.status), method + " " + path);
  }
});
test("login assigns admin role server-side, incorrect/empty credentials fail", async () => {
  const good = await request("POST", "/auth/login", undefined, { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD, role: "customer" });
  assert.equal(good.status, 200);
  assert.equal(auth.verifyToken(good.body.token).role, "admin");
  assert.equal((await request("GET", "/auth/me", good.body.token)).status, 200);
  assert.equal((await request("POST", "/auth/login", undefined, { username: process.env.ADMIN_USERNAME, password: "wrong", role: "admin" })).status, 401);
  assert.equal((await request("POST", "/auth/login")).status, 401);
});
test("missing JWT secret or credentials fails closed", async () => {
  const token = admin();
  try {
    delete process.env.JWT_SECRET;
    assert.equal((await request("GET", "/orders", token)).status, 503);
    assert.equal((await request("POST", "/auth/login")).status, 503);
    assert.throws(() => auth.signToken({ role: "admin" }, "test-admin"));
  } finally { process.env.JWT_SECRET = secret; }
  const password = process.env.ADMIN_PASSWORD;
  try { delete process.env.ADMIN_PASSWORD; assert.equal((await request("POST", "/auth/login")).status, 503); }
  finally { process.env.ADMIN_PASSWORD = password; }
});
test("public menu, QR order creation and waiter call require no admin token", async () => {
  assert.equal((await request("GET", "/products")).status, 200);
  assert.equal((await request("GET", "/products/" + id)).status, 200);
  const created = await request("POST", "/orders", undefined, { tableNumber: 1, items: [{ name: "Mock", qty: 1, price: 10 }] });
  assert.equal(created.status, 201);
  const claims = auth.verifyToken(created.body.orderToken);
  assert.equal(claims.role, "customer"); assert.equal(claims.sub, id);
  assert.equal((await request("GET", "/orders/" + id, created.body.orderToken)).status, 200);
  assert.equal((await request("POST", "/waiter-calls", undefined, { tableNumber: 1 })).status, 201);
  const count = notifications;
  assert.equal((await request("POST", "/orders", undefined, { items: [] })).status, 400);
  assert.equal(notifications, count);
});
test("order read/cancel rejects missing/invalid token and other customers", async () => {
  for (const [method, suffix] of [["GET", ""], ["PATCH", "/cancel"]]) {
    const baseline = { reads, writes };
    assert.equal((await request(method, "/orders/" + id + suffix)).status, 401);
    assert.equal((await request(method, "/orders/" + id + suffix, "invalid")).status, 401);
    assert.equal((await request(method, "/orders/" + otherId + suffix, customer())).status, 403);
    assert.deepEqual({ reads, writes }, baseline);
    assert.equal((await request(method, "/orders/" + id + suffix, customer())).status, 200);
    assert.equal((await request(method, "/orders/" + id + suffix, admin())).status, 200);
  }
  assert.deepEqual(cancelFilter, { _id: id, status: "pending" });
});
test("socket middleware rejects guests, invalid tokens and customer roles", () => {
  for (const token of [undefined, "invalid", customer(), signCustom({ role: "admin" }, { expiresIn: -1 })]) {
    let error;
    auth.authenticateAdminSocket({ handshake: { auth: { token } }, data: {} }, err => { error = err; });
    assert.ok(error instanceof Error);
  }
  let error;
  const socket = { handshake: { auth: { token: admin() } }, data: {} };
  auth.authenticateAdminSocket(socket, err => { error = err; });
  assert.equal(error, undefined); assert.equal(socket.data.auth.role, "admin");
});
