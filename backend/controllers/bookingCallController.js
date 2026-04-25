const axios = require("axios");
const BookingRequest = require("../models/BookingRequest");
const Booking = require("../models/Booking");
const BookingSlot = require("../models/BookingSlot");
const Client = require("../models/Client");
const User = require("../models/User");
const ServiceLevel = require("../models/ServiceLevel");
const { matchPSWs } = require("../services/pswMatchingEngine");
const { finalizeBookingRequest } = require("../services/bookingFinalizer");
const { generateSlotTimes } = require("../services/slotTimeGenerator");

// Retell AI API Configuration
const RETELL_API_BASE = "https://api.retellai.com";
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// ── Canadian postal-code prefix → IANA timezone mapping ──
// First letter of postal code determines the province/territory
const POSTAL_PREFIX_TO_TIMEZONE = {
  A: "America/St_Johns",      // Newfoundland
  B: "America/Halifax",       // Nova Scotia
  C: "America/Halifax",       // Prince Edward Island
  E: "America/Moncton",       // New Brunswick
  G: "America/Toronto",       // Eastern Quebec
  H: "America/Toronto",       // Montreal area
  J: "America/Toronto",       // Western Quebec
  K: "America/Toronto",       // Eastern Ontario
  L: "America/Toronto",       // Central Ontario
  M: "America/Toronto",       // Toronto
  N: "America/Toronto",       // Southwestern Ontario
  P: "America/Toronto",       // Northern Ontario
  R: "America/Winnipeg",      // Manitoba
  S: "America/Regina",        // Saskatchewan
  T: "America/Edmonton",      // Alberta
  V: "America/Vancouver",     // British Columbia
  X: "America/Yellowknife",   // NWT / Nunavut
  Y: "America/Whitehorse",    // Yukon
};

function timezoneFromPostalCode(postalCode) {
  if (!postalCode) return "America/Toronto";
  const prefix = postalCode.trim().charAt(0).toUpperCase();
  return POSTAL_PREFIX_TO_TIMEZONE[prefix] || "America/Toronto";
}

