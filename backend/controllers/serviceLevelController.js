const ServiceLevel = require("../models/ServiceLevel");

// ── Public: GET /service-levels ──
exports.getServiceLevels = async (req, res) => {
  try {
    const levels = await ServiceLevel.find({ active: true }).sort({ sortOrder: 1 });
    res.json(levels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: GET /admin/service-levels ──
exports.getAdminServiceLevels = async (req, res) => {
  try {
    const levels = await ServiceLevel.find().sort({ sortOrder: 1 });
    res.json(levels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: POST /admin/service-levels ──
exports.createServiceLevel = async (req, res) => {
  try {
    const { key, label, description, clientRate, pswRate, icon, examples, popular, active, sortOrder } = req.body;
    if (!key || !label || clientRate == null || pswRate == null) {
      return res.status(400).json({ message: "key, label, clientRate, and pswRate are required" });
    }
    const existing = await ServiceLevel.findOne({ key });
    if (existing) {
      return res.status(409).json({ message: `Service level "${key}" already exists` });
    }
    const level = await ServiceLevel.create({
      key, label, description, clientRate, pswRate,
      icon: icon || "🏠", examples, popular, active, sortOrder
    });
    res.status(201).json(level);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: PUT /admin/service-levels/:id ──
exports.updateServiceLevel = async (req, res) => {
  try {
    const allowed = ["label", "description", "clientRate", "pswRate", "icon", "examples", "popular", "active", "sortOrder"];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const level = await ServiceLevel.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!level) return res.status(404).json({ message: "Service level not found" });
    res.json(level);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Admin: DELETE /admin/service-levels/:id ──
exports.deleteServiceLevel = async (req, res) => {
  try {
    const level = await ServiceLevel.findByIdAndDelete(req.params.id);
    if (!level) return res.status(404).json({ message: "Service level not found" });
    res.json({ message: "Service level deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
