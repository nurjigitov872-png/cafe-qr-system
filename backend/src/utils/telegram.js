const TelegramBot = require("node-telegram-bot-api");

let bot = null;
let botToken = null;

const getConfig = () => ({
  token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
  chatId: String(process.env.TELEGRAM_CHAT_ID || "").trim(),
});

// Never log raw Telegram errors: they may include the request URL and token.
const reportTelegramError = (error) => {
  const status = Number(error?.response?.body?.error_code || error?.response?.statusCode);
  const hints = {
    400: "Bad request: check TELEGRAM_CHAT_ID and the target chat settings.",
    401: "Invalid bot token: check TELEGRAM_BOT_TOKEN.",
    403: "Access denied: start/unblock the bot or grant it permission in the chat.",
    404: "Bot API endpoint not found: check TELEGRAM_BOT_TOKEN.",
    429: "Telegram rate limit reached; notification was not confirmed.",
  };
  const code = ["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EFATAL"].includes(error?.code)
    ? error.code : "REQUEST_FAILED";
  console.warn("[Telegram]", hints[status] || ("Delivery not confirmed (" + code + "). Check network access to Telegram."));
};

const checkTelegramConfig = () => {
  const { token, chatId } = getConfig();
  const missing = [];
  if (!token) missing.push("TELEGRAM_BOT_TOKEN");
  if (!chatId) missing.push("TELEGRAM_CHAT_ID");
  if (missing.length) {
    console.warn("[Telegram] Notifications disabled; missing: " + missing.join(", "));
    return false;
  }
  return true;
};

const sendTelegramMessage = async (text) => {
  try {
    if (!checkTelegramConfig()) return false;
    const { token, chatId } = getConfig();
    if (!bot || token !== botToken) {
      bot = new TelegramBot(token, { polling: false, request: { timeout: 10000 } });
      botToken = token;
    }
    // Plain text avoids markup injection. Stay below Telegram's message limit.
    const message = String(text || "");
    if (!message.trim()) return false;
    const bounded = message.length > 4000 ? message.slice(0, 3997) + "..." : message;
    await bot.sendMessage(chatId, bounded);
    return true;
  } catch (error) {
    reportTelegramError(error);
    return false;
  }
};

// Keep notification formatting independent from the Telegram transport.
// Plain text only: no parse_mode, so customer-supplied markup stays literal.
const clipText = (value, max) => {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  if (text.length <= max) return text;
  let prefix = text.slice(0, Math.max(0, max - 1));
  // Never cut between the two UTF-16 units of an emoji.
  if (/[\uD800-\uDBFF]$/.test(prefix)) prefix = prefix.slice(0, -1);
  return prefix + "…";
};
const fieldText = (value, max = 120) => clipText(String(value ?? "").replace(/\s+/g, " ").trim(), max);
const formatNumber = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Math.abs(number) >= 1e12 ? number.toExponential(2) : new Intl.NumberFormat("ky-KG", { maximumFractionDigits: 2 }).format(number);
};
const formatOrderTime = value => {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return ["📅 Күнү: Көрсөтүлгөн эмес", "🕒 Убактысы: Көрсөтүлгөн эмес"];
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bishkek", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return ["📅 Күнү: " + get("day") + "." + get("month") + "." + get("year"),
    "🕒 Убактысы: " + get("hour") + ":" + get("minute") + " (Бишкек, UTC+6)"];
};

const formatOrderMessage = order => {
  const statuses = {
    pending: "🟡 Күтүлүүдө", preparing: "🔵 Даярдалууда", ready: "🟢 Даяр",
    served: "✅ Берилди", cancelled: "🔴 Жокко чыгарылды",
  };
  const types = { dinein: "Залда", takeaway: "Алып кетүү", delivery: "Жеткирүү" };
  const payments = { cash: "Накталай", online: "Онлайн", card_online: "Онлайн карта" };
  const paymentStatuses = { pending: "Төлөнө элек", paid: "Төлөндү", failed: "Төлөм өтпөдү" };
  const shortId = fieldText(String(order._id ?? "").slice(-6).toUpperCase(), 6) || "—";
  const separator = "━━━━━━━━━━━━━━━━━━";
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = [];
  let used = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const options = Object.entries(item.selectedOptions || {}).map(([key, value]) => fieldText(key, 40) + ": " + fieldText(value, 80)).join(", ");
    const block = [
      (index + 1) + ". " + (fieldText(item.name) || "Товар"),
      "   " + formatNumber(item.qty) + " × " + formatNumber(item.price) + " сом = " + formatNumber(Number(item.price) * Number(item.qty)) + " сом",
      ...(options ? ["   ▫ " + fieldText(options, 180)] : []),
    ].join("\n");
    // Reserve space for totals, payment information, and the comment.
    if (used + block.length + 1 > 2000) {
      itemLines.push("… Дагы " + (items.length - index) + " товар түрү бар.");
      break;
    }
    itemLines.push(block);
    used += block.length + 1;
  }
  const comment = clipText(String(order.comment ?? "").trim(), 600) || "Жок";
  const lines = [
    "🧾 ЖАҢЫ ЗАКАЗ · №" + shortId,
    separator,
    "Статус: " + (statuses[order.status] || "⚪ Белгисиз"),
    "🪑 Стол: №" + (fieldText(order.tableNumber, 20) || "—"),
    "🍽 Заказдын түрү: " + (types[order.orderType] || "Көрсөтүлгөн эмес"),
    ...formatOrderTime(order.createdAt),
    "", "🛒 ТОВАРЛАР", ...itemLines,
    ...(items.length ? [] : ["Товарлар көрсөтүлгөн эмес"]),
    "", separator,
    "💰 ЖАЛПЫ: " + formatNumber(order.totalAmount) + " сом",
    "💳 Төлөм ыкмасы: " + (payments[order.paymentMethod] || "Көрсөтүлгөн эмес"),
    "Төлөм статусу: " + (paymentStatuses[order.paymentStatus] || "Көрсөтүлгөн эмес"),
    "", "💬 Комментарий:", comment,
  ];
  // Conservative UTF-16 limit also fits Telegram's 4096-character plain-text limit.
  return clipText(lines.join("\n"), 3900);
};

const sendOrderNotification = async (order) => {
  try {
    return await sendTelegramMessage(formatOrderMessage(order));
  } catch (error) {
    reportTelegramError(error);
    return false;
  }
};

module.exports = { sendTelegramMessage, sendOrderNotification, checkTelegramConfig, formatOrderMessage };
