const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { register, login, getMe, updateProfile, changePassword } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");

// POST /auth/register
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("firstName").notEmpty().trim().withMessage("First name is required"),
    body("lastName").notEmpty().trim().withMessage("Last name is required"),
    body("phone").optional({ checkFalsy: true }).trim(),
    body("address.street").optional({ checkFalsy: true }).trim(),
    body("address.unit").optional({ checkFalsy: true }).trim(),
    body("address.city").optional({ checkFalsy: true }).trim(),
    body("address.postalCode").optional({ checkFalsy: true }).trim(),
    body("role").optional().isIn(["client", "psw"]).withMessage("Invalid role")
  ],
  validate,
  register
);

// POST /auth/login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  validate,
  login
);

// GET /auth/me
router.get("/me", requireAuth, getMe);

// PUT /auth/profile
router.put(
  "/profile",
  requireAuth,
  [
    body("firstName").optional().notEmpty().trim().withMessage("First name cannot be empty"),
    body("lastName").optional().notEmpty().trim().withMessage("Last name cannot be empty"),
    body("phone").optional({ checkFalsy: true }).trim(),
    body("address.street").optional({ checkFalsy: true }).trim(),
    body("address.unit").optional({ checkFalsy: true }).trim(),
    body("address.city").optional({ checkFalsy: true }).trim(),
    body("address.postalCode").optional({ checkFalsy: true }).trim()
  ],
  validate,
  updateProfile
);

// PUT /auth/password
router.put(
  "/password",
  requireAuth,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters")
  ],
  validate,
  changePassword
);

module.exports = router;
