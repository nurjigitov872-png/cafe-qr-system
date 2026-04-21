const TelegramBot = require("node-telegram-bot-api");

let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

const sendTelegramMessage = async (text) => {
  try {
    if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, text);
  } catch (error) {
    console.log("Telegram send error:", error.message);
  }
};

module.exports = { sendTelegramMessage };