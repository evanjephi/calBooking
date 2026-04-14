const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const ServiceLevel = require("../models/ServiceLevel");

const {
  createBookingRequest,
  updateBookingRequest,
  checkAvailability,
  confirmContact,
  selectPSW,
  confirmBooking,
  finalizeBooking,
  getPSWCalendar
} = require("../controllers/bookingRequestController");

// All booking-request routes require authentication
router.use(requireAuth);

router.post(
  "/",
  [
    body("bookingType")
      .optional()
      .isIn(["one-time", "recurring"])
      .withMessage("bookingType must be one-time or recurring"),
    body("street").optional().trim(),
    body("unit").optional().trim(),
    body("city").notEmpty().trim().withMessage("City is required"),
    body("postalCode").notEmpty().trim().withMessage("Postal code is required"),
    body("coordinates")
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage("Coordinates must be [lng, lat]"),
    body("daysPerWeek")
      .isInt({ min: 1, max: 7 })
      .withMessage("daysPerWeek must be 1-7"),
    body("timeOfDay")
      .isIn(["daytime", "evening", "overnight", "weekend"])
      .withMessage("timeOfDay must be daytime, evening, overnight, or weekend"),
    body("visitDuration")
      .isIn(["1 hour", "2-3 hours", "4-6 hours", "more than 6 hours"])
      .withMessage("Invalid visitDuration"),
    body("lengthOfCareWeeks")
      .isInt({ min: 1 })
      .withMessage("lengthOfCareWeeks must be at least 1"),
    body("preferredDays")
      .optional()
      .isArray()
      .withMessage("preferredDays must be an array"),
    body("preferredDays.*")
      .optional()
      .isIn(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
      .withMessage("Invalid day name"),
    body("preferredStartHour")
      .optional({ nullable: true })
      .isInt({ min: 0, max: 23 })
      .withMessage("preferredStartHour must be 0-23"),
    body("specificDate")
      .optional({ nullable: true })
      .isISO8601()
      .withMessage("specificDate must be a valid date"),
    body("serviceLevel")
      .optional({ nullable: true })
      .custom(async (value) => {
        if (!value) return true;
        const exists = await ServiceLevel.findOne({ key: value, active: true });
        if (!exists) throw new Error(`Invalid service level: ${value}`);
        return true;
      })
  ],
  validate,
  createBookingRequest
);

router.get(
  "/:id/availability",
  [param("id").isMongoId().withMessage("Invalid request ID")],
  validate,
  checkAvailability
);

router.patch(
  "/:id/contact",
  [
    param("id").isMongoId().withMessage("Invalid request ID"),
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("phone").optional().notEmpty().withMessage("Phone cannot be empty"),
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error("At least one of email or phone is required");
      }
      return true;
    })
  ],
  validate,
  confirmContact
);

router.patch(
  "/:id/select-psw",
  [
    param("id").isMongoId().withMessage("Invalid request ID"),
    body().custom((value, { req }) => {
      if (!req.body.pswId && (!req.body.slotAssignments || req.body.slotAssignments.length === 0)) {
        throw new Error("pswId or slotAssignments is required");
      }
      return true;
    }),
    body("pswId").optional().isMongoId().withMessage("Valid pswId is required"),
    body("slotAssignments").optional().isArray().withMessage("slotAssignments must be an array"),
    body("slotAssignments.*.pswId").optional().isMongoId().withMessage("Each assignment needs a valid pswId")
  ],
  validate,
  selectPSW
);

// PSW calendar availability for a booking request
router.get(
  "/:id/psw-calendar/:pswId",
  [
    param("id").isMongoId().withMessage("Invalid request ID"),
    param("pswId").isMongoId().withMessage("Invalid PSW ID")
  ],
  validate,
  getPSWCalendar
);

router.patch(
  "/:id/confirm",
  [param("id").isMongoId().withMessage("Invalid request ID")],
  validate,
  confirmBooking
);

router.post(
  "/:id/finalize",
  [param("id").isMongoId().withMessage("Invalid request ID")],
  validate,
  finalizeBooking
);

// GET single booking request by ID
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid request ID")],
  validate,
  async (req, res) => {
    try {
      const request = await require("../models/BookingRequest").findById(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.patch(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid request ID")],
  validate,
  updateBookingRequest
);

module.exports = router;