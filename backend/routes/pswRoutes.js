const express = require("express");
const router = express.Router();
const { getPSWs, getPSWById, getNearbyPSWs, debugPSWs, buildIndex, getPSWAssignments, getPSWBookedSlots, checkPSWConflict } = require("../controllers/pswController");
const { submitApplication, getApplication, uploadFields, getDocuments, addDocument, removeDocument, uploadSingleDoc } = require("../controllers/pswApplicationController");
const { requireAuth } = require("../middleware/auth");
const postalCodeCache = require("../services/postalCodeCache");

// PSW Application (requires auth as PSW user)
router.post("/apply", requireAuth, uploadFields, submitApplication);
router.get("/application", requireAuth, getApplication);

// PSW Document Management
router.get("/application/documents", requireAuth, getDocuments);
router.post("/application/documents", requireAuth, uploadSingleDoc, addDocument);
router.delete("/application/documents/:docId", requireAuth, removeDocument);

// GET all PSWs, optionally filter by proximity
router.get("/", getPSWs);

// GET all PSWs (for debugging - see location data)
router.get("/debug", debugPSWs);

// GET /psws/index/build - Build geospatial index
router.get("/index/build", buildIndex);

// GET PSWs within 15km of logged-in client
router.get("/nearby", getNearbyPSWs);

// GET single PSW profile
router.get("/:id", getPSWById);

// GET upcoming assignments for a specific PSW (with service addresses)
router.get("/:id/assignments", getPSWAssignments);

// GET booked time slots for a PSW within a date range
router.get("/:id/booked-slots", getPSWBookedSlots);

// POST check if a specific time conflicts for this PSW
router.post("/:id/check-conflict", checkPSWConflict);

// Postal-code cache: rebuild + stats
router.post("/cache/rebuild", async (req, res) => {
  try {
    await postalCodeCache.buildCache();
    res.json({ message: "Cache rebuilt", stats: postalCodeCache.getStats() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/cache/stats", (req, res) => {
  res.json(postalCodeCache.getStats());
});

router.get("/cache/lookup/:postalCode", (req, res) => {
  const result = postalCodeCache.lookup(req.params.postalCode);
  res.json({
    postalCode: req.params.postalCode,
    source: result.source,
    count: result.psws.length,
    workers: result.psws.map(p => ({
      _id: p._id,
      name: `${p.firstName} ${p.lastName}`,
      postalCode: p.homeAddress?.postalCode
    }))
  });
});

module.exports = router;