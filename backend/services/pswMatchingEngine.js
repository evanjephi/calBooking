const BookingSlot = require("../models/BookingSlot");
const Booking = require("../models/Booking");
const { findAvailablePSWs } = require("./availabilityService");

/*
Score weights (can tune later)
*/
const WEIGHTS = {
  distance:     0.25,
  availability: 0.30,
  rating:       0.20,
  experience:   0.15,
  capacity:     0.10
};

/*
Map timeOfDay to hour ranges for conflict checking
*/
const TIME_RANGES = {
  daytime:   { start: 8, end: 16 },
  evening:   { start: 16, end: 23 },
  overnight: { start: 22, end: 7 },   // wraps midnight
  weekend:   { start: 8, end: 18 }
};

/*
Map timeOfDay to which days of the week are relevant
  0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
*/
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getRelevantDays(timeOfDay) {
  if (timeOfDay === "weekend") return ["Saturday", "Sunday"];
  // weekday options — Mon-Fri
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
}

/*
Check how many days a PSW's schedule covers for the requested timeOfDay.
Returns { matchingDays, totalScheduledDays, scheduleScore }
  - matchingDays: days where PSW schedule overlaps the requested time window
  - totalScheduledDays: total days the PSW has on their schedule
  - scheduleScore: 0-1 ratio of matching vs requested
*/
function checkScheduleOverlap(psw, timeOfDay, daysPerWeek, preferredDays) {
  const schedule = psw.availability || [];
  if (schedule.length === 0) {
    // No detailed schedule — fall back to preference flags
    return { matchingDays: 0, totalScheduledDays: 0, scheduleScore: -1 };
  }

  // Use client's preferred days if specified, otherwise fall back to timeOfDay defaults
  const relevantDays = (preferredDays && preferredDays.length > 0)
    ? preferredDays
    : getRelevantDays(timeOfDay);
  const timeRange = TIME_RANGES[timeOfDay] || TIME_RANGES.daytime;

  let matchingDays = 0;
  const scheduledDayNames = [];

  for (const slot of schedule) {
    const day = slot.day;
    if (!day) continue;

    // Normalize day name
    const dayNorm = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    scheduledDayNames.push(dayNorm);

    if (!relevantDays.includes(dayNorm)) continue;

    // Check time overlap
    const slotStart = parseHour(slot.startTime);
    const slotEnd = parseHour(slot.endTime);

    if (timeRange.start < timeRange.end) {
      // Normal range (e.g. 8-16)
      if (slotStart < timeRange.end && slotEnd > timeRange.start) {
        matchingDays++;
      }
    } else {
      // Overnight wraps (22-7)
      if (slotEnd > timeRange.start || slotStart < timeRange.end) {
        matchingDays++;
      }
    }
  }

  const needed = daysPerWeek || 1;
  const scheduleScore = Math.min(matchingDays / needed, 1);

  return {
    matchingDays,
    totalScheduledDays: scheduledDayNames.length,
    scheduleScore
  };
}

function parseHour(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  return parseInt(parts[0]) || 0;
}

/*
Count how many hours a PSW is already booked in the upcoming week
for a given time-of-day window. Returns { bookedHours, availableHours, capacityScore }
*/
async function checkWeeklyCapacity(pswId, timeOfDay, visitDuration) {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Count booked slots in next 7 days
  const existingSlots = await BookingSlot.find({
    pswWorker: pswId,
    startTime: { $gte: now },
    endTime: { $lte: weekLater },
    status: { $ne: "cancelled" }
  }).lean();

  // Also count from Booking model
  const existingBookings = await Booking.find({
    pswWorker: pswId,
    startTime: { $gte: now },
    endTime: { $lte: weekLater },
    status: { $ne: "cancelled" }
  }).lean();

  let bookedHoursSlots = 0;
  for (const s of existingSlots) {
    bookedHoursSlots += (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60);
  }

  let bookedHoursBookings = 0;
  for (const b of existingBookings) {
    bookedHoursBookings += (new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60 * 60);
  }

  const bookedHours = bookedHoursSlots + bookedHoursBookings;

  // Estimate max weekly hours based on time-of-day window
  const timeRange = TIME_RANGES[timeOfDay] || TIME_RANGES.daytime;
  let hoursPerDay;
  if (timeRange.start < timeRange.end) {
    hoursPerDay = timeRange.end - timeRange.start;
  } else {
    hoursPerDay = (24 - timeRange.start) + timeRange.end;
  }
  const workDays = timeOfDay === "weekend" ? 2 : 5;
  const maxWeeklyHours = hoursPerDay * workDays;

  // Estimate how many hours this new booking would need per week
  const durationMap = {
    "1 hour": 1,
    "2-3 hours": 2.5,
    "4-6 hours": 5,
    "more than 6 hours": 8
  };
  const neededHoursPerVisit = durationMap[visitDuration] || 2;

  const availableHours = Math.max(maxWeeklyHours - bookedHours, 0);
  const wouldFit = availableHours >= neededHoursPerVisit;

  // Score: 1 = wide open, 0 = fully booked
  const capacityScore = maxWeeklyHours > 0
    ? Math.max(1 - (bookedHours / maxWeeklyHours), 0)
    : 0;

  return {
    bookedHours: Math.round(bookedHours * 10) / 10,
    availableHours: Math.round(availableHours * 10) / 10,
    maxWeeklyHours,
    wouldFit,
    capacityScore,
    fullyBooked: capacityScore === 0
  };
}

