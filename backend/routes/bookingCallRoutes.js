const express = require("express");
const router = express.Router();
const { 
  initiateBookingCall, 
  handleBookingCallWebhook, 
  getCallStatus,
  lookupPSWsByPostalCode,
  identifyCaller,
  getUserBookings
} = require("../controllers/bookingCallController");

// POST initiate a booking call to a client
router.post("/initiate", initiateBookingCall);

// POST receive webhook from completed call
router.post("/webhook", handleBookingCallWebhook);

// POST mid-call PSW lookup (called by Retell custom tool)
router.post("/lookup-psws", lookupPSWsByPostalCode);

// POST mid-call caller identification by phone number (Retell custom tool)
router.post("/identify", identifyCaller);

// POST mid-call fetch user's active bookings (Retell custom tool)
router.post("/user-bookings", getUserBookings);

// GET call status and transcript
router.get("/:callId/status", getCallStatus);

module.exports = router;
