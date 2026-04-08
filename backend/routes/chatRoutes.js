const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { sendMessage, getHistory, clearSession } = require("../controllers/chatController");

router.post("/", requireAuth, sendMessage);
router.get("/:sessionId", requireAuth, getHistory);
router.delete("/:sessionId", requireAuth, clearSession);

module.exports = router;
