/**
 * Shared slot-time generation logic.
 * Used by both bookingFinalizer (to create slots) and
 * the PSW calendar endpoint (to check availability).
 */

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
 * @returns {Array<{start: Date, end: Date}>}
 */
function generateSlotTimes(request) {
  const isOneTime = request.bookingType === "one-time";
  const timeRange = TIME_RANGES[request.timeOfDay] || TIME_RANGES.daytime;
  const durationHours = DURATION_HOURS[request.visitDuration] || 2;
  const startHour = request.preferredStartHour != null
    ? request.preferredStartHour
    : timeRange.start;

  const slotTimes = [];

  if (isOneTime) {
    const date = request.specificDate
      ? new Date(request.specificDate)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

    const slotStart = new Date(date);
    slotStart.setHours(startHour, 0, 0, 0);
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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalWeeks * 7);

    const cursor = new Date(startDate);
    let slotsThisWeek = 0;
    let currentWeekStart = getWeekStart(cursor);

    while (cursor < endDate && slotTimes.length < daysPerWeek * totalWeeks) {
      const weekStart = getWeekStart(cursor);
      if (weekStart.getTime() !== currentWeekStart.getTime()) {
        slotsThisWeek = 0;
        currentWeekStart = weekStart;
      }

      if (jsWeekDays.includes(cursor.getDay()) && slotsThisWeek < daysPerWeek) {
        const slotStart = new Date(cursor);
        slotStart.setHours(startHour, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + durationHours * 3600000);
        slotTimes.push({ start: new Date(slotStart), end: new Date(slotEnd) });
        slotsThisWeek++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return slotTimes;
}

module.exports = { generateSlotTimes, TIME_RANGES, DURATION_HOURS, DAY_TO_JS, getWeekStart };
