const BookingRequest = require("../models/BookingRequest");
const BookingSlot = require("../models/BookingSlot");
const PSWWorker = require("../models/PSWWorker");
const { matchPSWs } = require("../services/pswMatchingEngine");
const { finalizeBookingRequest } = require("../services/bookingFinalizer");
const { generateSlotTimes } = require("../services/slotTimeGenerator");
const { geocodePostalCode } = require("../services/geocoder");
const User = require("../models/User");

// STEP 1-5: Create booking request
exports.createBookingRequest = async (req, res) => {

    try {

        const {
            bookingType,
            city,
            postalCode,
            coordinates,
            street,
            unit,
            daysPerWeek,
            timeOfDay,
            visitDuration,
            lengthOfCareWeeks,
            preferredDays,
            preferredStartHour,
            specificDate,
            serviceLevel
        } = req.body;

        // Geocode from postal code, fall back to user profile coords, then Toronto centre
        const geocoded = postalCode ? geocodePostalCode(postalCode) : null;
        let finalCoords = geocoded || coordinates || null;
        if (!finalCoords) {
            const userDoc = await User.findById(req.user.id).select('address.coordinates').lean();
            finalCoords = userDoc?.address?.coordinates?.length === 2
                ? userDoc.address.coordinates
                : [-79.3832, 43.6532];
        }

        const request = new BookingRequest({
            userId: req.user.id,
            bookingType: bookingType || "recurring",
            serviceLevel: serviceLevel || null,
            location: {
                city,
                postalCode,
                coordinates: finalCoords
            },
            serviceAddress: {
                street: street || "",
                unit: unit || "",
                city: city || "",
                postalCode: postalCode || "",
                coordinates: finalCoords
            },
            daysPerWeek,
            timeOfDay,
            visitDuration,
            lengthOfCareWeeks,
            preferredDays: preferredDays || [],
            preferredStartHour: preferredStartHour != null ? preferredStartHour : null,
            specificDate: specificDate || null
        });

        await request.save();

        res.status(201).json(request);

    } catch (err) {

        res.status(500).json({ message: err.message });

    }

};

// STEP 6: Check availability
exports.checkAvailability = async (req, res) => {

    try {

        const request = await BookingRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        const matches = await matchPSWs({
            coordinates: request.location.coordinates,
            postalCode: request.location.postalCode,
            timeOfDay: request.timeOfDay,
            daysPerWeek: request.daysPerWeek,
            visitDuration: request.visitDuration,
            lengthOfCareWeeks: request.lengthOfCareWeeks,
            serviceLevel: request.serviceLevel
        });

        request.availabilityCount = matches.length;

        request.matchedPSWs = matches.map(m => m.psw._id);

        await request.save();

        res.json({
            availabilityCount: matches.length,
            topMatches: matches.slice(0, 3),
            requestLocation: request.location?.coordinates || null
        });

    } catch (err) {

        res.status(500).json({ message: err.message });

    }

};

