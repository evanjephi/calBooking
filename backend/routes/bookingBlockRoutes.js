const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const { createBookingBlock } = require("../controllers/bookingBlockController");

router.use(requireAuth);

router.post(
  "/",
  [
    body("clientId").notEmpty().withMessage("clientId is required"),
    body("pswWorker").isMongoId().withMessage("Valid pswWorker ID is required"),
    body("startDate").isISO8601().withMessage("startDate must be a valid date (YYYY-MM-DD)"),
    body("startTime")
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("startTime must be HH:MM format"),
    body("durationHours")
      .isFloat({ min: 0.5 })
      .withMessage("durationHours must be at least 0.5"),
    body("weeks")
      .isInt({ min: 1 })
      .withMessage("weeks must be at least 1"),
    body("daysOfWeek")
      .isArray({ min: 1 })
      .withMessage("daysOfWeek must be a non-empty array"),
    body("daysOfWeek.*")
      .isInt({ min: 0, max: 6 })
      .withMessage("Each day must be 0-6 (Sun-Sat)")
  ],
  validate,
  createBookingBlock
);

module.exports = router;