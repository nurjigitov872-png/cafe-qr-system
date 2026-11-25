const { BookingError } = require("./bookingTime");

const restaurantClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bishkek", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const defaultOrderHours = Object.freeze({ opensAt: "09:00", closesAt: "23:00" });
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const smartKitchenEnabled = () => process.env.APP_ENV === "staging";
const activePreparationStatuses = ["pending", "preparing"];

function orderNow(req) {
  return req.app.get("orderClock")?.() ?? Date.now();
}

function requireOpenRestaurant(now, hours = defaultOrderHours) {
  const { opensAt, closesAt } = hours;
  if (!clockPattern.test(opensAt) || !clockPattern.test(closesAt) || opensAt >= closesAt) {
    throw new Error("Invalid restaurant ordering hours");
  }
  const time = restaurantClock.format(now);
  if (time < opensAt || time >= closesAt) throw new BookingError(503, "restaurant_closed");
}

function preparationEstimate(minutes, now) {
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new BookingError(400, "invalid_preparation_time");
  }
  return { estimatedPrepMinutes: minutes, estimatedReadyAt: new Date(now + minutes * 60_000) };
}

module.exports = { smartKitchenEnabled, activePreparationStatuses, orderNow, requireOpenRestaurant, preparationEstimate };
