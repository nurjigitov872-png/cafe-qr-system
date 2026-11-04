import { test } from "node:test";
import assert from "node:assert/strict";
import { productPrice, orderPayload, customerMoney } from "../src/utils/customerData.js";
test("product price matches existing positive discount rules", () => {
  assert.equal(productPrice({ price: 200, discountPrice: 150 }), 150);
  for (const discountPrice of [0, -1, null, undefined, "100"]) assert.equal(productPrice({ price: 200, discountPrice }), 200);
});
test("QR table, order type, payment, comment and item variants reach unchanged API fields", () => {
  const items = [{ productId: "test-only", name: "Тест", price: 150, qty: 2, selectedOptions: { Сүт: "Сулу" } }];
  const snapshot = JSON.stringify(items);
  const payload = orderPayload("12", items, "Кантсыз", "dinein", "online");
  assert.equal(payload.tableNumber, 12); assert.equal(payload.orderType, "dinein"); assert.equal(payload.paymentMethod, "online");
  assert.equal(payload.comment, "Кантсыз"); assert.equal(payload.totalAmount, 300);
  assert.deepEqual(payload.items[0].selectedOptions, { Сүт: "Сулу" });
  payload.items[0].selectedOptions.Сүт = "Башка";
  assert.equal(JSON.stringify(items), snapshot);
});
test("different variants remain separate cart/order lines", () => {
  const items = [{ productId: "same", name: "Тест", price: 100, qty: 1, selectedOptions: { Көлөм: "Кичине" } }, { productId: "same", name: "Тест", price: 100, qty: 3, selectedOptions: { Көлөм: "Чоң" } }];
  const payload = orderPayload(7, items, "", "takeaway", "cash");
  assert.equal(payload.items.length, 2); assert.equal(payload.totalAmount, 400);
  assert.equal(payload.orderType, "takeaway"); assert.equal(payload.tableNumber, 7);
});
test("customer payload keeps existing fallback values and contains no admin token fields", () => {
  const payload = orderPayload("bad", [], undefined, undefined, undefined);
  assert.equal(payload.tableNumber, 1); assert.equal(payload.orderType, "takeaway");
  assert.equal(payload.paymentMethod, "cash"); assert.equal(payload.totalAmount, 0);
  assert.equal(payload.comment, ""); assert.ok(!("token" in payload));
});
test("currency presentation is in som", () => {
  assert.ok(customerMoney(1234.5).endsWith(" сом"));
});
