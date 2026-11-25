const MINUTE = 60_000;
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit",
});

class BookingError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function dayStart(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BookingError(400, "invalid");
  const midnight = new Date(day + "T00:00:00+06:00");
  if (!Number.isFinite(+midnight) || dayFormatter.format(midnight) !== day) throw new BookingError(400, "invalid");
  return +midnight;
}

function timeOptions(day, settings, now = Date.now()) {
  const midnight = dayStart(day);
  const today = dayStart(dayFormatter.format(now));
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (midnight < today || midnight > today + settings.advanceDays * 1440 * MINUTE) return [];
  const options = [];
  for (let minute = minutes(settings.opensAt); minute + settings.durationMinutes + settings.bufferMinutes <= minutes(settings.closesAt); minute += settings.slotMinutes) {
    if (midnight + minute * MINUTE <= now) continue;
    options.push(String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0"));
  }
  return options;
}

function slotsFor(day, time, settings, now = Date.now()) {
  if (!timeOptions(day, settings, now).includes(time)) throw new BookingError(400, "invalid");
  const startsAt = new Date(day + "T" + time + ":00+06:00");
  const endsAt = new Date(+startsAt + settings.durationMinutes * MINUTE);
  const blockedUntil = +endsAt + settings.bufferMinutes * MINUTE;
  const slots = [];
  // Use a fixed minute grid so changing the configurable booking cadence cannot bypass existing slots.
  for (let tick = +startsAt; tick < blockedUntil; tick += MINUTE) slots.push(new Date(tick));
  return { startsAt, endsAt, slots, holdUntil: new Date(Math.min(+startsAt, now + settings.holdMinutes * MINUTE)) };
}

module.exports = { BookingError, dayStart, timeOptions, slotsFor };
