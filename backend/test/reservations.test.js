const { test } = require("node:test");
const assert = require("node:assert/strict");
const { slotsFor, timeOptions } = require("../src/utils/bookingTime");

const settings = { opensAt: "09:00", closesAt: "23:00", advanceDays: 14, slotMinutes: 15, durationMinutes: 120, bufferMinutes: 15, holdMinutes: 15 };
const now = +new Date("2026-11-25T00:00:00+06:00");

test("Bishkek booking windows include the preparation buffer and stay inside opening hours", () => {
  const times = timeOptions("2026-11-25", settings, now);
  assert.equal(times[0], "09:00");
  assert.equal(times.at(-1), "20:45");
  assert.deepEqual(timeOptions("2026-12-10", settings, now), []);
  assert.throws(() => timeOptions("2026-02-30", settings, now));
  assert.throws(() => slotsFor("2026-11-25", "09:01", settings, now));
  const window = slotsFor("2026-11-25", "09:00", settings, now);
  assert.equal(window.startsAt.toISOString(), "2026-11-25T03:00:00.000Z");
  assert.equal(window.endsAt.toISOString(), "2026-11-25T05:00:00.000Z");
  assert.equal(window.slots.length, 135);
  assert.equal(window.slots.at(-1).toISOString(), "2026-11-25T05:14:00.000Z");
  assert.equal(+window.holdUntil - now, 15 * 60_000);
});