// ══════════════════════════════════════════════════════════════
//  PSW Calendar — GET /booking-requests/:id/psw-calendar/:pswId
//  Returns day-by-day availability for a PSW against this request
// ══════════════════════════════════════════════════════════════
exports.getPSWCalendar = async (req, res) => {
    try {
        const request = await BookingRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        const pswId = req.params.pswId;
        const psw = await PSWWorker.findById(pswId);
        if (!psw) {
            return res.status(404).json({ message: "PSW not found" });
        }

        const slotTimes = generateSlotTimes(request);
        const slots = [];
        let availableCount = 0;

        for (const time of slotTimes) {
            const conflict = await BookingSlot.findOne({
                pswWorker: pswId,
                status: { $ne: "cancelled" },
                startTime: { $lt: time.end },
                endTime: { $gt: time.start }
            });
            const available = !conflict;
            if (available) availableCount++;

            slots.push({
                date: time.start.toISOString().split("T")[0],
                startTime: time.start,
                endTime: time.end,
                available
            });
        }

        res.json({
            pswId,
            pswName: `${psw.firstName} ${psw.lastName}`,
            slots,
            summary: {
                total: slots.length,
                available: availableCount,
                conflicted: slots.length - availableCount
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// STEP 7: Contact confirmation
exports.confirmContact = async (req, res) => {

    try {

        const { email, phone } = req.body;

        const request = await BookingRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        request.contact = { email, phone };

        await request.save();

        res.json({
            message: "Contact saved",
            matchedPSWs: request.matchedPSWs
        });

    } catch (err) {

        res.status(500).json({ message: err.message });

    }

};

exports.updateBookingRequest = async (req, res) => {

    try {

        const request = await BookingRequest.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        res.json(request);

    } catch (err) {

        res.status(500).json({ message: err.message });

    }

};

// ══════════════════════════════════════════════════════════════
//  STEP 8: Select PSW — PATCH /booking-requests/:id/select-psw
//  Accepts either { pswId } (single PSW) or { slotAssignments }
// ══════════════════════════════════════════════════════════════
exports.selectPSW = async (req, res) => {
    try {
        const { pswId, slotAssignments } = req.body;

        if (!pswId && (!slotAssignments || slotAssignments.length === 0)) {
            return res.status(400).json({ message: "pswId or slotAssignments is required" });
        }

        const request = await BookingRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.status === "booked") {
            return res.status(400).json({ message: "Request already finalized" });
        }

        // ── Split booking path: slotAssignments ──
        if (slotAssignments && slotAssignments.length > 0) {
            // Validate each PSW exists
            for (const assignment of slotAssignments) {
                const psw = await PSWWorker.findById(assignment.pswId);
                if (!psw) {
                    return res.status(404).json({ message: `PSW ${assignment.pswId} not found` });
                }
                // Backfill name if missing
                if (!assignment.pswName) {
                    assignment.pswName = `${psw.firstName} ${psw.lastName}`;
                }
            }

            request.slotAssignments = slotAssignments;
            request.markModified('slotAssignments'); 
            // Also set selectedPSW to the first/primary PSW for backward compat
            request.selectedPSW = {
                pswId: slotAssignments[0].pswId,
                name: slotAssignments[0].pswName
            };
            await request.save();

            return res.json({
                message: "PSW slot assignments saved",
                slotAssignments: request.slotAssignments,
                selectedPSW: request.selectedPSW
            });
        }

        // ── Single PSW path (existing) ──
        const psw = await PSWWorker.findById(pswId);
        if (!psw) {
            return res.status(404).json({ message: "PSW not found" });
        }

        if (request.matchedPSWs.length > 0) {
            const isMatched = request.matchedPSWs.some(
                id => id.toString() === pswId.toString()
            );
            if (!isMatched) {
                return res.status(400).json({
                    message: "Selected PSW is not in the matched list. Run availability check first."
                });
            }
        }

        request.selectedPSW = {
            pswId: psw._id,
            name: `${psw.firstName} ${psw.lastName}`
        };
        // Clear slotAssignments if switching back to single PSW
        request.slotAssignments = [];
        await request.save();

        res.json({
            message: "PSW selected",
            selectedPSW: request.selectedPSW
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  STEP 9: Confirm — PATCH /booking-requests/:id/confirm
// ══════════════════════════════════════════════════════════════
exports.confirmBooking = async (req, res) => {
    try {
        const request = await BookingRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.status === "booked") {
            return res.status(400).json({ message: "Request already finalized" });
        }

        // Validate all required fields are present
        const missing = [];
        if (!request.location?.city) missing.push("city");
        if (!request.location?.postalCode) missing.push("postalCode");
        if (!request.daysPerWeek) missing.push("daysPerWeek");
        if (!request.timeOfDay) missing.push("timeOfDay");
        if (!request.visitDuration) missing.push("visitDuration");
        if (!request.lengthOfCareWeeks) missing.push("lengthOfCareWeeks");
        if (!request.contact?.email && !request.contact?.phone) missing.push("contact (email or phone)");
        if (!request.selectedPSW?.pswId && !(request.slotAssignments?.length > 0)) missing.push("selectedPSW or slotAssignments");

        if (missing.length > 0) {
            return res.status(400).json({
                message: "Cannot confirm — missing required fields",
                missingFields: missing
            });
        }

        request.status = "confirmed";
        await request.save();

        res.json({
            message: "Booking request confirmed — ready to finalize",
            status: request.status,
            requestId: request._id
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  STEP 10: Finalize — POST /booking-requests/:id/finalize
//  Creates Booking + BookingSlots from confirmed request
// ══════════════════════════════════════════════════════════════
exports.finalizeBooking = async (req, res) => {
    try {
        const request = await BookingRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (request.status !== "confirmed") {
            return res.status(400).json({
                message: `Cannot finalize — request status is "${request.status}". Must be "confirmed".`
            });
        }

        const result = await finalizeBookingRequest(request._id);

        res.status(201).json({
            message: "Booking created successfully",
            bookingId: result.booking._id,
            summary: result.summary
        });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ message: err.message });
    }
};