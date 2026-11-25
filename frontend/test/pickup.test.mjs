import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pickupLabel } from "../src/i18n/pickup.js";

test("Pickup retries use the same idempotency header and avoid browser caching", async () => {
  const source = fs.readFileSync(new URL("../src/services/pickup.js", import.meta.url), "utf8")
    .replace('import { API } from "../config/connections.js";', 'const API = "https://staging.invalid/api";')
    .replace('import { authHeaders } from "./api.js";', 'const authHeaders = () => ({});');
  const api = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (calls.length === 1) throw new Error("Synthetic connection failure");
    return { ok: true, json: async () => ({ order: { _id: "synthetic" } }) };
  };
  try {
    const body = { name: "Synthetic", phone: "+996000000000", items: [{ productId: "test-product", qty: 1 }] };
    await assert.rejects(api.createPickupOrder(body, "test-key"));
    await api.createPickupOrder(body, "test-key");
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[1].url, "https://staging.invalid/api/checkout/pickup");
    assert.equal(calls[1].headers["Idempotency-Key"], "test-key");
    assert.equal(calls[1].cache, "no-store");
    const submitted = JSON.parse(calls[1].body);
    for (const key of ["tableNumber", "day", "time"]) assert.equal(submitted[key], undefined);
  } finally { globalThis.fetch = oldFetch; }
});

test("Pickup labels are available in all four supported languages", () => {
  for (const key of ["title", "time", "code", "collect", "pay"]) {
    const labels = ["ky", "ru", "en", "tr"].map(language => pickupLabel(language, key));
    assert.equal(new Set(labels).size, 4);
  }
});