/*
Check specific time-slot conflicts for upcoming week
Returns number of conflicting slots out of requested daysPerWeek
*/
async function countUpcomingConflicts(pswId, timeOfDay, daysPerWeek, preferredDays) {
  const now = new Date();
  const timeRange = TIME_RANGES[timeOfDay] || TIME_RANGES.daytime;
  // Use client's preferred days if specified
  let relevantJsDays;
  if (preferredDays && preferredDays.length > 0) {
    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    relevantJsDays = preferredDays.map(d => dayMap[d]).filter(n => n != null);
  } else {
    relevantJsDays = timeOfDay === "weekend" ? [0, 6] : [1, 2, 3, 4, 5];
  }
  let conflicts = 0;
  let checked = 0;

  for (let d = 0; d < 14 && checked < (daysPerWeek || 1); d++) {
    const day = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    if (!relevantJsDays.includes(day.getDay())) continue;

    checked++;

    const slotStart = new Date(day);
    slotStart.setHours(timeRange.start < timeRange.end ? timeRange.start : timeRange.start, 0, 0, 0);
    const slotEnd = new Date(day);
    if (timeRange.start < timeRange.end) {
      slotEnd.setHours(timeRange.end, 0, 0, 0);
    } else {
      // Overnight — end is next morning
      slotEnd.setDate(slotEnd.getDate() + 1);
      slotEnd.setHours(timeRange.end, 0, 0, 0);
    }

    const conflict = await BookingSlot.findOne({
      pswWorker: pswId,
      startTime: { $lt: slotEnd },
      endTime: { $gt: slotStart },
      status: { $ne: "cancelled" }
    });

    if (conflict) conflicts++;
  }

  return { conflicts, checked, allConflicted: conflicts === checked && checked > 0 };
}

/*
Calculate availability score — enhanced with schedule + preference check
*/
function availabilityScore(psw, timeOfDay, scheduleInfo) {
  // If we have detailed schedule data, weight it heavily
  if (scheduleInfo && scheduleInfo.scheduleScore >= 0) {
    const prefScore = preferenceScore(psw, timeOfDay);
    // 70% schedule match, 30% preference
    return scheduleInfo.scheduleScore * 0.7 + prefScore * 0.3;
  }

  // Fallback to preference-only scoring
  return preferenceScore(psw, timeOfDay);
}

function preferenceScore(psw, timeOfDay) {
  if (!timeOfDay) return 0.5;
  const pref = psw.availabilityPreferences || {};
  if (timeOfDay === "daytime" && pref.daytime) return 1;
  if (timeOfDay === "evening" && pref.evening) return 1;
  if (timeOfDay === "overnight" && pref.overnight) return 1;
  if (timeOfDay === "weekend" && pref.weekend) return 1;
  return 0.3;
}

function ratingScore(psw) {
  return (psw.rating || 0) / 5;
}

function experienceScore(psw) {
  return Math.min((psw.yearsExperience || 1) / 20, 1);
}

function distanceScore(index, total) {
  if (total === 1) return 1;
  return 1 - (index / total);
}

