/**
 * Shared slot-time generation logic.
 * Used by both bookingFinalizer (to create slots) and
 * the PSW calendar endpoint (to check availability).
 *
 * All times are built in the user's IANA timezone (e.g. "America/Toronto")
 * and stored as UTC Date objects in MongoDB.
 */

const { DateTime } = require("luxon");

const DEFAULT_TIMEZONE = "America/Toronto";

const TIME_RANGES = {
  daytime:   { start: 9,  end: 16 },
  evening:   { start: 16, end: 23 },
  overnight: { start: 22, end: 7  },
  weekend:   { start: 9,  end: 17 }
};

const DURATION_HOURS = {
  "1 hour": 1,
  "2-3 hours": 2.5,
  "4-6 hours": 5,
  "more than 6 hours": 8
};

const DAY_TO_JS = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6
};

/**
 * Build a UTC Date from a calendar date + hour in a given IANA timezone.
 * e.g. localToUTC(2026, 4, 9, 10, "America/Toronto") → 2026-04-09T14:00:00.000Z
 */
function localToUTC(year, month, day, hour, timezone) {
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute: 0, second: 0 },
    { zone: timezone }
  );
  return dt.toJSDate();
}

/**
 * Get "now" in the user's timezone, then advance to tomorrow at midnight.
 */
function getTomorrowLocal(timezone) {
  return DateTime.now().setZone(timezone).startOf("day").plus({ days: 1 });
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate the concrete slot start/end times for a BookingRequest.
 * @param {object} request - BookingRequest document (or plain object with same fields)
 *   request.timezone — IANA timezone string, e.g. "America/Toronto"
 * @returns {Array<{start: Date, end: Date}>}
 */
function generateSlotTimes(request) {
  const tz = request.timezone || DEFAULT_TIMEZONE;
  const isOneTime = request.bookingType === "one-time";
  const timeRange = TIME_RANGES[request.timeOfDay] || TIME_RANGES.daytime;
  const durationHours = DURATION_HOURS[request.visitDuration] || 2;
  const startHour = request.preferredStartHour != null
    ? request.preferredStartHour
    : timeRange.start;

  const slotTimes = [];

  if (isOneTime) {
    let dt;
    if (request.specificDate) {
      const d = new Date(request.specificDate);
      dt = DateTime.fromObject(
        { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
        { zone: tz }
      );
    } else {
      dt = getTomorrowLocal(tz);
    }

    const slotStart = localToUTC(dt.year, dt.month, dt.day, startHour, tz);
    const slotEnd = new Date(slotStart.getTime() + durationHours * 3600000);
    slotTimes.push({ start: slotStart, end: slotEnd });
  } else {
    const daysPerWeek = request.daysPerWeek || 1;
    const totalWeeks = request.lengthOfCareWeeks || 1;

    let jsWeekDays;
    if (request.preferredDays && request.preferredDays.length > 0) {
      jsWeekDays = request.preferredDays.map(d => DAY_TO_JS[d]).filter(n => n != null);
    } else {
      jsWeekDays = request.timeOfDay === "weekend" ? [0, 6] : [1, 2, 3, 4, 5];
    }

    const startDt = getTomorrowLocal(tz);
    const endDt = startDt.plus({ weeks: totalWeeks });

    let cursor = startDt;
    let slotsThisWeek = 0;
    let currentWeekStart = cursor.startOf("week");

    while (cursor < endDt && slotTimes.length < daysPerWeek * totalWeeks) {
      const weekStart = cursor.startOf("week");
      if (!weekStart.equals(currentWeekStart)) {
        slotsThisWeek = 0;
        currentWeekStart = weekStart;
      }

      // Luxon weekday: 1=Monday..7=Sunday; convert to JS convention: 0=Sunday..6=Saturday
      const jsDay = cursor.weekday === 7 ? 0 : cursor.weekday;

      if (jsWeekDays.includes(jsDay) && slotsThisWeek < daysPerWeek) {
        const slotStart = localToUTC(cursor.year, cursor.month, cursor.day, startHour, tz);
        const slotEnd = new Date(slotStart.getTime() + durationHours * 3600000);
        slotTimes.push({ start: slotStart, end: slotEnd });
        slotsThisWeek++;
      }

      cursor = cursor.plus({ days: 1 });
    }
  }

  return slotTimes;
}

module.exports = { generateSlotTimes, localToUTC, DEFAULT_TIMEZONE, TIME_RANGES, DURATION_HOURS, DAY_TO_JS, getWeekStart };
