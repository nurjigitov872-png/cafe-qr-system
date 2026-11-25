import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { deliveryLabel } from "../src/i18n/delivery.js";

test("Delivery labels cover the customer, courier and logistics flows in four languages", () => {
  for (const key of ["delivery", "logistics", "address", "en_route", "code", "stale", "background", "tariffs"]) {
    for (const language of ["ky", "ru", "en", "tr"]) assert.notEqual(deliveryLabel(language, key), key);
  }
});

test("Delivery requests preserve idempotency and keep GPS and contact responses out of browser cache", async () => {
  const source = fs.readFileSync(new URL("../src/services/delivery.js", import.meta.url), "utf8")
    .replace('import { API } from "../config/connections.js";', 'const API = "https://staging.invalid/api";')
    .replace('import { authHeaders } from "./api.js";', 'const authHeaders = () => ({ Authorization: "Bearer admin-test" });');
  const api = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return { ok: true, status: options.method === "PATCH" ? 204 : 200, json: async () => ({}) };
  };
  try {
    const point = { lat: 42.87, lng: 74.57 };
    await api.deliveryRequest("/orders", { method: "POST", body: { point }, requestId: "synthetic" });
    await api.deliveryRequest("/orders/owner", { token: "order-test" });
    await api.deliveryRequest("/courier/orders/owner/gps", { method: "PATCH", token: "courier-test", body: point });
    assert.equal(calls[0].headers["Idempotency-Key"], "synthetic");
    assert.equal(calls[1].headers.Authorization, "Bearer order-test");
    assert.equal(calls[2].headers.Authorization, "Bearer courier-test");
    assert.deepEqual(JSON.parse(calls[2].body), point);
    assert.ok(calls.every(call => call.cache === "no-store" && call.redirect === "error"));
  } finally { globalThis.fetch = original; }
});
