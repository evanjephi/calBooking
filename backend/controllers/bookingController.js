const Booking = require("../models/Booking");
const PSWWorker = require("../models/PSWWorker");
const { SERVICE_RATES } = require("../config/rates");

// GET /bookings
exports.getBookings = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { userId: req.user.id };
    const bookings = await Booking.find(filter)
      .populate("pswWorker");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /bookings/psw — bookings assigned to the logged-in PSW
exports.getPSWBookings = async (req, res) => {
  try {
    const pswWorker = await PSWWorker.findOne({ user: req.user.id });
    if (!pswWorker) {
      return res.status(404).json({ message: "No PSW profile found for this user" });
    }
    const bookings = await Booking.find({ pswWorker: pswWorker._id })
      .populate("userId", "firstName lastName email phone address")
      .sort({ startTime: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /bookings/:id/respond — PSW accepts or rejects a booking
exports.respondToBooking = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'confirmed' or 'cancelled'" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Verify the logged-in user is the assigned PSW
    const pswWorker = await PSWWorker.findOne({ user: req.user.id });
    if (!pswWorker || String(booking.pswWorker) !== String(pswWorker._id)) {
      return res.status(403).json({ message: "Not authorized — this booking is not assigned to you" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: `Cannot respond to a booking that is already ${booking.status}` });
    }

    booking.status = status;
    if (status === "cancelled") booking.cancelledAt = new Date();
    await booking.save();

    const updated = await Booking.findById(booking._id)
      .populate("userId", "firstName lastName email phone address")
      .populate("pswWorker");
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /bookings
exports.createBooking = async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    const populatedBooking = await Booking.findById(booking._id)
      .populate("pswWorker")
      .populate("client");
    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /bookings/:id
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("pswWorker");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (req.user.role !== "admin" && String(booking.userId) !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /bookings/:id (Update booking)
exports.updateBooking = async (req, res) => {
  try {
    const { serviceType, bookingDate, bookingTime, recurring, recurringInterval, status } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    // Prevent updates to cancelled bookings
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Cannot update a cancelled booking" });
    }
    
    // Update allowed fields
    if (serviceType) booking.serviceType = serviceType;
    if (bookingDate) booking.bookingDate = bookingDate;
    if (bookingTime) booking.bookingTime = bookingTime;
    if (recurring !== undefined) booking.recurring = recurring;
    if (recurringInterval) booking.recurringInterval = recurringInterval;
    if (status && ["pending", "confirmed", "cancelled"].includes(status)) {
      booking.status = status;
    }
    booking.updatedAt = Date.now();
    
    await booking.save();
    const updatedBooking = await Booking.findById(booking._id)
      .populate("pswWorker")
      .populate("client");
    res.json(updatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /bookings/:id (Cancel booking)
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }
    
    booking.status = "cancelled";
    booking.cancelledAt = Date.now();
    booking.updatedAt = Date.now();
    await booking.save();
    
    const cancelledBooking = await Booking.findById(booking._id)
      .populate("pswWorker")
      .populate("client");
    res.json({ message: "Booking cancelled successfully", booking: cancelledBooking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /bookings/transactions — billing/earnings summary
exports.getTransactions = async (req, res) => {
  try {
    let filter;

    if (req.user.role === "admin") {
      filter = {};
    } else if (req.user.role === "psw") {
      const pswWorker = await PSWWorker.findOne({ user: req.user.id });
      if (!pswWorker) return res.status(404).json({ message: "No PSW profile found" });
      filter = { pswWorker: pswWorker._id };
    } else {
      filter = { userId: req.user.id };
    }

    const bookings = await Booking.find(filter)
      .populate("pswWorker", "firstName lastName")
      .populate("userId", "firstName lastName email")
      .sort({ startTime: -1 });

    // Compute summary
    const completed = bookings.filter(b => b.status === "confirmed");
    const totalHours = completed.reduce((sum, b) => sum + (b.totalHours || 0), 0);
    const totalAmount = completed.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    res.json({
      summary: {
        totalBookings: completed.length,
        totalHours: Math.round(totalHours * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100
      },
      transactions: bookings.map(b => ({
        _id: b._id,
        date: b.startTime,
        endTime: b.endTime,
        serviceLevel: b.serviceLevel,
        hourlyRate: b.hourlyRate,
        totalHours: b.totalHours,
        totalAmount: b.totalAmount,
        status: b.status,
        pswName: b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : null,
        clientName: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : b.client
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};