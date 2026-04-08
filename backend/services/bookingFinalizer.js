const Booking = require("../models/Booking");
const BookingSlot = require("../models/BookingSlot");
const BookingBlock = require("../models/BookingBlock");
const BookingRequest = require("../models/BookingRequest");
const PSWWorker = require("../models/PSWWorker");
const { matchPSWs } = require("./pswMatchingEngine");
const { generateSlotTimes, TIME_RANGES, DURATION_HOURS } = require("./slotTimeGenerator");
const { SERVICE_RATES } = require("../config/rates");

/**
 * Atomic conflict check — returns true if a conflict exists for this PSW
 * in the given time window. Uses a DB query so it catches concurrent inserts.
 */
async function hasSlotConflict(pswId, startTime, endTime) {
  const conflict = await BookingSlot.findOne({
    pswWorker: pswId,
    status: { $ne: "cancelled" },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  return !!conflict;
}

/**
 * Finalize a BookingRequest → create Booking(s) + BookingSlots.
 *
 * Supports:
 *   - Single PSW: classic flow via selectedPSW
 *   - Split booking: multiple PSWs via slotAssignments
 *
 * @param {string} requestId  - BookingRequest._id
 * @param {object} opts
 * @param {boolean} opts.skipAvailabilityCheck - skip re-check (e.g. webhook already validated)
 * @returns {{ booking, bookings, slots, bookingBlock, request, summary }}
 */
async function finalizeBookingRequest(requestId, opts = {}) {
  const request = await BookingRequest.findById(requestId);
  if (!request) throw Object.assign(new Error("BookingRequest not found"), { status: 404 });

  if (request.status === "booked") {
    throw Object.assign(new Error("This request has already been finalized"), { status: 409 });
  }

  if (request.status === "cancelled") {
    throw Object.assign(new Error("Cannot finalize a cancelled request"), { status: 400 });
  }

  // Must have contact info
  if (!request.contact?.email && !request.contact?.phone) {
    throw Object.assign(new Error("Contact info required before finalizing"), { status: 400 });
  }

  // ── Route: split booking or single PSW ──
  const isSplitBooking = request.slotAssignments && request.slotAssignments.length > 0;

  if (isSplitBooking) {
    return await finalizeSplitBooking(request, opts);
  }

  // Must have a selected PSW for single-PSW path
  if (!request.selectedPSW?.pswId) {
    throw Object.assign(new Error("No PSW selected — select a caregiver before finalizing"), { status: 400 });
  }

  return await finalizeSinglePSW(request, opts);
}

// ══════════════════════════════════════════════════════════════
//  SINGLE PSW FINALIZATION (original logic)
// ══════════════════════════════════════════════════════════════
async function finalizeSinglePSW(request, opts) {
  const psw = await PSWWorker.findById(request.selectedPSW.pswId);
  if (!psw) throw Object.assign(new Error("Selected PSW not found"), { status: 404 });

  // ── Optional: Re-check availability ──
  if (!opts.skipAvailabilityCheck) {
    const freshMatches = await matchPSWs({
      coordinates: request.location.coordinates,
      postalCode: request.location.postalCode,
      timeOfDay: request.timeOfDay,
      daysPerWeek: request.daysPerWeek,
      visitDuration: request.visitDuration,
      serviceLevel: request.serviceLevel
    });

    const stillAvailable = freshMatches.some(
      m => m.psw._id.toString() === request.selectedPSW.pswId.toString()
    );

    if (!stillAvailable) {
      throw Object.assign(
        new Error(`PSW ${psw.firstName} ${psw.lastName} is no longer available for the requested schedule`),
        { status: 409 }
      );
    }
  }

  const isOneTime = request.bookingType === "one-time";
  const startHour = request.preferredStartHour != null
    ? request.preferredStartHour
    : (TIME_RANGES[request.timeOfDay] || TIME_RANGES.daytime).start;

  const slotTimes = generateSlotTimes(request);

  if (slotTimes.length === 0) {
    throw Object.assign(new Error("Could not generate any booking slots for the requested schedule"), { status: 400 });
  }

  // ── ATOMIC CONFLICT GUARD ──
  const conflicts = [];
  for (const time of slotTimes) {
    if (await hasSlotConflict(psw._id, time.start, time.end)) {
      conflicts.push(time.start.toISOString());
    }
  }
  if (conflicts.length > 0) {
    throw Object.assign(
      new Error(`Time conflict: ${psw.firstName} ${psw.lastName} already has bookings at: ${conflicts.join(", ")}`),
      { status: 409, conflicts }
    );
  }

  // ── Create Booking ──
  const serviceType = (psw.serviceType && psw.serviceType[0]) || "Personal Support";
  const firstSlot = slotTimes[0];
  const lastSlot = slotTimes[slotTimes.length - 1];

  // ── Billing calculation ──
  const hourlyRate = SERVICE_RATES[request.serviceLevel] || null;
  const totalHours = slotTimes.reduce((sum, t) => sum + (t.end - t.start) / 3600000, 0);
  const totalAmount = hourlyRate ? Math.round(hourlyRate * totalHours * 100) / 100 : null;

  const isRecurring = !isOneTime && (request.lengthOfCareWeeks || 1) > 1;

  const booking = new Booking({
    userId: request.userId || null,
    pswWorker: psw._id,
    client: request.clientId || request.contact?.email || "walk-in",
    serviceAddress: request.serviceAddress || {},
    serviceType,
    serviceLevel: request.serviceLevel || null,
    bookingDate: firstSlot.start,
    bookingTime: `${startHour}:00`,
    startTime: firstSlot.start,
    endTime: lastSlot.end,
    recurring: isRecurring,
    recurringInterval: isRecurring ? "weekly" : null,
    daysPerWeek: request.daysPerWeek || null,
    preferredDays: request.preferredDays && request.preferredDays.length > 0
      ? request.preferredDays
      : [...new Set(slotTimes.map(t => t.start.toLocaleDateString('en-US', { weekday: 'long' })))],
    lengthOfCareWeeks: request.lengthOfCareWeeks || null,
    visitDuration: request.visitDuration || null,
    totalSlots: slotTimes.length,
    status: "pending",
    hourlyRate,
    totalHours: Math.round(totalHours * 100) / 100,
    totalAmount
  });
  await booking.save();

  // ── Create BookingBlock + BookingSlots ──
  const bookingBlock = new BookingBlock({
    userId: request.userId || null,
    clientId: request.clientId || request.contact?.email || "walk-in",
    serviceAddress: request.serviceAddress || {},
    createdBy: request.source === "phone" ? "representative" : "client",
    contact: request.contact,
    startDate: firstSlot.start,
    endDate: lastSlot.end,
    slots: []
  });
  await bookingBlock.save();

  const slots = [];
  for (const time of slotTimes) {
    if (await hasSlotConflict(psw._id, time.start, time.end)) {
      await BookingSlot.deleteMany({ bookingBlock: bookingBlock._id });
      await BookingBlock.findByIdAndDelete(bookingBlock._id);
      await Booking.findByIdAndDelete(booking._id);
      throw Object.assign(
        new Error(`Conflict detected during slot creation for ${time.start.toISOString()}. Booking rolled back.`),
        { status: 409 }
      );
    }

    const slot = new BookingSlot({
      bookingBlock: bookingBlock._id,
      pswWorker: psw._id,
      startTime: time.start,
      endTime: time.end,
      status: "scheduled"
    });
    await slot.save();
    slots.push(slot);
  }

  bookingBlock.slots = slots.map(s => s._id);
  await bookingBlock.save();

  request.status = "booked";
  request.bookingId = booking._id;
  await request.save();

  return {
    booking,
    bookings: [booking],
    bookingBlock,
    slots,
    request,
    summary: {
      bookingId: booking._id,
      pswName: `${psw.firstName} ${psw.lastName}`,
      totalSlots: slots.length,
      startDate: firstSlot.start,
      endDate: lastSlot.end,
      recurring: booking.recurring,
      status: booking.status,
      bookingType: request.bookingType || "recurring"
    }
  };
}

// ══════════════════════════════════════════════════════════════
//  SPLIT BOOKING FINALIZATION (multiple PSWs)
// ══════════════════════════════════════════════════════════════
async function finalizeSplitBooking(request, opts) {
  const isOneTime = request.bookingType === "one-time";
  const startHour = request.preferredStartHour != null
    ? request.preferredStartHour
    : (TIME_RANGES[request.timeOfDay] || TIME_RANGES.daytime).start;

  // Validate all PSWs exist up front
  const pswMap = {};
  for (const assignment of request.slotAssignments) {
    const psw = await PSWWorker.findById(assignment.pswId);
    if (!psw) {
      throw Object.assign(new Error(`PSW ${assignment.pswId} not found`), { status: 404 });
    }
    pswMap[assignment.pswId.toString()] = psw;
  }

  // ── Conflict guard for all assignments ──
  for (const assignment of request.slotAssignments) {
    const psw = pswMap[assignment.pswId.toString()];
    for (const slotTime of assignment.slots) {
      const start = new Date(slotTime.startTime);
      const end = new Date(slotTime.endTime);
      if (await hasSlotConflict(psw._id, start, end)) {
        throw Object.assign(
          new Error(`Time conflict: ${psw.firstName} ${psw.lastName} is already booked at ${start.toISOString()}`),
          { status: 409 }
        );
      }
    }
  }

  // ── Compute overall date range ──
  const allTimes = request.slotAssignments.flatMap(a => a.slots);
  const allStarts = allTimes.map(s => new Date(s.startTime));
  const allEnds = allTimes.map(s => new Date(s.endTime));
  const overallStart = new Date(Math.min(...allStarts));
  const overallEnd = new Date(Math.max(...allEnds));

  // ── Create shared BookingBlock ──
  const bookingBlock = new BookingBlock({
    userId: request.userId || null,
    clientId: request.clientId || request.contact?.email || "walk-in",
    serviceAddress: request.serviceAddress || {},
    createdBy: request.source === "phone" ? "representative" : "client",
    contact: request.contact,
    startDate: overallStart,
    endDate: overallEnd,
    slots: []
  });
  await bookingBlock.save();

  const bookings = [];
  const allSlots = [];

  for (const assignment of request.slotAssignments) {
    const psw = pswMap[assignment.pswId.toString()];
    const serviceType = (psw.serviceType && psw.serviceType[0]) || "Personal Support";
    const assignmentStarts = assignment.slots.map(s => new Date(s.startTime));
    const assignmentEnds = assignment.slots.map(s => new Date(s.endTime));
    const firstStart = new Date(Math.min(...assignmentStarts));
    const lastEnd = new Date(Math.max(...assignmentEnds));

    // ── Create Booking for this PSW ──
    const assignmentHours = assignment.slots.reduce((sum, s) => {
      return sum + (new Date(s.endTime) - new Date(s.startTime)) / 3600000;
    }, 0);
    const hourlyRate = SERVICE_RATES[request.serviceLevel] || null;
    const totalAmount = hourlyRate ? Math.round(hourlyRate * assignmentHours * 100) / 100 : null;

    const isRecurring = !isOneTime && (request.lengthOfCareWeeks || 1) > 1;

    const booking = new Booking({
      userId: request.userId || null,
      pswWorker: psw._id,
      client: request.clientId || request.contact?.email || "walk-in",
      serviceAddress: request.serviceAddress || {},
      serviceType,
      serviceLevel: request.serviceLevel || null,
      bookingDate: firstStart,
      bookingTime: `${startHour}:00`,
      startTime: firstStart,
      endTime: lastEnd,
      recurring: isRecurring,
      recurringInterval: isRecurring ? "weekly" : null,
      daysPerWeek: request.daysPerWeek || null,
      preferredDays: request.preferredDays && request.preferredDays.length > 0
        ? request.preferredDays
        : [...new Set(assignment.slots.map(s => new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' })))],
      lengthOfCareWeeks: request.lengthOfCareWeeks || null,
      visitDuration: request.visitDuration || null,
      totalSlots: assignment.slots.length,
      status: "pending",
      hourlyRate,
      totalHours: Math.round(assignmentHours * 100) / 100,
      totalAmount
    });
    await booking.save();
    bookings.push(booking);

    // ── Create BookingSlots ──
    for (const slotTime of assignment.slots) {
      const start = new Date(slotTime.startTime);
      const end = new Date(slotTime.endTime);

      // Re-check conflict right before insert
      if (await hasSlotConflict(psw._id, start, end)) {
        // Rollback everything
        await BookingSlot.deleteMany({ bookingBlock: bookingBlock._id });
        await BookingBlock.findByIdAndDelete(bookingBlock._id);
        for (const b of bookings) await Booking.findByIdAndDelete(b._id);
        throw Object.assign(
          new Error(`Conflict detected during split-booking slot creation for ${start.toISOString()}. All bookings rolled back.`),
          { status: 409 }
        );
      }

      const slot = new BookingSlot({
        bookingBlock: bookingBlock._id,
        pswWorker: psw._id,
        startTime: start,
        endTime: end,
        status: "scheduled"
      });
      await slot.save();
      allSlots.push(slot);
    }
  }

  bookingBlock.slots = allSlots.map(s => s._id);
  await bookingBlock.save();

  request.status = "booked";
  request.bookingId = bookings[0]._id;
  await request.save();

  // Build per-PSW summary
  const pswSummaries = request.slotAssignments.map(a => ({
    pswId: a.pswId,
    pswName: a.pswName,
    slotCount: a.slots.length
  }));

  return {
    booking: bookings[0],
    bookings,
    bookingBlock,
    slots: allSlots,
    request,
    summary: {
      bookingId: bookings[0]._id,
      pswName: pswSummaries.map(p => p.pswName).join(" + "),
      totalSlots: allSlots.length,
      startDate: overallStart,
      endDate: overallEnd,
      recurring: bookings[0].recurring,
      status: bookings[0].status,
      bookingType: request.bookingType || "recurring",
      splitBooking: true,
      assignments: pswSummaries
    }
  };
}

module.exports = { finalizeBookingRequest };
