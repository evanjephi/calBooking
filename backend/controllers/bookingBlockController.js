const BookingBlock = require("../models/BookingBlock");
const BookingSlot = require("../models/BookingSlot");
const { generateRecurringSlots } = require("../services/recurringScheduler");
const { findAvailablePSWs } = require("../services/availabilityService");

exports.createBookingBlock = async (req, res) => {

  try {

    const {
      clientId,
      createdBy,
      contact,
      pswWorker,
      postalCode,
      coordinates,
      startDate,
      daysOfWeek = [],
      startTime,
      durationHours,
      weeks
    } = req.body;

    // Validate required fields
    if (
      !clientId ||
      !pswWorker ||
      !startDate ||
      !startTime ||
      !durationHours ||
      !weeks
    ) {
      return res.status(400).json({
        message: "Missing required recurring booking fields"
      });
    }

    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({
        message: "daysOfWeek must be a non-empty array"
      });
    }

    // Generate recurring slots
    const generatedSlots = generateRecurringSlots({
      startDate,
      daysOfWeek,
      startTime,
      durationHours,
      weeks
    });

    if (generatedSlots.length === 0) {
      return res.status(400).json({
        message: "No slots generated from recurrence rules"
      });
    }

    // PARTIAL MATCHING: separate slots into confirmed vs conflicted
    const confirmedSlots = [];   // primary PSW is free
    const conflictedSlots = [];  // primary PSW has a conflict

    for (const slot of generatedSlots) {

      const conflict = await BookingSlot.findOne({
        pswWorker,
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime }
      });

      if (conflict) {
        conflictedSlots.push(slot);
      } else {
        confirmedSlots.push(slot);
      }

    }

    // Create Booking Block
    const block = new BookingBlock({
      clientId,
      createdBy,
      contact
    });

    await block.save();

    const createdSlots = [];

    // Save confirmed slots with primary PSW
    for (const slot of confirmedSlots) {

      const newSlot = new BookingSlot({
        bookingBlock: block._id,
        pswWorker,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "scheduled"
      });

      await newSlot.save();
      createdSlots.push(newSlot._id);

    }

    // For conflicted slots, find alternative PSWs
    const alternativeSuggestions = [];

    if (conflictedSlots.length > 0) {
      // Get nearby PSWs using postal code or coordinates
      const nearbyPSWs = await findAvailablePSWs(
        coordinates || [0, 0],
        postalCode
      );

      for (const slot of conflictedSlots) {

        const availableAlts = [];

        for (const altPSW of nearbyPSWs) {
          // skip primary PSW
          const altId = altPSW._id.toString();
          if (altId === pswWorker.toString()) continue;

          const altConflict = await BookingSlot.findOne({
            pswWorker: altPSW._id,
            startTime: { $lt: slot.endTime },
            endTime: { $gt: slot.startTime }
          });

          if (!altConflict) {
            availableAlts.push({
              _id: altPSW._id,
              name: `${altPSW.firstName} ${altPSW.lastName}`,
              postalCode: altPSW.homeAddress?.postalCode
            });
          }
        }

        alternativeSuggestions.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          availableAlternatives: availableAlts
        });

      }
    }

    block.slots = createdSlots;
    await block.save();

    res.status(201).json({
      message: conflictedSlots.length === 0
        ? "Recurring booking created successfully"
        : "Recurring booking partially created — some slots need alternative PSWs",
      bookingBlock: block,
      totalSlots: createdSlots.length,
      totalRequested: generatedSlots.length,
      conflicts: conflictedSlots.length,
      alternativeSuggestions: alternativeSuggestions.length > 0
        ? alternativeSuggestions
        : undefined
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

};