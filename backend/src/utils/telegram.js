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

const sendOrderNotification = async (order) => {
  try {
    const types = { dinein: "Залда", takeaway: "Алып кетүү", delivery: "Жеткирүү" };
    const payments = { cash: "Накталай", online: "Онлайн", card_online: "Онлайн карта" };
    const lines = [
      "Жаңы заказ",
      "Заказ: " + order._id,
      "Стол: " + order.tableNumber,
      "Түрү: " + (types[order.orderType] || order.orderType),
      "Төлөм: " + (payments[order.paymentMethod] || order.paymentMethod),
      "Төлөм статусу: " + order.paymentStatus,
      "Жалпы: " + order.totalAmount + " сом",
      "",
      ...order.items.map((item) => {
        const options = Object.entries(item.selectedOptions || {}).map(([key, value]) => key + ": " + String(value)).join(", ");
        return item.name + " × " + item.qty + " = " + (item.price * item.qty) + " сом" + (options ? " (" + options + ")" : "");
      }),
      ...(order.comment ? ["", "Комментарий: " + order.comment] : []),
    ];
    return await sendTelegramMessage(lines.join("\n"));
  } catch (error) {
    reportTelegramError(error);
    return false;
  }
};

module.exports = { sendTelegramMessage, sendOrderNotification, checkTelegramConfig };
