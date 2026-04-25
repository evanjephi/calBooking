const BookingRequest = require("../models/BookingRequest");
const Booking = require("../models/Booking");
const User = require("../models/User");
const ServiceLevel = require("../models/ServiceLevel");
const { matchPSWs } = require("./pswMatchingEngine");
const { finalizeBookingRequest } = require("./bookingFinalizer");
const { geocodePostalCode } = require("./geocoder");

// ── Build tool definitions dynamically from DB service levels ──

async function getToolDefinitions() {
  let serviceLevelEnum = ["home_helper", "care_services", "specialized_care"]; // fallback
  try {
    const levels = await ServiceLevel.find({ active: true }).select("key").lean();
    if (levels.length) serviceLevelEnum = levels.map(l => l.key);
  } catch { /* use fallback */ }

  return [
  {
    type: "function",
    function: {
      name: "create_booking_request",
      description:
        "Create a new booking request after collecting: service level, booking type, location (city + postal code), schedule preferences. Call this once you have enough info.",
      parameters: {
        type: "object",
        properties: {
          serviceLevel: {
            type: "string",
            enum: serviceLevelEnum,
            description: "The care level needed.",
          },
          bookingType: {
            type: "string",
            enum: ["one-time", "recurring"],
            description: "One-time visit or recurring schedule.",
          },
          city: { type: "string", description: "City name, e.g. Toronto, Scarborough." },
          postalCode: { type: "string", description: "Canadian postal code, e.g. M1B 2W3." },
          street: { type: "string", description: "Street address (optional)." },
          unit: { type: "string", description: "Unit/apartment number (optional)." },
          daysPerWeek: {
            type: "number",
            description: "How many days per week (1-7). Required for recurring.",
          },
          preferredDays: {
            type: "array",
            items: { type: "string", enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] },
            description: "Which specific days of the week. Optional.",
          },
          timeOfDay: {
            type: "string",
            enum: ["daytime", "evening", "overnight", "weekend"],
            description: "Preferred time slot.",
          },
          visitDuration: {
            type: "string",
            enum: ["1 hour", "2-3 hours", "4-6 hours", "more than 6 hours"],
            description: "How long each visit should be.",
          },
          lengthOfCareWeeks: {
            type: "number",
            description: "How many weeks of care. Required for recurring.",
          },
          specificDate: {
            type: "string",
            description: "ISO date string for one-time bookings, e.g. 2026-04-10.",
          },
          preferredStartHour: {
            type: "number",
            description: "Start hour in 24h format (0-23). ALWAYS include this when the user mentions a specific time (e.g. user says '10 AM' → 10, '2 PM' → 14). If not specified by the user, ask them what time they'd like the visit to start.",
          },
        },
        required: ["serviceLevel", "bookingType", "city", "postalCode", "timeOfDay", "visitDuration", "preferredStartHour"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check which PSWs are available for a booking request. Call after create_booking_request. Returns matched caregivers with distance and availability status.",
      parameters: {
        type: "object",
        properties: {
          bookingRequestId: {
            type: "string",
            description: "The booking request ID from create_booking_request.",
          },
        },
        required: ["bookingRequestId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select_psw_and_finalize",
      description:
        "Select a PSW from the matched results and finalize the booking. Automatically generates slot assignments and completes the booking. Call after check_availability when the user chooses or confirms a PSW.",
      parameters: {
        type: "object",
        properties: {
          bookingRequestId: {
            type: "string",
            description: "The booking request ID.",
          },
          pswIndex: {
            type: "number",
            description:
              "The index (0-based) of the PSW from the availability results to select. Default 0 (top match).",
          },
          contactEmail: {
            type: "string",
            description: "Contact email for the booking. Use user's email if not specified.",
          },
          contactPhone: {
            type: "string",
            description: "Contact phone for the booking. Use user's phone if not specified.",
          },
        },
        required: ["bookingRequestId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_bookings",
      description: "Retrieve the user's current and past bookings.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel a specific booking by its ID.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string", description: "The booking ID to cancel." },
        },
        required: ["bookingId"],
      },
    },
  },
];
}

// ── Tool executors ──

async function executeToolCall(toolName, args, userId, timezone) {
  switch (toolName) {
    case "create_booking_request":
      return await execCreateBookingRequest(args, userId, timezone);
    case "check_availability":
      return await execCheckAvailability(args, userId);
    case "select_psw_and_finalize":
      return await execSelectPSWAndFinalize(args, userId);
    case "get_my_bookings":
      return await execGetMyBookings(userId);
    case "cancel_booking":
      return await execCancelBooking(args, userId);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function execCreateBookingRequest(args, userId, timezone) {
  const geocoded = args.postalCode ? geocodePostalCode(args.postalCode) : null;
  let coords = geocoded || null;
  if (!coords) {
    const userDoc = await User.findById(userId).select("address.coordinates").lean();
    coords =
      userDoc?.address?.coordinates?.length === 2
        ? userDoc.address.coordinates
        : [-79.3832, 43.6532];
  }

  const request = new BookingRequest({
    userId,
    bookingType: args.bookingType || "recurring",
    serviceLevel: args.serviceLevel,
    location: {
      city: args.city,
      postalCode: args.postalCode,
      coordinates: coords,
    },
    serviceAddress: {
      street: args.street || "",
      unit: args.unit || "",
      city: args.city || "",
      postalCode: args.postalCode || "",
      coordinates: coords,
    },
    daysPerWeek: args.daysPerWeek,
    timeOfDay: args.timeOfDay,
    visitDuration: args.visitDuration,
    lengthOfCareWeeks: args.lengthOfCareWeeks,
    preferredDays: args.preferredDays || [],
    preferredStartHour: args.preferredStartHour != null ? args.preferredStartHour : null,
    specificDate: args.specificDate || null,
    timezone: timezone || "America/Toronto",
  });

  await request.save();

  return {
    success: true,
    bookingRequestId: request._id.toString(),
    summary: {
      bookingType: request.bookingType,
      serviceLevel: request.serviceLevel,
      city: args.city,
      postalCode: args.postalCode,
      daysPerWeek: args.daysPerWeek,
      timeOfDay: args.timeOfDay,
      visitDuration: args.visitDuration,
      lengthOfCareWeeks: args.lengthOfCareWeeks,
      preferredStartHour: request.preferredStartHour,
      specificDate: args.specificDate || null,
    },
  };
}

async function execCheckAvailability(args, userId) {
  const request = await BookingRequest.findById(args.bookingRequestId);
  if (!request) return { error: "Booking request not found." };
  if (String(request.userId) !== String(userId))
    return { error: "Not authorized to access this request." };

  const matches = await matchPSWs({
    coordinates: request.location.coordinates,
    postalCode: request.location.postalCode,
    timeOfDay: request.timeOfDay,
    daysPerWeek: request.daysPerWeek,
    visitDuration: request.visitDuration,
    lengthOfCareWeeks: request.lengthOfCareWeeks,
    serviceLevel: request.serviceLevel,
  });

  request.availabilityCount = matches.length;
  request.matchedPSWs = matches.map((m) => m.psw._id);
  await request.save();

  const topMatches = matches.slice(0, 5).map((m, i) => ({
    index: i,
    name: `${m.psw.firstName} ${m.psw.lastName}`,
    distance: m.distance ? `${m.distance.toFixed(1)} km` : "N/A",
    rating: m.psw.rating || "No rating yet",
    yearsExperience: m.psw.yearsExperience || 0,
    availabilityStatus: m.availabilityStatus || "available",
    gender: m.psw.gender || "Not specified",
    bio: m.psw.bio ? m.psw.bio.substring(0, 120) : "",
    pswId: m.psw._id.toString(),
  }));

  return {
    totalAvailable: matches.length,
    topMatches,
    bookingRequestId: args.bookingRequestId,
  };
}

async function execSelectPSWAndFinalize(args, userId) {
  const request = await BookingRequest.findById(args.bookingRequestId);
  if (!request) return { error: "Booking request not found." };
  if (String(request.userId) !== String(userId))
    return { error: "Not authorized." };

  const pswIndex = args.pswIndex || 0;
  if (!request.matchedPSWs || pswIndex >= request.matchedPSWs.length) {
    return { error: "No matched PSW at that index. Run check_availability first." };
  }

  const pswId = request.matchedPSWs[pswIndex];
  const PSWWorker = require("../models/PSWWorker");
  const psw = await PSWWorker.findById(pswId);
  if (!psw) return { error: "PSW not found." };

  // Generate slot times using the existing service
  const { generateSlotTimes } = require("./slotTimeGenerator");
  const slots = generateSlotTimes(request);

  // Set slot assignments — generateSlotTimes returns { start, end }
  request.slotAssignments = [
    {
      pswId: psw._id,
      pswName: `${psw.firstName} ${psw.lastName}`,
      slots: slots.map((s) => ({
        startTime: s.start,
        endTime: s.end,
      })),
    },
  ];

  // Set contact info
  const user = await User.findById(userId).lean();
  request.contact = {
    email: args.contactEmail || user?.email || "",
    phone: args.contactPhone || user?.phone || "",
  };

  request.selectedPSW = { pswId: psw._id, name: `${psw.firstName} ${psw.lastName}` };
  request.status = "confirmed";
  await request.save();

  // Finalize
  const result = await finalizeBookingRequest(request._id);

  return {
    success: true,
    bookingId: result.bookingId?.toString(),
    summary: {
      pswName: `${psw.firstName} ${psw.lastName}`,
      totalSlots: result.summary?.totalSlots,
      startDate: result.summary?.startDate,
      endDate: result.summary?.endDate,
      status: result.summary?.status || "pending",
    },
  };
}

async function execGetMyBookings(userId) {
  const bookings = await Booking.find({ userId })
    .populate("pswWorker", "firstName lastName profilePhoto")
    .sort({ startTime: -1 })
    .lean();

  if (bookings.length === 0) return { bookings: [], message: "You have no bookings yet." };

  return {
    bookings: bookings.map((b) => ({
      id: b._id.toString(),
      pswName: b.pswWorker
        ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}`
        : "TBD",
      status: b.status,
      startTime: b.startTime,
      endTime: b.endTime,
      recurring: b.recurring,
      serviceLevel: b.serviceLevel,
      totalHours: b.totalHours,
      totalSlots: b.totalSlots,
    })),
  };
}

async function execCancelBooking(args, userId) {
  const booking = await Booking.findById(args.bookingId);
  if (!booking) return { error: "Booking not found." };
  if (String(booking.userId) !== String(userId))
    return { error: "Not authorized to cancel this booking." };
  if (booking.status === "cancelled")
    return { error: "This booking is already cancelled." };

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();

  return { success: true, message: "Booking has been cancelled." };
}

module.exports = { getToolDefinitions, executeToolCall };
