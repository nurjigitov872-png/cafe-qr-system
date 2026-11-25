const { test } = require("node:test");
const assert = require("node:assert/strict");
const { distanceKm, deliveryProviders } = require("../src/utils/deliveryProviders");
const { quote, position, validateSettings } = require("../src/utils/delivery");

test("delivery quotes use staging tariff inputs and reject outside-zone or malformed locations", () => {
  const center = { lat: 42.8746, lng: 74.5698 };
  const settings = validateSettings({ center, radiusKm: 8, baseFee: 100, feePerKm: 15, speedKmh: 20, demo: false });
  const inside = { lat: center.lat + 0.02, lng: center.lng };
  const result = quote(inside, settings);
  assert.equal(result.deliveryFee, Math.round((100 + distanceKm(center, inside) * 15) * 100) / 100);
  assert.equal(result.deliveryMinutes, 7);
  assert.equal(result.demo, false);
  assert.throws(() => quote({ lat: 43, lng: center.lng }, settings), { code: "outside_zone" });
  assert.throws(() => position({ lat: "42", lng: 74 }), { code: "invalid_position" });
  for (const provider of ["yandex", "glovo"]) {
    assert.equal(deliveryProviders[provider].dispatch, "demo");
    assert.equal(quote(inside, settings, provider).demo, true);
  }
});
