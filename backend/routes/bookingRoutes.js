const express = require("express");
const router = express.Router();
const { param } = require("express-validator");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { getBookings, getBookingById, createBooking, updateBooking, cancelBooking, getPSWBookings, respondToBooking, getTransactions } = require("../controllers/bookingController");

router.use(requireAuth);

// GET bookings for logged-in PSW (must be before /:id)
router.get("/psw", getPSWBookings);

// GET billing/earnings transactions (must be before /:id)
router.get("/transactions", getTransactions);

// GET all bookings
router.get("/", getBookings);

// GET a specific booking by ID
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid booking ID")],
  validate,
  getBookingById
);

// POST a new booking (single or recurring)
router.post("/", createBooking);

// PUT update a booking
router.put(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid booking ID")],
  validate,
  updateBooking
);

// DELETE cancel a booking
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid booking ID")],
  validate,
  cancelBooking
);

// PATCH — PSW responds to a booking (accept/reject)
router.patch(
  "/:id/respond",
  [param("id").isMongoId().withMessage("Invalid booking ID")],
  validate,
  respondToBooking
);

module.exports = router;