/*
MAIN MATCHING ENGINE — enhanced with real availability checks
*/
async function matchPSWs(request) {
  const {
    coordinates,
    postalCode,
    startTime,
    endTime,
    timeOfDay,
    daysPerWeek,
    visitDuration,
    serviceLevel
  } = request;

  let nearbyPSWs = await findAvailablePSWs(coordinates, postalCode);
  console.log(`[MatchPSWs] Nearby PSWs found: ${nearbyPSWs.length}`);

  // Filter by service level if requested
  // PSWs with empty serviceLevels are treated as eligible for all levels
  if (serviceLevel) {
    const beforeCount = nearbyPSWs.length;
    nearbyPSWs = nearbyPSWs.filter(psw =>
      !psw.serviceLevels || psw.serviceLevels.length === 0 || psw.serviceLevels.includes(serviceLevel)
    );
    console.log(`[MatchPSWs] After serviceLevel filter (${serviceLevel}): ${nearbyPSWs.length} (was ${beforeCount})`);
  }

  const ranked = [];

  for (let i = 0; i < nearbyPSWs.length; i++) {
    const psw = nearbyPSWs[i];

    // ── 1. Specific time-slot conflict (if start/end provided) ──
    if (startTime && endTime) {
      const conflict = await BookingSlot.findOne({
        pswWorker: psw._id,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      });
      if (conflict) {
        console.log(`[MatchPSWs] Skipping ${psw.firstName} ${psw.lastName}: time-slot conflict`);
        continue;
      }
    }

    // ── 2. Schedule overlap check (PSW's weekly schedule vs request) ──
    const scheduleInfo = checkScheduleOverlap(psw, timeOfDay, daysPerWeek, request.preferredDays);

    // If PSW has a schedule defined but ZERO matching days → skip
    if (scheduleInfo.totalScheduledDays > 0 && scheduleInfo.matchingDays === 0) {
      console.log(`[MatchPSWs] Skipping ${psw.firstName} ${psw.lastName}: schedule has ${scheduleInfo.totalScheduledDays} days but 0 match timeOfDay=${timeOfDay}`);
      continue;
    }

    // ── 3. Weekly capacity check (booked hours in next 7 days) ──
    let capacityInfo = { capacityScore: 1, fullyBooked: false, bookedHours: 0, availableHours: 40 };
    if (timeOfDay) {
      capacityInfo = await checkWeeklyCapacity(psw._id, timeOfDay, visitDuration);
    }

    // Fully booked → skip entirely
    if (capacityInfo.fullyBooked) {
      console.log(`[MatchPSWs] Skipping ${psw.firstName} ${psw.lastName}: fully booked (${capacityInfo.bookedHours}h booked)`);
      continue;
    }

    // ── 4. Upcoming slot conflicts check ──
    let conflictInfo = { conflicts: 0, checked: 0, allConflicted: false };
    if (timeOfDay && daysPerWeek) {
      conflictInfo = await countUpcomingConflicts(psw._id, timeOfDay, daysPerWeek, request.preferredDays);
    }

    // All upcoming requested slots are taken → skip
    if (conflictInfo.allConflicted) {
      console.log(`[MatchPSWs] Skipping ${psw.firstName} ${psw.lastName}: all ${conflictInfo.checked} upcoming slots conflicted`);
      continue;
    }

    // ── 5. Score calculation ──
    const scores = {
      distance:     distanceScore(i, nearbyPSWs.length),
      availability: availabilityScore(psw, timeOfDay, scheduleInfo),
      rating:       ratingScore(psw),
      experience:   experienceScore(psw),
      capacity:     capacityInfo.capacityScore
    };

    const totalScore =
      scores.distance     * WEIGHTS.distance +
      scores.availability * WEIGHTS.availability +
      scores.rating       * WEIGHTS.rating +
      scores.experience   * WEIGHTS.experience +
      scores.capacity     * WEIGHTS.capacity;

    // Determine availability status for the caller
    let availabilityStatus = "available";
    if (conflictInfo.conflicts > 0 && conflictInfo.conflicts < conflictInfo.checked) {
      availabilityStatus = "partial";
    }
    if (capacityInfo.capacityScore < 0.3) {
      availabilityStatus = "limited";
    }

    ranked.push({
      psw,
      score: totalScore,
      scores,
      availabilityStatus,
      availabilityDetail: {
        scheduledDays: scheduleInfo.matchingDays,
        bookedHours: capacityInfo.bookedHours,
        availableHours: capacityInfo.availableHours,
        upcomingConflicts: conflictInfo.conflicts,
        slotsChecked: conflictInfo.checked
      }
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  console.log(`[MatchPSWs] Final ranked results: ${ranked.length} PSWs passed all filters`);
  return ranked;
}

module.exports = {
  matchPSWs
};