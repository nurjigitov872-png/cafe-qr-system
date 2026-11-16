const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { loadEnvironment, validateEnvironment, initializeEnvironment } = require("../src/config/environment");
const { telegramAllowed, pushAllowed } = require("../src/config/integrations");
const local = () => ({ APP_ENV: "local", NODE_ENV: "development", MONGO_URI: "mongodb://127.0.0.1:27017/cafe_qr_local", JWT_SECRET: "local-" + "x".repeat(48), ADMIN_USERNAME: "test-admin", ADMIN_PASSWORD: "isolated-test-password", CLIENT_URL: "http://localhost:5173", TELEGRAM_ENABLED: "false", WEB_PUSH_ENABLED: "false" });
const remote = appEnv => ({ ...local(), APP_ENV: appEnv, NODE_ENV: "production", JWT_SECRET: "remote-test-" + "y".repeat(48), MONGO_URI: "mongodb+srv://test-user:FAKE_SECRET@cluster.invalid/cafe_" + appEnv, MONGO_EXPECTED_HOST: "cluster.invalid", MONGO_EXPECTED_DATABASE: "cafe_" + appEnv, CLIENT_URL: "https://frontend.invalid" });
test("environment selection reads only its file and never the legacy .env", () => {
  const reads = [];
  const file = name => { reads.push(name); return "JWT_SECRET=file-secret\n"; };
  const env = loadEnvironment({ APP_ENV: "local", JWT_SECRET: "shell-secret" }, "/virtual", file);
  assert.equal(reads.length, 1); assert.ok(reads[0].endsWith(".env.local")); assert.equal(env.JWT_SECRET, "shell-secret");
  assert.throws(() => loadEnvironment({}, "/virtual", file)); assert.equal(reads.length, 1);
  assert.throws(() => loadEnvironment({ APP_ENV: "local" }, "/virtual", () => "APP_ENV=production"));
});
test("invalid settings do not partially modify process environment", () => {
  const target = { sentinel: "unchanged" };
  assert.throws(() => initializeEnvironment({ external: { APP_ENV: "local" }, directory: "/virtual", readFile: () => "MONGO_URI=mongodb+srv://SECRET@cluster.invalid/prod", target }));
  assert.deepEqual(target, { sentinel: "unchanged" });
});
test("local accepts only the isolated loopback database and binds loopback", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    const config = validateEnvironment({ ...local(), MONGO_URI: "mongodb://" + host + ":27017/cafe_qr_local" });
    assert.equal(config.host, "127.0.0.1"); assert.equal(config.telegramEnabled, false); assert.equal(config.pushEnabled, false);
  }
  for (const uri of ["mongodb+srv://cluster.invalid/cafe_qr_local", "mongodb://127.0.0.1:27017/production", "mongodb://127.0.0.1:27018/cafe_qr_local", "mongodb://user:PRIVATE_CREDENTIAL_93849@127.0.0.1:27017/cafe_qr_local", "mongodb://127.0.0.1:27017/cafe_qr_local?replicaSet=prod", "mongodb://localhost.evil.invalid:27017/cafe_qr_local", "mongodb://localhost:27017,prod.invalid:27017/cafe_qr_local"]) {
    assert.throws(() => validateEnvironment({ ...local(), MONGO_URI: uri }), error => !error.message.includes("PRIVATE_CREDENTIAL_93849"));
  }
});
test("local rejects integration credentials, flags, remote origins, remote JWT and DNS settings", () => {
  for (const change of [{ TELEGRAM_BOT_TOKEN: "PRIVATE_CREDENTIAL_93849" }, { TELEGRAM_CHAT_ID: "PRIVATE_CREDENTIAL_93849" }, { VAPID_PRIVATE_KEY: "PRIVATE_CREDENTIAL_93849" }, { VAPID_PUBLIC_KEY: "PRIVATE_CREDENTIAL_93849" }, { VAPID_SUBJECT: "PRIVATE_CREDENTIAL_93849" }, { TELEGRAM_ENABLED: "true" }, { WEB_PUSH_ENABLED: "true" }, { PUSH_TEST_ENABLED: "true" }, { PUSH_LAB_ENABLE_REAL_PUSH: "true" }, { CLIENT_URL: "https://frontend.invalid" }, { JWT_SECRET: "prod-" + "x".repeat(48) }, { MONGO_DNS_SERVERS: "1.1.1.1" }, { NODE_ENV: "production" }]) assert.throws(() => validateEnvironment({ ...local(), ...change }), error => !error.message.includes("PRIVATE_CREDENTIAL_93849"));
});
test("remote settings require explicit host/database, flags, credentials and HTTPS", () => {
  for (const appEnv of ["staging", "production"]) {
    const env = remote(appEnv); assert.equal(validateEnvironment(env).appEnv, appEnv);
    for (const change of [{ MONGO_EXPECTED_HOST: "other.invalid" }, { MONGO_EXPECTED_DATABASE: "other" }, { NODE_ENV: "development" }, { TELEGRAM_ENABLED: undefined }, { TELEGRAM_BOT_TOKEN: "PRIVATE_CREDENTIAL_93849" }, { WEB_PUSH_ENABLED: "true" }, { CLIENT_URL: "http://localhost:5173" }, { JWT_SECRET: local().JWT_SECRET }]) assert.throws(() => validateEnvironment({ ...env, ...change }));
    assert.equal(validateEnvironment({ ...env, TELEGRAM_ENABLED: "true", TELEGRAM_BOT_TOKEN: "FAKE", TELEGRAM_CHAT_ID: "FAKE" }).telegramEnabled, true);
  }
  assert.throws(() => validateEnvironment({ ...remote("staging"), MONGO_URI: remote("production").MONGO_URI, MONGO_EXPECTED_DATABASE: "cafe_production" }));
});
const serverSource = fs.readFileSync(require.resolve("../src/server"), "utf8");
function boot(env) {
  const calls = { imports: [], connects: [], listeners: [], telegram: 0, push: 0 }, logs = [];
  const entry = { exports: {} }, fakeProcess = { env, exitCode: 0, exit: () => { throw Error("unexpected exit"); } };
  const app = { use() {}, set() {}, get() {} };
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  class SocketServer { use() {} on() {} }
  vm.runInNewContext(serverSource, { module: entry, console: { error: (...args) => logs.push(args.join(" ")), log() {} }, process: fakeProcess, require(name) {
    if (name === "./config/environment") return { initializeEnvironment: () => validateEnvironment(env) };
    calls.imports.push(name);
    if (name === "express") return express;
    if (name === "mongoose") return { connect: async uri => { calls.connects.push(uri); } };
    if (name === "cors") return () => {};
    if (name === "http") return { createServer: () => ({ listen: (port, host, fn) => { calls.listeners.push({ port, host }); fn(); } }) };
    if (name === "socket.io") return { Server: SocketServer };
    if (name === "./utils/telegram") return { checkTelegramConfig: () => { calls.telegram++; } };
    if (name === "./middleware/auth") return { getSecret() {} };
    if (name === "./utils/notificationPolicy") return { socketAuth() {}, connectSocket() {} };
    if (name === "./utils/notifications") return { createNotifications: () => { calls.push++; return {}; } };
    if (name.startsWith("./routes/")) return {};
    throw Error("Unexpected dependency");
  } });
  entry.exports.main(); return { calls, logs, fakeProcess };
}
test("invalid startup stops before importing MongoDB, transports, DNS or opening listeners and hides secrets", () => {
  for (const env of [{}, { ...local(), MONGO_URI: "mongodb+srv://user:PRIVATE_CREDENTIAL_93849@prod.invalid/prod" }, { ...local(), TELEGRAM_BOT_TOKEN: "PRIVATE_CREDENTIAL_93849" }, { ...local(), VAPID_PRIVATE_KEY: "PRIVATE_CREDENTIAL_93849" }]) {
    const result = boot(env); assert.equal(result.fakeProcess.exitCode, 1); assert.equal(result.calls.imports.length, 0); assert.equal(result.calls.connects.length, 0); assert.equal(result.calls.listeners.length, 0); assert.ok(!result.logs.join(" ").includes("PRIVATE_CREDENTIAL_93849"));
  }
});
test("valid local startup preserves API boot and connects only to the mock loopback database", async () => {
  const result = boot(local()); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(result.calls.connects, [local().MONGO_URI]); assert.equal(result.calls.listeners[0].host, "127.0.0.1"); assert.equal(result.fakeProcess.exitCode, 0);
});
test("integration gates deny unknown/local environments even with copied credentials", () => {
  for (const APP_ENV of [undefined, "local", "test", "typo"]) {
    const env = { APP_ENV, TELEGRAM_ENABLED: "true", WEB_PUSH_ENABLED: "true", PUSH_LAB_ENABLE_REAL_PUSH: "true" };
    assert.equal(telegramAllowed(env), false); assert.equal(pushAllowed(env), false);
  }
  assert.equal(pushAllowed({ APP_ENV: "push-lab", PUSH_LAB_ENABLE_REAL_PUSH: "true" }), true);
});
test("local notification publish cannot configure VAPID or call push transport", async () => {
  const { createNotifications } = require("../src/utils/notifications");
  let sends = 0, vapid = 0, sockets = 0;
  const service = createNotifications({ to: () => ({ emit: () => sockets++ }) }, { env: { ...local(), WEB_PUSH_ENABLED: "true", VAPID_PRIVATE_KEY: "PRIVATE_CREDENTIAL_93849", VAPID_PUBLIC_KEY: "PRIVATE_CREDENTIAL_93849", VAPID_SUBJECT: "PRIVATE_CREDENTIAL_93849" }, NotificationModel: { updateOne: async () => ({ upsertedCount: 1 }) }, transport: { setVapidDetails() { vapid++; }, sendNotification() { sends++; } } });
  await service.publish("order.new", { _id: "000000000000000000000001", status: "pending", tableNumber: 1 });
  assert.equal(service.configured, false); assert.equal(vapid, 0); assert.equal(sends, 0); assert.equal(sockets, 1);
});
test("Telegram rejects copied local credentials before loading the real transport", async () => {
  const source = fs.readFileSync(require.resolve("../src/utils/telegram"), "utf8");
  let transportImports = 0;
  const entry = { exports: {} };
  vm.runInNewContext(source, { module: entry, process: { env: { APP_ENV: "local", TELEGRAM_ENABLED: "true", TELEGRAM_BOT_TOKEN: "PRIVATE_CREDENTIAL_93849", TELEGRAM_CHAT_ID: "PRIVATE_CREDENTIAL_93849" } }, console: { warn() {} }, require(name) { if (name === "../config/integrations") return { telegramAllowed }; transportImports++; throw Error("Forbidden transport"); } });
  assert.equal(await entry.exports.sendTelegramMessage("fake message"), false); assert.equal(transportImports, 0);
});
test("JWT environments reject each other's tokens even when an operator reuses a secret", () => {
  const oldEnv = process.env.APP_ENV, oldSecret = process.env.JWT_SECRET;
  const { signToken, verifyToken } = require("../src/middleware/auth");
  try {
    process.env.JWT_SECRET = "fake-shared-test-" + "x".repeat(48);
    process.env.APP_ENV = "local"; const token = signToken({ role: "customer" }, "000000000000000000000001");
    for (const env of ["staging", "production", "push-lab"]) { process.env.APP_ENV = env; assert.throws(() => verifyToken(token)); }
    process.env.APP_ENV = "local"; assert.equal(verifyToken(token).role, "customer");
  } finally { if (oldEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = oldEnv; if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; }
});
test("frontend local configuration matches backend origin, API prefix and CORS policy", async () => {
  const { pathToFileURL } = require("node:url");
  const { resolveConnections } = await import(pathToFileURL(require("node:path").resolve(__dirname, "../../frontend/src/config/connectionPolicy.mjs")).href);
  const backend = validateEnvironment(local());
  const frontend = resolveConnections({ VITE_APP_ENV: "local", VITE_API_URL: "http://localhost:" + backend.port }, { development: true, pageOrigin: backend.allowedOrigins[0] });
  assert.equal(frontend.apiBaseUrl, "http://localhost:10000/api"); assert.equal(frontend.socketOrigin, "http://localhost:10000");
});
