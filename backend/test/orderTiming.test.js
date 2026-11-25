const { test } = require("node:test");
const assert = require("node:assert/strict");
const { preparationEstimate, requireOpenRestaurant } = require("../src/utils/orderTiming");

test("Bishkek order hours include opening and exclude closing", () => {
  const at = time => Date.parse("2026-11-25T" + time + ":00+06:00");
  for (const time of ["08:59", "23:00", "00:00"]) {
    assert.throws(() => requireOpenRestaurant(at(time)), { code: "restaurant_closed", status: 503 });
  }
  for (const time of ["09:00", "22:59"]) assert.doesNotThrow(() => requireOpenRestaurant(at(time)));
});

test("restaurant order hours support minute-level configuration", () => {
  const hours = { opensAt: "10:30", closesAt: "21:45" };
  const at = time => Date.parse("2026-11-25T" + time + ":00+06:00");
  assert.throws(() => requireOpenRestaurant(at("10:29"), hours), { code: "restaurant_closed" });
  assert.doesNotThrow(() => requireOpenRestaurant(at("10:30"), hours));
  assert.throws(() => requireOpenRestaurant(at("21:45"), hours), { code: "restaurant_closed" });
});

test("preparation duration has server-validated bounds and produces an exact timestamp", () => {
  const now = Date.parse("2026-11-25T12:00:00+06:00");
  for (const minutes of [15, 20, 30, 45, 60, 32]) {
    assert.equal(+preparationEstimate(minutes, now).estimatedReadyAt, now + minutes * 60_000);
  }
  for (const minutes of [0, -1, 241, 15.5, "20", null]) {
    assert.throws(() => preparationEstimate(minutes, now), { code: "invalid_preparation_time", status: 400 });
  }
});
