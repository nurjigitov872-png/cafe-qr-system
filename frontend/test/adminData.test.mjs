import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalytics, dateKey, money, STATUS_LABELS, formatDate, formatCalendarDate, kitchenQueue, kitchenWait, productCategories, KITCHEN_NEXT } from "../src/utils/adminData.js";
const now = new Date("2026-11-04T12:00:00Z");
const order = (overrides = {}) => ({ _id: "test-only", createdAt: "2026-11-04T06:00:00Z", status: "pending", totalAmount: 100, items: [{ name: "Тест", qty: 2 }], ...overrides });
test("empty API dataset yields seven real calendar days and no fabricated values", () => {
  const data = buildAnalytics([], now);
  assert.equal(data.days.length, 7);
  assert.deepEqual(data.days.map(day => day.key), ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.ok(data.days.every(day => day.orders === 0 && day.revenue === 0));
  assert.equal(data.todayOrders, 0); assert.equal(data.todayRevenue, 0); assert.deepEqual(data.popular, []);
});
test("restaurant day uses Bishkek midnight instead of server UTC midnight", () => {
  assert.equal(dateKey("2026-11-03T18:00:00Z"), "2026-11-04");
  assert.equal(dateKey("2026-11-03T17:59:59Z"), "2026-11-03");
  const data = buildAnalytics([order({ createdAt: "2026-11-03T18:01:00Z" }), order({ createdAt: "2026-11-03T17:59:00Z" })], now);
  assert.equal(data.todayOrders, 1); assert.equal(data.todayRevenue, 100);
});
test("cancelled orders count as orders but not revenue or popular product sales", () => {
  const data = buildAnalytics([order(), order({ status: "cancelled", totalAmount: 500, items: [{ name: "Өчүрүлгөн", qty: 20 }] })], now);
  assert.equal(data.todayOrders, 2); assert.equal(data.weeklyOrders, 2);
  assert.equal(data.todayRevenue, 100); assert.equal(data.weeklyRevenue, 100);
  assert.equal(data.statuses.pending, 1); assert.equal(data.statuses.cancelled, 1);
  assert.deepEqual(data.popular, [{ name: "Тест", qty: 2 }]);
});
test("seven-day boundaries exclude older and future orders from charts", () => {
  const data = buildAnalytics([order({ createdAt: "2026-10-28T17:59:59Z" }), order({ createdAt: "2026-10-28T18:00:00Z" }), order({ createdAt: "2026-11-04T18:00:00Z" })], now);
  assert.equal(data.weeklyOrders, 1); assert.equal(data.weeklyRevenue, 100);
  assert.equal(data.days[0].orders, 1); assert.equal(data.statuses.pending, 3);
});
test("ranking aggregates quantities by name safely and limits results to five", () => {
  const data = buildAnalytics([order({ items: [{ name: "__proto__", qty: 9 }, { name: "Бир", qty: 2 }, { name: "Эки", qty: 3 }, { name: "Үч", qty: 4 }, { name: "Төрт", qty: 5 }, { name: "Беш", qty: 6 }] }), order({ items: [{ name: "Бир", qty: 20 }] })], now);
  assert.equal(data.popular.length, 5); assert.deepEqual(data.popular[0], { name: "Бир", qty: 22 });
  assert.deepEqual(data.popular[1], { name: "__proto__", qty: 9 });
});
test("missing/invalid dates and non-finite/negative amounts never create NaN charts", () => {
  assert.equal(dateKey("invalid"), null); assert.equal(dateKey(undefined), null);
  const data = buildAnalytics([order({ createdAt: "invalid", totalAmount: "bad" }), order({ totalAmount: -10, items: [{ name: "Тест", qty: -3 }] }), order({ totalAmount: Infinity })], now);
  assert.equal(data.todayOrders, 2); assert.equal(data.todayRevenue, 0);
  assert.ok(data.days.every(day => Number.isFinite(day.revenue)));
});
test("month/year transitions produce seven unique calendar buckets", () => {
  const data = buildAnalytics([], new Date("2027-01-01T12:00:00Z"));
  assert.equal(data.days[0].key, "2026-12-26"); assert.equal(data.days[6].key, "2027-01-01");
  assert.equal(new Set(data.days.map(day => day.key)).size, 7);
});
test("enum values stay unchanged and presentation uses Kyrgyz labels", () => {
  assert.deepEqual(Object.keys(STATUS_LABELS), ["pending", "preparing", "ready", "served", "cancelled"]);
  assert.equal(STATUS_LABELS.pending, "Күтүлүүдө"); assert.ok(money(1234.5).endsWith(" сом"));
});

test("date presentation stays numeric across browser language fallbacks", () => {
  assert.equal(formatCalendarDate("2026-11-03T18:01:00Z"), "04.11.2026");
  assert.equal(formatDate("2026-11-03T18:01:00Z"), "04.11 · 00:01");
});
test("missing dates are explicitly identified instead of rendered as Invalid Date", () => {
  assert.equal(formatCalendarDate(undefined), "Күн көрсөтүлгөн эмес");
  assert.equal(formatDate("invalid"), "Убакыт көрсөтүлгөн эмес");
});

test("kitchen queue is oldest first, keeps invalid dates last and does not mutate API records", () => {
  const data = [order({ _id: "new", createdAt: "2026-11-04T08:30:00Z" }), order({ _id: "unknown", createdAt: "invalid" }), order({ _id: "old", createdAt: "2026-11-04T07:30:00Z" }), order({ _id: "ready", status: "ready" })];
  const snapshot = JSON.stringify(data);
  assert.deepEqual(kitchenQueue(data, "pending").map(item => item._id), ["old", "new", "unknown"]);
  assert.equal(JSON.stringify(data), snapshot);
});
test("wait indicators use real elapsed time at 15 and 30 minute boundaries", () => {
  const time = Date.parse("2026-11-04T12:00:00Z");
  assert.deepEqual(kitchenWait("2026-11-04T11:45:01Z", time), { minutes: 14, level: "normal" });
  assert.deepEqual(kitchenWait("2026-11-04T11:45:00Z", time), { minutes: 15, level: "warning" });
  assert.deepEqual(kitchenWait("2026-11-04T11:30:00Z", time), { minutes: 30, level: "urgent" });
  assert.deepEqual(kitchenWait("2026-11-04T13:00:00Z", time), { minutes: 0, level: "normal" });
  assert.equal(kitchenWait("invalid", time), null);
  assert.equal(kitchenWait(null, time), null);
});
test("primary kitchen actions retain existing status enums", () => {
  assert.deepEqual(KITCHEN_NEXT, { pending: "preparing", preparing: "ready", ready: "served" });
});
test("category suggestions come only from products, trim/deduplicate names and do not mutate inputs", () => {
  const data = [{ category: " Кофе " }, { category: "Кофе" }, { category: "Тамактар" }, { category: "" }, {}, { category: null }];
  const snapshot = JSON.stringify(data);
  assert.deepEqual(new Set(productCategories(data)), new Set(["Кофе", "Тамактар"]));
  assert.deepEqual(productCategories([]), []);
  assert.equal(JSON.stringify(data), snapshot);
});
