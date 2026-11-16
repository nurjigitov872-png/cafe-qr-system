// Fail closed even if a transport is used without the normal server bootstrap.
const telegramAllowed = env => ["staging", "production"].includes(env.APP_ENV) && env.TELEGRAM_ENABLED === "true";
const pushAllowed = env => (["staging", "production"].includes(env.APP_ENV) && env.WEB_PUSH_ENABLED === "true") ||
  (env.APP_ENV === "push-lab" && env.PUSH_LAB_ENABLE_REAL_PUSH === "true");
module.exports = { telegramAllowed, pushAllowed };
