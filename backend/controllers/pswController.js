const PSWWorker = require("../models/PSWWorker");
const Client = require("../models/Client");

// GET /psws?lng=-79.38&lat=43.65&maxDistance=15000
exports.getPSWs = async (req, res) => {
  try {
    const { lng, lat, maxDistance } = req.query;

    let psws;

    if (lng && lat) {
      // Find PSWs within maxDistance meters
      psws = await PSWWorker.find({
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseInt(maxDistance) || 15000 // default 15km
          }
        }
      });
    } else {
      psws = await PSWWorker.find();
    }

    res.json(psws);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/:id - Single PSW profile
exports.getPSWById = async (req, res) => {
  try {
    const psw = await PSWWorker.findById(req.params.id);
    if (!psw) return res.status(404).json({ message: "PSW not found" });
    res.json(psw);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/debug - Debug endpoint to see all PSW data
exports.debugPSWs = async (req, res) => {
  try {
    const psws = await PSWWorker.find();
    res.json({
      totalCount: psws.length,
      psws: psws
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/index/build - Build geospatial index
exports.buildIndex = async (req, res) => {
  try {
    await PSWWorker.collection.createIndex({ location: "2dsphere" });
    res.json({ message: "2dsphere index created successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/nearby - Get PSWs within 15km of logged-in client
exports.getNearbyPSWs = async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"];

    if (!clientId) {
      return res.status(400).json({ message: "x-client-id header is required" });
    }

    // Get client's location
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Use client's coordinates from address or default to Toronto
    const coordinates = client.address?.coordinates || [-79.3957, 43.6629];

    console.log("Searching for PSWs near:", coordinates);
    console.log("Query using $geoNear with 15km radius");

    // Use aggregation with $geoNear for better control
    const nearbyPSWs = await PSWWorker.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: coordinates
          },
          distanceField: "distance",
          maxDistance: 15000, // 15km in meters
          spherical: true
        }
      }
    ]);

    console.log(`Found ${nearbyPSWs.length} PSWs within 15km`);

    res.json({
      client: {
        id: client._id,
        name: `${client.firstName} ${client.lastName}`,
        coordinates: coordinates
      },
      nearbyPSWs: nearbyPSWs,
      count: nearbyPSWs.length
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/:id/booked-slots?from=DATE&to=DATE
// Returns all booked time ranges for a PSW within a date window
exports.getPSWBookedSlots = async (req, res) => {
  try {
    const BookingSlot = require("../models/BookingSlot");

    const pswId = req.params.id;
    const from = req.query.from ? new Date(req.query.from + "T00:00:00") : new Date();
    const to = req.query.to
      ? new Date(req.query.to + "T23:59:59")
      : new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000); // default 90 days

    // Query BookingSlot only — each slot has exact per-day time ranges.
    // (The Booking model stores a single start→end spanning the entire recurring
    //  range which would produce false overlaps.)
    const slots = await BookingSlot.find({
      pswWorker: pswId,
      status: { $ne: "cancelled" },
      startTime: { $lt: to },
      endTime: { $gt: from },
    })
      .select("startTime endTime status")
      .sort({ startTime: 1 })
      .lean();

    const merged = slots.map((item) => {
      const s = new Date(item.startTime);
      const e = new Date(item.endTime);
      const localDate = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
      return {
        startTime: item.startTime,
        endTime: item.endTime,
        date: localDate,
        startHour: s.getHours(),
        endHour: e.getMinutes() > 0 ? e.getHours() + 1 : e.getHours(),
      };
    });

    res.json({ pswId, from: from.toISOString(), to: to.toISOString(), bookedSlots: merged });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /psws/:id/check-conflict
// Check if a specific time conflicts for this PSW and return alternatives
exports.checkPSWConflict = async (req, res) => {
  try {
    const BookingSlot = require("../models/BookingSlot");

    const pswId = req.params.id;
    const { date, startHour, endHour, reqId } = req.body;

    if (!date || startHour == null || endHour == null) {
      return res.status(400).json({ message: "date, startHour, and endHour are required" });
    }

    const slotStart = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`);
    const slotEnd = new Date(`${date}T${String(endHour).padStart(2, "0")}:00:00`);

    // Only check BookingSlot — each slot has exact per-day time ranges.
    // (The Booking model stores a single start→end spanning the entire recurring
    //  range which would produce false positives.)
    const slotConflict = await BookingSlot.findOne({
      pswWorker: pswId,
      status: { $ne: "cancelled" },
      startTime: { $lt: slotEnd },
      endTime: { $gt: slotStart },
    }).lean();

    if (!slotConflict) {
      return res.json({ conflict: false });
    }

    // Conflict exists — find alternative PSWs for this time slot
    const BookingRequest = require("../models/BookingRequest");
    const { findAvailablePSWs } = require("../services/availabilityService");

    let alternatives = [];

    if (reqId) {
      const request = await BookingRequest.findById(reqId);
      if (request) {
        // Find nearby PSWs using the booking request location
        const nearby = await findAvailablePSWs(
          request.location?.coordinates,
          request.location?.postalCode
        );

        // Filter out the current PSW and check each for conflicts
        for (const alt of nearby) {
          if (alt._id.toString() === pswId) continue;

          // Check if this alternative has a service level match
          if (request.serviceLevel && alt.serviceLevels && !alt.serviceLevels.includes(request.serviceLevel)) {
            continue;
          }

          const altSlotConflict = await BookingSlot.findOne({
            pswWorker: alt._id,
            status: { $ne: "cancelled" },
            startTime: { $lt: slotEnd },
            endTime: { $gt: slotStart },
          }).lean();

          if (!altSlotConflict) {
            alternatives.push({
              _id: alt._id,
              firstName: alt.firstName,
              lastName: alt.lastName,
              profilePhoto: alt.profilePhoto || "",
              gender: alt.gender || "",
              rating: alt.rating || 0,
              yearsExperience: alt.yearsExperience || 0,
              serviceLevels: alt.serviceLevels || [],
            });
          }

          if (alternatives.length >= 5) break;
        }
      }
    }

    res.json({
      conflict: true,
      conflictDetail: {
        date,
        startHour,
        endHour,
        existingSlot: { start: slotConflict.startTime, end: slotConflict.endTime },
      },
      alternatives,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /psws/:id/assignments - Upcoming slots for a PSW with service addresses
exports.getPSWAssignments = async (req, res) => {
  try {
    const BookingSlot = require("../models/BookingSlot");
    const BookingBlock = require("../models/BookingBlock");
    const User = require("../models/User");

    const pswId = req.params.id;

    const slots = await BookingSlot.find({
      pswWorker: pswId,
      status: { $ne: "cancelled" },
      startTime: { $gte: new Date() }
    })
      .sort({ startTime: 1 })
      .populate({
        path: "bookingBlock",
        select: "serviceAddress contact userId clientId"
      })
      .lean();

    // Enrich with user info where available
    const assignments = await Promise.all(slots.map(async (slot) => {
      const block = slot.bookingBlock || {};
      let clientName = null;
      if (block.userId) {
        const user = await User.findById(block.userId).select("firstName lastName").lean();
        if (user) clientName = `${user.firstName} ${user.lastName}`;
      }
      return {
        slotId: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        serviceAddress: block.serviceAddress || null,
        contact: block.contact || null,
        clientName
      };
    }));

    res.json({ pswId, upcoming: assignments.length, assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
