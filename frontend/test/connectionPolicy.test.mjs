import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveConnections } from "../src/config/connectionPolicy.mjs";
const local = { VITE_APP_ENV: "local", VITE_API_URL: "http://localhost:10001" };
const remote = { VITE_APP_ENV: "production", VITE_API_URL: "https://backend.invalid/api", VITE_BACKEND_ORIGIN: "https://backend.invalid", VITE_FRONTEND_ORIGIN: "https://frontend.invalid" };
const dataUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
test("API prefix normalizes exactly once and socket inherits backend origin", () => {
  for (const suffix of ["", "/", "/api", "/api/"]) {
    const result = resolveConnections({ ...local, VITE_API_URL: "http://localhost:10001" + suffix }, { development: true });
    assert.equal(result.apiBaseUrl, "http://localhost:10001/api");
    assert.equal(result.socketOrigin, "http://localhost:10001");
  }
});
test("missing config, foreign socket, remote development and malformed URLs fail closed", () => {
  for (const env of [{}, { ...local, VITE_API_URL: undefined }, { ...local, VITE_SOCKET_URL: "https://remote.invalid" }, { ...local, VITE_API_URL: remote.VITE_API_URL }, remote]) {
    assert.throws(() => resolveConnections(env, { development: true }));
  }
  for (const suffix of ["/api/api", "/other", "/api?secret=x", "/api#x"]) assert.throws(() => resolveConnections({ ...local, VITE_API_URL: local.VITE_API_URL + suffix }));
  assert.throws(() => resolveConnections({ ...local, VITE_API_URL: "http://user:password@localhost" }), error => !error.message.includes("password"));
});
test("local accepts loopback only, including IPv6; remote bundles cannot run on localhost", () => {
  for (const host of ["localhost", "127.0.0.1", "127.0.0.2", "[::1]"]) assert.equal(resolveConnections({ ...local, VITE_API_URL: "http://" + host + ":10001/api" }).appEnv, "local");
  for (const host of ["localhost.evil.invalid", "192.168.1.2", "0.0.0.0"]) assert.throws(() => resolveConnections({ ...local, VITE_API_URL: "http://" + host }));
  assert.throws(() => resolveConnections(remote, { pageOrigin: "http://localhost:5173" }));
  assert.throws(() => resolveConnections(local, { pageOrigin: "https://frontend.invalid" }));
});
test("staging/production require explicit HTTPS origins; isolated push-lab supports same-origin build", () => {
  for (const appEnv of ["staging", "production"]) {
    const env = { ...remote, VITE_APP_ENV: appEnv };
    assert.equal(resolveConnections(env, { pageOrigin: remote.VITE_FRONTEND_ORIGIN }).appEnv, appEnv);
    assert.throws(() => resolveConnections({ ...env, VITE_BACKEND_ORIGIN: undefined }));
    assert.throws(() => resolveConnections({ ...env, VITE_FRONTEND_ORIGIN: "http://frontend.invalid" }));
  }
  const lab = { ...remote, VITE_APP_ENV: "push-lab", VITE_FRONTEND_ORIGIN: remote.VITE_BACKEND_ORIGIN };
  assert.equal(resolveConnections(lab, { pageOrigin: remote.VITE_BACKEND_ORIGIN }).appEnv, "push-lab");
  assert.throws(() => resolveConnections({ ...lab, VITE_FRONTEND_ORIGIN: remote.VITE_FRONTEND_ORIGIN }));
});
test("invalid config prevents actual API, notification and socket consumers from calling fetch or io", async () => {
  const policy = dataUrl(fs.readFileSync(new URL("../src/config/connectionPolicy.mjs", import.meta.url), "utf8"));
  const originalFetch = globalThis.fetch, originalIo = globalThis.__connectionTestIo;
  let fetches = 0, sockets = 0;
  globalThis.fetch = () => { fetches++; throw Error("unexpected network"); };
  globalThis.__connectionTestIo = () => { sockets++; return {}; };
  try {
    for (const [index, env] of [{}, { ...local, VITE_API_URL: remote.VITE_API_URL }, { ...local, VITE_SOCKET_URL: remote.VITE_BACKEND_ORIGIN }].entries()) {
      const runtime = fs.readFileSync(new URL("../src/config/connections.js", import.meta.url), "utf8")
        .replace("./connectionPolicy.mjs", policy)
        .replaceAll("import.meta.env.DEV", "true")
        .replaceAll("import.meta.env", JSON.stringify(env));
      const config = dataUrl(runtime + `\n// case ${index}`);
      for (const path of ["services/api.js", "services/socket.js", "notifications/client.js"]) {
        const source = fs.readFileSync(new URL("../src/" + path, import.meta.url), "utf8")
          .replaceAll("../config/connections.js", config)
          .replaceAll("../notifications/events.js", new URL("../src/notifications/events.js", import.meta.url).href)
          .replace('import { io } from "socket.io-client";', 'const io = globalThis.__connectionTestIo;');
        await assert.rejects(import(dataUrl(source)), /Connection configuration/);
      }
    }
    assert.equal(fetches, 0); assert.equal(sockets, 0);
    const center = fs.readFileSync(new URL("../src/components/NotificationCenter.jsx", import.meta.url), "utf8");
    assert.match(center, /import \{ SOCKET \} from "\.\.\/config\/connections\.js"/);
    assert.match(center, /io\(SOCKET,/);
  } finally { globalThis.fetch = originalFetch; globalThis.__connectionTestIo = originalIo; }
});
