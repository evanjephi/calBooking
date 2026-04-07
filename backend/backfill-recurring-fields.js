require("dotenv").config();
const connectDB = require("./config/db");
const Booking = require("./models/Booking");
const BookingRequest = require("./models/BookingRequest");
const BookingSlot = require("./models/BookingSlot");

(async () => {
  await connectDB();

  const bookings = await Booking.find({ recurring: true });
  console.log("Recurring bookings to backfill:", bookings.length);

  for (const b of bookings) {
    const req = await BookingRequest.findOne({ bookingId: b._id });

    // Derive preferredDays from actual slot dates
    const slots = await BookingSlot.find({
      pswWorker: b.pswWorker,
      startTime: { $gte: b.startTime },
      endTime: { $lte: b.endTime }
    }).sort({ startTime: 1 }).lean();

    const days = [...new Set(
      slots.map(s => new Date(s.startTime).toLocaleDateString("en-US", { weekday: "long" }))
    )];

    // Always set preferredDays and totalSlots from actual slots
    b.preferredDays = days;
    b.totalSlots = slots.length || null;

    if (req) {
      // Use BookingRequest fields when available
      b.daysPerWeek = req.daysPerWeek || days.length || null;
      b.lengthOfCareWeeks = req.lengthOfCareWeeks || null;
      b.visitDuration = req.visitDuration || null;
    } else {
      // Derive from slot data when no BookingRequest is linked
      b.daysPerWeek = days.length || null;

      // Derive lengthOfCareWeeks from date range
      if (b.startTime && b.endTime) {
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        b.lengthOfCareWeeks = Math.max(1, Math.ceil((new Date(b.endTime) - new Date(b.startTime)) / msPerWeek));
      }

      // Derive visitDuration from first slot's duration
      if (slots.length > 0) {
        const firstSlotHours = (new Date(slots[0].endTime) - new Date(slots[0].startTime)) / 3600000;
        if (firstSlotHours <= 1) b.visitDuration = "1 hour";
        else if (firstSlotHours <= 3) b.visitDuration = "2-3 hours";
        else if (firstSlotHours <= 6) b.visitDuration = "4-6 hours";
        else b.visitDuration = "more than 6 hours";
      }
    }

    // Recalculate totalHours from slots if missing
    if (b.totalHours == null && slots.length > 0) {
      const totalHours = slots.reduce((sum, s) =>
        sum + (new Date(s.endTime) - new Date(s.startTime)) / 3600000, 0);
      b.totalHours = Math.round(totalHours * 100) / 100;
    }

    await b.save();

    console.log(
      "Updated booking", b._id.toString(),
      "| daysPerWeek:", b.daysPerWeek,
      "| weeks:", b.lengthOfCareWeeks,
      "| totalSlots:", b.totalSlots,
      "| visitDuration:", b.visitDuration,
      "| preferredDays:", days,
      req ? "(from request)" : "(derived from slots)"
    );
  }

  process.exit(0);
})();
