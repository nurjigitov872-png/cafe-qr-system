const fs = require("node:fs");
const path = require("node:path");
const { telegramAllowed, pushAllowed } = require("./integrations");
const fail = field => { throw new Error("Backend configuration rejected: " + field); };
const present = value => typeof value === "string" && value.trim().length > 0;
const loopback = host => host === "localhost" || host === "[::1]" || host === "127.0.0.1";
function loadEnvironment(external = process.env, directory = path.resolve(__dirname, "../.."), readFile = fs.readFileSync) {
  // APP_ENV must be selected outside private files; never fall back to legacy .env.
  const appEnv = external.APP_ENV;
  if (!["local", "staging", "production"].includes(appEnv)) fail("APP_ENV must be selected explicitly");
  let file = {};
  try { file = require("dotenv").parse(readFile(path.join(directory, ".env." + appEnv))); }
  catch (error) { if (error.code !== "ENOENT") fail("environment file could not be read"); }
  if (file.APP_ENV && file.APP_ENV !== appEnv) fail("environment file APP_ENV mismatch");
  return { ...file, ...external, APP_ENV: appEnv };
}
function webOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail("frontend origin"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") fail("frontend origin");
  return url;
}
function validateEnvironment(env) {
  const appEnv = env.APP_ENV;
  if (!["local", "staging", "production"].includes(appEnv)) fail("APP_ENV");
  const local = appEnv === "local";
  if (local ? env.NODE_ENV && !["development", "test"].includes(env.NODE_ENV) : env.NODE_ENV !== "production") fail("NODE_ENV does not match APP_ENV");
  if (!present(env.JWT_SECRET) || env.JWT_SECRET.length < 32 || /REPLACE|CHANGE_ME|YOUR_SECRET/i.test(env.JWT_SECRET)) fail("JWT_SECRET must be independently generated");
  if (local ? !env.JWT_SECRET.startsWith("local-") : env.JWT_SECRET.startsWith("local-")) fail("JWT_SECRET environment scope");
  if (!present(env.ADMIN_USERNAME) || !present(env.ADMIN_PASSWORD) || env.ADMIN_PASSWORD.length < 12) fail("admin credentials");
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("PORT");
  for (const flag of ["TELEGRAM_ENABLED", "WEB_PUSH_ENABLED", "PUSH_TEST_ENABLED"]) {
    if (env[flag] !== undefined && !["true", "false"].includes(env[flag])) fail(flag);
  }
  if (env.PUSH_LAB_ENABLE_REAL_PUSH === "true") fail("push-lab cannot run as the main backend");
  const telegramKeys = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
  const pushKeys = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  if (local) {
    // Exact URI: rejects credentials, SRV, extra hosts, options, tunnels on other ports and other DB names.
    if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):27017\/cafe_qr_local$/.test(env.MONGO_URI || "")) fail("local MongoDB must be loopback:27017/cafe_qr_local without options");
    if ([...telegramKeys, ...pushKeys].some(key => present(env[key])) || env.TELEGRAM_ENABLED === "true" || env.WEB_PUSH_ENABLED === "true" || env.PUSH_TEST_ENABLED === "true") fail("local external integration credentials or flags");
    if (present(env.MONGO_DNS_SERVERS) || present(env.MONGO_EXPECTED_HOST) || present(env.MONGO_EXPECTED_DATABASE)) fail("local remote database settings");
  } else {
    // Explicit host/database pins catch accidental substitution; they are not proof of account ownership.
    let mongo;
    try { mongo = new URL(env.MONGO_URI); } catch { fail("MONGO_URI"); }
    if (!["mongodb:", "mongodb+srv:"].includes(mongo.protocol) || loopback(mongo.hostname) || !present(env.MONGO_EXPECTED_HOST) || mongo.hostname !== env.MONGO_EXPECTED_HOST || !present(env.MONGO_EXPECTED_DATABASE) || mongo.pathname !== "/" + env.MONGO_EXPECTED_DATABASE) fail("MongoDB environment host/database pins");
    if (appEnv === "staging" && !env.MONGO_EXPECTED_DATABASE.endsWith("_staging")) fail("staging database must end in _staging");
    if (env.PUSH_TEST_ENABLED === "true") fail("main remote backend push tests must be disabled");
    for (const [flag, keys] of [["TELEGRAM_ENABLED", telegramKeys], ["WEB_PUSH_ENABLED", pushKeys]]) {
      if (!["true", "false"].includes(env[flag])) fail(flag + " must be explicit");
      if (env[flag] === "true" ? keys.some(key => !present(env[key])) : keys.some(key => present(env[key]))) fail(flag + " credentials do not match flag");
    }
  }
  const origins = [...new Set([env.CLIENT_URL, env.CORS_ORIGIN].filter(present))].map(webOrigin);
  if (!origins.length) fail("CLIENT_URL or CORS_ORIGIN is required");
  if (origins.some(url => local ? !loopback(url.hostname) : url.protocol !== "https:" || loopback(url.hostname))) fail("frontend origin environment mismatch");
  return Object.freeze({ appEnv, port, host: local ? "127.0.0.1" : "0.0.0.0", mongoUri: env.MONGO_URI,
    allowedOrigins: origins.map(url => url.origin), telegramEnabled: telegramAllowed(env), pushEnabled: pushAllowed(env) });
}
function initializeEnvironment({ external = process.env, directory, readFile, target = process.env } = {}) {
  const env = loadEnvironment(external, directory, readFile);
  const config = validateEnvironment(env);
  Object.assign(target, env); // Apply only after the entire configuration passes.
  return config;
}
module.exports = { loadEnvironment, validateEnvironment, initializeEnvironment };