// Helper function to make Retell API calls
async function retellAPI(endpoint, method = "GET", data = null) {
  try {
    const config = {
      method,
      url: `${RETELL_API_BASE}${endpoint}`,
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json"
      }
    };
    if (data) config.data = data;
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Retell API error [${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
}

// ── FSA → coordinate map for postal-code geo lookup ──────────
const { geocodePostalCode, FSA_COORDINATES } = require("../services/geocoder");

// ── POST /booking-calls/initiate ─────────────────────────────
exports.initiateBookingCall = async (req, res) => {
  try {
    const { clientId, userId, phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "phoneNumber is required" });
    }
    if (!clientId && !userId) {
      return res.status(400).json({ message: "clientId or userId is required" });
    }

    let callerName = "Customer";
    let callerPostalCode = "";
    let callerCity = "Toronto";
    let resolvedClientId = clientId || null;
    let resolvedUserId = userId || null;

    // Prefer User lookup, fall back to legacy Client
    if (userId) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      callerName = `${user.firstName} ${user.lastName}`;
      callerPostalCode = user.address?.postalCode || "";
      callerCity = user.address?.city || "Toronto";
      resolvedUserId = user._id.toString();
    } else if (clientId) {
      const client = await Client.findById(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      callerName = `${client.firstName} ${client.lastName}`;
      callerPostalCode = client.address?.postalCode || "";
      callerCity = client.address?.city || "Toronto";
    }

    const callResponse = await retellAPI("/v2/create-phone-call", "POST", {
      from_number: process.env.RETELL_FROM_NUMBER,
      to_number: phoneNumber,
      override_agent_id: process.env.RETELL_AGENT_ID,
      metadata: {
        client_id: resolvedClientId,
        user_id: resolvedUserId,
        client_name: callerName,
        client_postal_code: callerPostalCode,
        client_city: callerCity
      },
      retell_llm_dynamic_variables: {
        customer_name: callerName,
        client_id: resolvedClientId || "",
        user_id: resolvedUserId || "",
        current_time: new Date().toLocaleString(),
        client_postal_code: callerPostalCode,
        client_city: callerCity
      }
    });

    res.status(201).json({
      message: "Booking call initiated",
      callId: callResponse.call_id,
      status: callResponse.call_status,
      caller: { userId: resolvedUserId, clientId: resolvedClientId, name: callerName }
    });
  } catch (error) {
    console.error("Error initiating call:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ── POST /booking-calls/webhook ──────────────────────────────
//
// Handles Retell's post-call webhook in TWO formats:
//   1) Envelope format (conversation flow):
//      { event: "call_ended", call: { call_id, transcript, metadata, call_analysis } }
//   2) Flat format (legacy / single-prompt):
//      { call_id, transcript, metadata }
//
// Data extraction priority:
//   a) call_analysis.custom_analysis_data  (structured — set via post_call_analysis_data on the agent)
//   b) Transcript regex parsing            (fallback)
//
exports.handleBookingCallWebhook = async (req, res) => {
  try {
    // ── Normalise the two possible webhook shapes ──
    const isEnvelope = !!(req.body.event && req.body.call);
    const call       = isEnvelope ? req.body.call : req.body;
    const event      = req.body.event || "call_ended";

    const callId     = call.call_id;
    const transcript = call.transcript || "";
    const metadata   = call.metadata || {};
    const analysis   = call.call_analysis?.custom_analysis_data || {};

    console.log(`[Webhook] Received event="${event}" call_id=${callId}`);

    // Only act on call_ended / call_analyzed
    if (event !== "call_ended" && event !== "call_analyzed") {
      return res.status(200).json({ status: "ignored", event });
    }

    if (!transcript && Object.keys(analysis).length === 0) {
      return res.status(400).json({ message: "No transcript or analysis data" });
    }

    // ── Check if booking was confirmed ──
    const confirmed =
      analysis.booking_confirmed === true ||
      analysis.booking_confirmed === "true" ||
      analysis.booking_confirmed === "yes" ||
      transcript.toLowerCase().includes("booking_confirmed");

    if (!confirmed) {
      console.log(`[Webhook] Call ${callId}: booking not confirmed`);
      return res.status(200).json({ status: "not_confirmed", call_id: callId });
    }

    // ── Build booking data (structured first, transcript fallback) ──
    let bookingData;

    if (analysis.city && analysis.postal_code) {
      console.log(`[Webhook] Using structured analysis data`);
      bookingData = await buildFromAnalysis(analysis, metadata);
    } else if (transcript) {
      console.log(`[Webhook] Falling back to transcript parsing`);
      bookingData = parseBookingFromTranscript(transcript, metadata);
    } else {
      return res.status(200).json({ status: "no_data", call_id: callId });
    }

    if (!bookingData.isValid) {
      console.log(`[Webhook] Call ${callId}: incomplete data`, bookingData);
      return res.status(200).json({ status: "incomplete", call_id: callId, parsed: bookingData });
    }

    // ── Find or create a User for this caller ──
    let userId = null;

    // If the call was initiated with a known userId, use it directly
    if (metadata.user_id) {
      const existingUser = await User.findById(metadata.user_id);
      if (existingUser) {
        userId = existingUser._id;
        console.log(`[Webhook] Using pre-linked User ${userId} from call metadata`);
      }
    }

    if (!userId && (bookingData.phone || bookingData.email)) {
      const phoneVariants = [];
      if (bookingData.phone) {
        const raw = bookingData.phone.replace(/[\s()-]/g, "");
        phoneVariants.push(raw);
        if (raw.startsWith("+1")) phoneVariants.push(raw.slice(2));
        else if (raw.startsWith("1") && raw.length === 11) phoneVariants.push("+" + raw, raw.slice(1));
        else phoneVariants.push("+1" + raw, "1" + raw);
      }

      const orConditions = [];
      if (phoneVariants.length) orConditions.push({ phone: { $in: phoneVariants } });
      if (bookingData.email) orConditions.push({ email: bookingData.email });

      let user = await User.findOne({ $or: orConditions });

      if (!user) {
        // Extract name from metadata or analysis
        const callerName = (metadata.client_name || analysis.caller_name || "").trim();
        const [firstName, ...rest] = callerName.split(/\s+/);
        user = await User.create({
          firstName: firstName || "Phone",
          lastName: rest.join(" ") || "Caller",
          email: bookingData.email || undefined,
          phone: bookingData.phone || undefined,
          source: "phone"
        });
        console.log(`[Webhook] Created phone User ${user._id} (${user.firstName} ${user.lastName})`);
      } else {
        // Back-fill phone if user was created via web without phone
        if (bookingData.phone && !user.phone) {
          user.phone = bookingData.phone;
          await user.save();
        }
        console.log(`[Webhook] Matched existing User ${user._id} (${user.firstName} ${user.lastName})`);
      }
      userId = user._id;
    }

    // ── Save BookingRequest to MongoDB ──
    const bookingRequest = new BookingRequest({
      userId,
      clientId: bookingData.clientId,
      serviceLevel: bookingData.serviceLevel || null,
      location: {
        city: bookingData.city,
        postalCode: bookingData.postalCode,
        coordinates: bookingData.coordinates
      },
      serviceAddress: {
        street: bookingData.streetAddress || "",
        city: bookingData.city,
        postalCode: bookingData.postalCode,
        coordinates: bookingData.coordinates
      },
      daysPerWeek: bookingData.daysPerWeek,
      timeOfDay: bookingData.timeOfDay,
      visitDuration: bookingData.visitDuration,
      lengthOfCareWeeks: bookingData.lengthOfCareWeeks,
      contact: {
        email: bookingData.email,
        phone: bookingData.phone
      },
      source: "phone",
      timezone: timezoneFromPostalCode(bookingData.postalCode)
    });

    // If client selected a PSW during the call, attach it
    if (bookingData.chosenPSWName) {
      bookingRequest.selectedPSW = {
        name: bookingData.chosenPSWName
      };
    }

    await bookingRequest.save();
    console.log(`[Webhook] BookingRequest created: ${bookingRequest._id}`);

    // ── Run PSW matching ──
    const matches = await matchPSWs({
      coordinates: bookingRequest.location.coordinates,
      postalCode: bookingRequest.location.postalCode,
      timeOfDay: bookingRequest.timeOfDay,
      daysPerWeek: bookingRequest.daysPerWeek,
      visitDuration: bookingRequest.visitDuration,
      serviceLevel: bookingRequest.serviceLevel
    });

    bookingRequest.availabilityCount = matches.length;
    bookingRequest.matchedPSWs = matches.slice(0, 5).map(m => m.psw._id);

    // Resolve selected PSW ID from name if provided
    if (bookingData.chosenPSWName && matches.length > 0) {
      const chosenName = bookingData.chosenPSWName.toLowerCase();
      const matched = matches.find(m =>
        `${m.psw.firstName} ${m.psw.lastName}`.toLowerCase() === chosenName ||
        m.psw.firstName.toLowerCase() === chosenName ||
        m.psw.lastName.toLowerCase() === chosenName
      );
      if (matched) {
        bookingRequest.selectedPSW = {
          pswId: matched.psw._id,
          name: `${matched.psw.firstName} ${matched.psw.lastName}`
        };
        console.log(`[Webhook] Client selected PSW: ${matched.psw.firstName} ${matched.psw.lastName}`);
      }
    }

    await bookingRequest.save();

    console.log(`[Webhook] Matched ${matches.length} PSW(s) for request ${bookingRequest._id}`);

    // ── Auto-finalize if a PSW was selected ──
    // Check for partial availability and build split assignments if needed
    let finalizeResult = null;
    if (bookingRequest.selectedPSW?.pswId) {
      try {
        // Compute the slot times for this request
        const slotTimes = generateSlotTimes(bookingRequest);

        // Check which slots the chosen PSW can cover
        const chosenPswId = bookingRequest.selectedPSW.pswId;
        const chosenPswName = bookingRequest.selectedPSW.name;
        const availableSlots = [];
        const conflictedSlots = [];

        for (const time of slotTimes) {
          const conflict = await BookingSlot.findOne({
            pswWorker: chosenPswId,
            status: { $ne: "cancelled" },
            startTime: { $lt: time.end },
            endTime: { $gt: time.start }
          });
          if (conflict) {
            conflictedSlots.push(time);
          } else {
            availableSlots.push(time);
          }
        }

        if (conflictedSlots.length > 0 && availableSlots.length > 0 && matches.length > 1) {
          // Partial availability — build split assignments
          console.log(`[Webhook] ${chosenPswName} partially available: ${availableSlots.length}/${slotTimes.length} slots`);

          const slotAssignments = [{
            pswId: chosenPswId,
            pswName: chosenPswName,
            slots: availableSlots.map(t => ({ date: t.start, startTime: t.start, endTime: t.end }))
          }];

          // Find backup PSW for conflicted slots
          const backupPSW = matches.find(m => m.psw._id.toString() !== chosenPswId.toString());
          if (backupPSW) {
            slotAssignments.push({
              pswId: backupPSW.psw._id,
              pswName: `${backupPSW.psw.firstName} ${backupPSW.psw.lastName}`,
              slots: conflictedSlots.map(t => ({ date: t.start, startTime: t.start, endTime: t.end }))
            });
            console.log(`[Webhook] Assigned ${conflictedSlots.length} overflow slots to ${backupPSW.psw.firstName} ${backupPSW.psw.lastName}`);
          }

          bookingRequest.slotAssignments = slotAssignments;
          bookingRequest.status = "confirmed";
          await bookingRequest.save();

          finalizeResult = await finalizeBookingRequest(bookingRequest._id, {
            skipAvailabilityCheck: true
          });
          console.log(`[Webhook] Auto-finalized split booking → ${finalizeResult.bookings.length} bookings, ${finalizeResult.slots.length} slots`);
        } else if (conflictedSlots.length === 0) {
          // Fully available — standard finalization
          bookingRequest.status = "confirmed";
          await bookingRequest.save();

          finalizeResult = await finalizeBookingRequest(bookingRequest._id, {
            skipAvailabilityCheck: true
          });
          console.log(`[Webhook] Auto-finalized → Booking ${finalizeResult.booking._id} with ${finalizeResult.slots.length} slots`);
        } else {
          console.log(`[Webhook] ${chosenPswName} fully conflicted or no backup PSW — skipping auto-finalize`);
        }
      } catch (finErr) {
        console.error(`[Webhook] Auto-finalize failed: ${finErr.message}`);
        // Not fatal — the request is saved, can be finalized later
      }
    }

    res.json({
      status: "success",
      call_id: callId,
      bookingRequestId: bookingRequest._id,
      bookingId: finalizeResult?.booking?._id || null,
      finalized: !!finalizeResult,
      availabilityCount: matches.length,
      topMatches: matches.slice(0, 3).map(m => ({
        name: `${m.psw.firstName} ${m.psw.lastName}`,
        score: m.score
      })),
      message: finalizeResult
        ? "Booking created from phone call — PSW matched and scheduled"
        : "Booking request created from phone call — PSWs matched"
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ── GET /booking-calls/:callId/status ────────────────────────
exports.getCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const callStatus = await retellAPI(`/v2/get-call/${callId}`);

    res.json({
      callId: callStatus.call_id,
      status: callStatus.call_status,
      duration: callStatus.duration_ms,
      transcript: callStatus.transcript,
      recording: callStatus.recording_url,
      analysis: callStatus.call_analysis || null
    });
  } catch (error) {
    console.error("Error fetching call status:", error);
    res.status(500).json({ message: error.message });
  }
};

// ── POST /booking-calls/lookup-psws ──────────────────────────
//
// Called by Retell as a custom tool mid-conversation.
// Retell sends: { args: { postal_code, city, time_of_day }, call_id }
// Returns: list of nearby PSWs with name, rating, experience, specialties
//
exports.lookupPSWsByPostalCode = async (req, res) => {
  try {
    // Retell custom tools send args in req.body.args
    const args = req.body.args || req.body;
    const postalCodeRaw = (args.postal_code || args.postalCode || "").toUpperCase().replace(/\s/g, "");
    const city = args.city || "";
    const timeOfDay = args.time_of_day || args.timeOfDay || null;

    if (!postalCodeRaw || postalCodeRaw.length < 3) {
      return res.status(400).json({
        result: "I couldn't find any caregivers — the postal code seems invalid. Could you repeat it?"
      });
    }

    const postalCode = postalCodeRaw.length === 6
      ? postalCodeRaw.slice(0, 3) + " " + postalCodeRaw.slice(3)
      : postalCodeRaw;
    const coordinates = geocodePostalCode(postalCodeRaw);

    console.log(`[Lookup] PSW search for postal=${postalCode} city=${city} time=${timeOfDay}`);

    const daysPerWeek = parseInt(args.days_per_week || args.daysPerWeek) || null;
    const visitDuration = args.visit_duration || args.visitDuration || null;
    const serviceLevel = args.service_level || args.serviceLevel || null;

    // Run PSW matching with full availability checks
    const matches = await matchPSWs({
      coordinates,
      postalCode,
      timeOfDay,
      daysPerWeek,
      visitDuration,
      serviceLevel
    });

    if (matches.length === 0) {
      return res.json({
        result: "I wasn't able to find any available caregivers near that postal code right now. Let me take down the rest of your details and our team will follow up with you directly."
      });
    }

    // Build a caller-friendly list (top 5)
    const topPSWs = matches.slice(0, 5).map((m, i) => ({
      number: i + 1,
      name: `${m.psw.firstName} ${m.psw.lastName}`,
      id: m.psw._id.toString(),
      rating: m.psw.rating || 4.5,
      yearsExperience: m.psw.yearsExperience || 1,
      specialties: (m.psw.serviceType || []).join(", ") || "General care",
      city: m.psw.homeAddress?.city || "Toronto",
      score: Math.round(m.score * 100),
      availabilityStatus: m.availabilityStatus || "available"
    }));

    // Build speech-friendly text for the agent to read
    const statusLabel = {
      available: "",
      partial: " — note: they have some dates already booked, so we may need a second caregiver for the remaining dates",
      limited: " (very limited availability)"
    };
    const pswList = topPSWs.map(p =>
      `${p.number}. ${p.name} — ${p.yearsExperience} years experience, rated ${p.rating} out of 5, specializing in ${p.specialties}${statusLabel[p.availabilityStatus] || ""}`
    ).join(". ");

    console.log(`[Lookup] Found ${topPSWs.length} PSW(s) near ${postalCode}`);

    res.json({
      result: `I found ${topPSWs.length} available caregivers near you: ${pswList}. Which caregiver would you like to book?`,
      psws: topPSWs
    });
  } catch (error) {
    console.error("[Lookup] Error:", error);
    res.json({
      result: "I had trouble looking up caregivers right now. Let me take down the rest of your details and our team will match you with a great caregiver."
    });
  }
};

// ══════════════════════════════════════════════════════════════
//  DATA EXTRACTORS
// ══════════════════════════════════════════════════════════════

// ── PRIMARY: Build from Retell's structured analysis data ────
async function buildFromAnalysis(analysis, metadata) {
  const postalRaw = (analysis.postal_code || "").toUpperCase().replace(/\s/g, "");
  const postalCode = postalRaw.length === 6
    ? postalRaw.slice(0, 3) + " " + postalRaw.slice(3)
    : analysis.postal_code || null;
  const fsa = postalRaw.slice(0, 3);

  const daysPerWeek = parseInt(analysis.days_per_week);
  const lengthOfCareWeeks = parseInt(analysis.length_of_care_weeks);

  // Normalise time_of_day to match schema enum
  const rawTime = (analysis.time_of_day || "").toLowerCase();
  const timeOfDay = ["daytime", "evening", "overnight", "weekend"].find(t => rawTime.includes(t)) || null;

  // Normalise visit_duration to match schema enum
  const rawDuration = (analysis.visit_duration || "").toLowerCase();
  let visitDuration = null;
  if (rawDuration.includes("more than 6") || rawDuration.includes("over 6")) visitDuration = "more than 6 hours";
  else if (rawDuration.includes("4") && rawDuration.includes("6")) visitDuration = "4-6 hours";
  else if (rawDuration.includes("2") && rawDuration.includes("3")) visitDuration = "2-3 hours";
  else if (rawDuration.includes("1 hour") || rawDuration.includes("one hour") || rawDuration === "1") visitDuration = "1 hour";

  const result = {
    isValid: false,
    clientId: metadata?.client_id || null,
    city: analysis.city || null,
    postalCode,
    coordinates: FSA_COORDINATES[fsa] || null,
    daysPerWeek: isNaN(daysPerWeek) ? null : daysPerWeek,
    timeOfDay,
    visitDuration,
    lengthOfCareWeeks: isNaN(lengthOfCareWeeks) ? null : lengthOfCareWeeks,
    email: analysis.email || null,
    phone: analysis.phone || null,
    chosenPSWName: analysis.chosen_psw_name || analysis.selected_psw || null,
    streetAddress: analysis.street_address || null,
    serviceLevel: null
  };

  // Normalise service_level against DB-driven levels
  const rawLevel = (analysis.service_level || "").toLowerCase().replace(/[\s-]+/g, "_");
  try {
    const activeLevels = await ServiceLevel.find({ active: true }).select("key label").lean();
    const validKeys = activeLevels.map(l => l.key);
    if (validKeys.includes(rawLevel)) {
      result.serviceLevel = rawLevel;
    } else {
      // Fuzzy match by checking if the raw level text is contained in any key or label
      const match = activeLevels.find(l =>
        rawLevel.includes(l.key) || l.key.includes(rawLevel) ||
        l.label.toLowerCase().replace(/[\s-]+/g, "_").includes(rawLevel) ||
        rawLevel.includes(l.label.toLowerCase().replace(/[\s-]+/g, "_"))
      );
      if (match) result.serviceLevel = match.key;
    }
  } catch {
    // Fallback to static matching if DB unavailable
    if (rawLevel.includes("home")) result.serviceLevel = "home_helper";
    else if (rawLevel.includes("specialized") || rawLevel.includes("special")) result.serviceLevel = "specialized_care";
    else if (rawLevel.includes("care")) result.serviceLevel = "care_services";
  }

  result.isValid = !!(
    result.city &&
    result.postalCode &&
    result.daysPerWeek &&
    result.timeOfDay &&
    result.visitDuration &&
    result.lengthOfCareWeeks
  );

  return result;
}

// ── FALLBACK: Parse from raw transcript text ─────────────────
function parseBookingFromTranscript(transcript, metadata) {
  const text = transcript.toLowerCase();

  const result = {
    isValid: false,
    clientId: metadata?.client_id || null,
    city: null,
    postalCode: null,
    coordinates: null,
    daysPerWeek: null,
    timeOfDay: null,
    visitDuration: null,
    lengthOfCareWeeks: null,
    email: null,
    phone: null,
    chosenPSWName: null,
    streetAddress: null,
    serviceLevel: null
  };

  if (!result.clientId) return result;

  // CITY
  const cities = ["toronto", "scarborough", "markham", "north york", "etobicoke", "mississauga"];
  for (const city of cities) {
    if (text.includes(city)) {
      result.city = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  // POSTAL CODE — Canadian format: A1A 1A1 or A1A1A1
  const postalMatch = transcript.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
  if (postalMatch) {
    const raw = postalMatch[0].toUpperCase().replace(/\s/g, "");
    result.postalCode = raw.slice(0, 3) + " " + raw.slice(3);
    result.coordinates = FSA_COORDINATES[raw.slice(0, 3)] || null;
  }

  // DAYS PER WEEK
  const daysMatch = text.match(/(\d)\s*days?\s*(per|a)\s*week/);
  if (daysMatch) {
    result.daysPerWeek = parseInt(daysMatch[1]);
  } else {
    const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    for (const [word, num] of Object.entries(wordNums)) {
      if (text.includes(`${word} day`)) { result.daysPerWeek = num; break; }
    }
  }

  // TIME OF DAY
  for (const opt of ["daytime", "evening", "overnight", "weekend"]) {
    if (text.includes(opt)) { result.timeOfDay = opt; break; }
  }

  // VISIT DURATION
  if (text.includes("more than 6") || text.includes("over 6")) result.visitDuration = "more than 6 hours";
  else if (text.includes("4") && text.includes("6")) result.visitDuration = "4-6 hours";
  else if (text.includes("2") && text.includes("3")) result.visitDuration = "2-3 hours";
  else if (text.match(/\b1\s*hour\b/) || text.includes("one hour")) result.visitDuration = "1 hour";

  // LENGTH OF CARE (weeks)
  const weeksMatch = text.match(/(\d+)\s*weeks?/);
  if (weeksMatch) result.lengthOfCareWeeks = parseInt(weeksMatch[1]);

  // EMAIL
  const emailMatch = transcript.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) result.email = emailMatch[0].toLowerCase();

  // PHONE
  const phoneMatch = transcript.match(/\+?\d[\d\s()-]{8,}/);
  if (phoneMatch) result.phone = phoneMatch[0].replace(/[\s()-]/g, "");

  // STREET ADDRESS — look for common patterns like "123 Main Street" or "45 Elm Ave Unit 2"
  const streetMatch = transcript.match(/\d+\s+[A-Za-z][A-Za-z\s]+(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|crescent|cres|court|ct|lane|ln|circle|cir|place|pl)\b[^.\n]*/i);
  if (streetMatch) result.streetAddress = streetMatch[0].trim();

  // SERVICE LEVEL
  if (text.includes("specialized care") || text.includes("specialized")) result.serviceLevel = "specialized_care";
  else if (text.includes("care services") || text.includes("care service")) result.serviceLevel = "care_services";
  else if (text.includes("home helper") || text.includes("home help")) result.serviceLevel = "home_helper";

  result.isValid = !!(
    result.city &&
    result.postalCode &&
    result.daysPerWeek &&
    result.timeOfDay &&
    result.visitDuration &&
    result.lengthOfCareWeeks
  );

  return result;
}

// ── POST /booking-calls/identify ─────────────────────────────
//
// Called by Retell as a custom tool at the start of an inbound call.
// Looks up a User by phone number to identify returning callers.
//
// Retell sends: { args: { phone_number } }
// Returns: caller identity + active bookings summary

exports.identifyCaller = async (req, res) => {
  try {
    const args = req.body.args || req.body;
    const rawPhone = (args.phone_number || args.phone || "").replace(/[\s()-]/g, "");

    if (!rawPhone || rawPhone.length < 10) {
      return res.json({
        result: "I wasn't able to identify you from your phone number. No worries — let's get you set up. Could I get your first and last name?",
        identified: false
      });
    }

    // Look up by phone (try with and without +1 prefix)
    const phoneVariants = [rawPhone];
    if (rawPhone.startsWith("+1")) phoneVariants.push(rawPhone.slice(2));
    else if (rawPhone.startsWith("1") && rawPhone.length === 11) phoneVariants.push("+" + rawPhone, rawPhone.slice(1));
    else phoneVariants.push("+1" + rawPhone, "1" + rawPhone);

    const user = await User.findOne({ phone: { $in: phoneVariants } });

    if (!user) {
      return res.json({
        result: "I don't have an account on file for this phone number. Let's create one — could I get your first and last name?",
        identified: false
      });
    }

    // Fetch active bookings for this user
    const activeBookings = await Booking.find({
      userId: user._id,
      status: { $ne: "cancelled" }
    }).populate("pswWorker").lean();

    const bookingSummaries = activeBookings.map(b => ({
      bookingId: b._id.toString(),
      pswName: b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : "TBD",
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      recurring: b.recurring
    }));

    const bookingText = activeBookings.length > 0
      ? `You have ${activeBookings.length} active booking${activeBookings.length > 1 ? "s" : ""}: ${bookingSummaries.map((b, i) => `${i + 1}. ${b.recurring ? "Recurring" : "One-time"} care with ${b.pswName}`).join("; ")}.`
      : "You don't have any active bookings right now.";

    console.log(`[Identify] Found user ${user.firstName} ${user.lastName} (${user._id}) with ${activeBookings.length} active bookings`);

    res.json({
      result: `Welcome back, ${user.firstName}! ${bookingText} Would you like to make a new booking or change an existing one?`,
      identified: true,
      user_id: user._id.toString(),
      user_name: `${user.firstName} ${user.lastName}`,
      user_email: user.email,
      active_bookings: bookingSummaries
    });
  } catch (error) {
    console.error("[Identify] Error:", error);
    res.json({
      result: "I had a bit of trouble looking up your account. Let's continue — could I get your name?",
      identified: false
    });
  }
};

// ── POST /booking-calls/user-bookings ────────────────────────
//
// Called by Retell mid-call to fetch a user's active bookings
// for modification (reschedule, cancel, etc.)
//
// Retell sends: { args: { user_id } }

exports.getUserBookings = async (req, res) => {
  try {
    const args = req.body.args || req.body;
    const userId = args.user_id;

    if (!userId) {
      return res.json({
        result: "I don't have your account information. Let me help you make a new booking instead."
      });
    }

    const bookings = await Booking.find({
      userId,
      status: { $ne: "cancelled" }
    }).populate("pswWorker").lean();

    if (bookings.length === 0) {
      return res.json({
        result: "You don't have any active bookings. Would you like to make a new booking?",
        bookings: []
      });
    }

    const summaries = bookings.map((b, i) => {
      const pswName = b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : "TBD";
      const dateStr = b.startTime ? new Date(b.startTime).toLocaleDateString() : "Pending";
      return `${i + 1}. ${b.recurring ? "Recurring" : "One-time"} care with ${pswName}, starting ${dateStr}, status: ${b.status}`;
    });

    res.json({
      result: `Here are your active bookings: ${summaries.join(". ")}. Which one would you like to change?`,
      bookings: bookings.map(b => ({
        bookingId: b._id.toString(),
        pswName: b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : "TBD",
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        recurring: b.recurring
      }))
    });
  } catch (error) {
    console.error("[UserBookings] Error:", error);
    res.json({
      result: "I had trouble retrieving your bookings. Let me help you with a new booking instead."
    });
  }
};
