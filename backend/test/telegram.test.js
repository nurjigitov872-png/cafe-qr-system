const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/utils/telegram.js"), "utf8");

// Load the real formatter/transport in an isolated sandbox. No dotenv, real bot,
// database, HTTP calls or real credentials are available to these tests.
function sandbox({ configured = true, fail = false } = {}) {
  const sent = [], clients = [], warnings = [];
  class FakeBot {
    constructor(token, options) { clients.push({ token, options }); }
    async sendMessage(...args) {
      sent.push(args);
      if (fail) throw { message: "PRIVATE_TEST_VALUE", response: { body: { error_code: 403 } } };
      return { message_id: 1 };
    }
  }
  const context = { module: { exports: {} }, require(name) {
    assert.equal(name, "node-telegram-bot-api"); return FakeBot;
  }, process: { env: configured ? { TELEGRAM_BOT_TOKEN: "FAKE_TEST_TOKEN", TELEGRAM_CHAT_ID: "FAKE_TEST_CHAT" } : {} },
    console: { warn: (...args) => warnings.push(args.join(" ")) } };
  vm.runInNewContext(source, context);
  return { ...context.module.exports, sent, clients, warnings };
}
const order = overrides => ({
  _id: "0123456789abcdef0123abcd", tableNumber: 7, status: "pending", orderType: "dinein",
  paymentMethod: "cash", paymentStatus: "pending", totalAmount: 300,
  createdAt: "2026-11-03T18:05:00Z", comment: "Кантсыз даярдаңыз",
  items: [{ name: "Капучино", qty: 2, price: 150, selectedOptions: { Көлөм: "Чоң" } }],
  ...overrides,
});
test("Kyrgyz notification includes all order details, quantities, amount and options", () => {
  const text = sandbox().formatOrderMessage(order());
  for (const value of ["🧾 ЖАҢЫ ЗАКАЗ", "№23ABCD", "Күтүлүүдө", "Стол: №7", "Залда", "Капучино", "2 × 150 сом = 300 сом", "Көлөм: Чоң", "ЖАЛПЫ: 300 сом", "Накталай", "Төлөнө элек", "Кантсыз даярдаңыз"]) assert.ok(text.includes(value), value);
  assert.ok(!text.includes("pending"));
});
test("short ID is presentation only; the entire source order remains unchanged", () => {
  const data = order(); const before = JSON.stringify(data);
  const text = sandbox().formatOrderMessage(data);
  assert.ok(!text.includes(data._id)); assert.equal(JSON.stringify(data), before);
  assert.equal(data._id, "0123456789abcdef0123abcd");
});
for (const [status, label] of Object.entries({ pending: "Күтүлүүдө", preparing: "Даярдалууда", ready: "Даяр", served: "Берилди", cancelled: "Жокко чыгарылды" })) {
  test("status " + status + " is displayed in Kyrgyz", () => assert.ok(sandbox().formatOrderMessage(order({ status })).includes(label)));
}
test("order types and payment states are translated without changing their values", () => {
  const { formatOrderMessage } = sandbox();
  for (const [orderType, label] of Object.entries({ dinein: "Залда", takeaway: "Алып кетүү", delivery: "Жеткирүү" })) assert.ok(formatOrderMessage(order({ orderType })).includes(label));
  for (const [paymentMethod, label] of Object.entries({ cash: "Накталай", online: "Онлайн", card_online: "Онлайн карта" })) assert.ok(formatOrderMessage(order({ paymentMethod })).includes(label));
  for (const [paymentStatus, label] of Object.entries({ pending: "Төлөнө элек", paid: "Төлөндү", failed: "Төлөм өтпөдү" })) assert.ok(formatOrderMessage(order({ paymentStatus })).includes(label));
});
test("creation timestamp crosses midnight in Bishkek independently of host timezone", () => {
  const text = sandbox().formatOrderMessage(order());
  assert.ok(text.includes("Күнү: 04.11.2026"));
  assert.ok(text.includes("Убактысы: 00:05 (Бишкек, UTC+6)"));
});
test("missing/invalid creation date is identified rather than replaced by a made-up date", () => {
  for (const createdAt of [undefined, null, "bad date"]) {
    const text = sandbox().formatOrderMessage(order({ createdAt }));
    assert.ok(text.includes("Күнү: Көрсөтүлгөн эмес")); assert.ok(!text.includes("Invalid Date"));
  }
});
test("unknown enums have Kyrgyz fallbacks; empty comments are explicit", () => {
  const text = sandbox().formatOrderMessage(order({ status: "unknown", orderType: "unknown", paymentMethod: "unknown", paymentStatus: "unknown", comment: "   " }));
  assert.ok(!text.includes("unknown")); assert.ok(text.includes("Белгисиз"));
  assert.ok(text.endsWith("Комментарий:\nЖок"));
});
test("long emoji comments fit the limit without cutting UTF-16 surrogate pairs", () => {
  const text = sandbox().formatOrderMessage(order({ comment: "🙂".repeat(10000) }));
  assert.ok(text.length <= 3900); assert.ok(text.endsWith("…"));
  assert.ok(text.isWellFormed()); assert.ok(text.includes("ЖАЛПЫ: 300 сом"));
});
test("huge item lists preserve totals/payment/comment and disclose omitted items", () => {
  const items = Array.from({ length: 300 }, () => ({ name: "Товар".repeat(200), qty: 2, price: 150, selectedOptions: { Параметр: "Көлөм".repeat(200) } }));
  const text = sandbox().formatOrderMessage(order({ items, comment: "Эскертүү".repeat(2000) }));
  assert.ok(text.length <= 3900); assert.ok(text.includes("Дагы ")); assert.ok(text.includes("товар түрү бар"));
  assert.ok(text.includes("ЖАЛПЫ: 300 сом")); assert.ok(text.includes("Төлөм ыкмасы: Накталай")); assert.ok(text.includes("Комментарий:"));
});
test("HTML-like dynamic values stay literal in a plain-text send without parse_mode", async () => {
  const context = sandbox(); const dynamic = "<b>& Тест </b>";
  assert.equal(await context.sendOrderNotification(order({ comment: dynamic, items: [{ name: dynamic, qty: 1, price: 1 }] })), true);
  const [chat, text, options] = context.sent[0];
  assert.equal(chat, "FAKE_TEST_CHAT"); assert.ok(text.includes(dynamic)); assert.equal(options, undefined);
  assert.equal(context.sent[0].length, 2);
});
test("transport keeps polling disabled, timeout and success/failure behavior", async () => {
  const good = sandbox(); assert.equal(await good.sendOrderNotification(order()), true);
  assert.equal(good.clients[0].options.polling, false); assert.equal(good.clients[0].options.request.timeout, 10000);
  const failed = sandbox({ fail: true }); assert.equal(await failed.sendOrderNotification(order()), false);
  assert.ok(!failed.warnings.join(" ").includes("PRIVATE_TEST_VALUE"));
});
test("missing config sends nothing; existing generic send remains bounded plain text", async () => {
  const missing = sandbox({ configured: false }); assert.equal(await missing.sendOrderNotification(order()), false);
  assert.equal(missing.sent.length, 0); assert.equal(missing.clients.length, 0);
  const context = sandbox(); assert.equal(await context.sendTelegramMessage("x".repeat(10000)), true);
  assert.ok(context.sent[0][1].length <= 4000);
});
