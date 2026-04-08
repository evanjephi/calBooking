const dayjs = require("dayjs");

/*
Generate recurring booking slots

Example:
3 days per week
12 weeks
*/
function generateRecurringSlots({
  startDate,
  daysOfWeek,
  startTime,
  durationHours,
  weeks
}) {

  const slots = [];

  const start = dayjs(startDate);
  const totalDays = weeks * 7;

  for (let i = 0; i < totalDays; i++) {

    const currentDay = start.add(i, "day");

    if (daysOfWeek.includes(currentDay.day())) {

      const [hour, minute] = startTime.split(":");

      const slotStart = currentDay
        .hour(parseInt(hour))
        .minute(parseInt(minute))
        .second(0);

      const slotEnd = slotStart.add(durationHours, "hour");

      slots.push({
        startTime: slotStart.toDate(),
        endTime: slotEnd.toDate()
      });

    }

  }

  return slots;
}

module.exports = {
  generateRecurringSlots
};