const multer = require("multer");
const PSWWorker = require("../models/PSWWorker");
const Image = require("../models/Image");
const { geocodePostalCode } = require("../services/geocoder");

// Multer config — memory storage, 10MB limit, images + PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and PDF files are allowed"), false);
    }
  }
});

exports.uploadFields = upload.fields([
  { name: "governmentId", maxCount: 1 },
  { name: "backgroundCheck", maxCount: 1 },
  { name: "resume", maxCount: 1 }
]);

// Helper: save an uploaded file to the Image model
async function saveFile(file) {
  const image = new Image({
    filename: file.originalname,
    contentType: file.mimetype,
    data: file.buffer,
    size: file.size
  });
  await image.save();
  return image._id;
}

// POST /psw/apply — submit PSW application
exports.submitApplication = async (req, res) => {
  try {
    // Check if this user already has an application
    const existing = await PSWWorker.findOne({ user: req.user.id });
    if (existing) {
      return res.status(409).json({ message: "You have already submitted an application" });
    }

    const {
      yearsExperience,
      certifications,
      availabilityPreferences,
      languages,
      serviceLevels,
      shortIntro,
      gender,
      referredByPSW,
      street,
      city,
      postalCode
    } = req.body;

    // Parse JSON fields that come as strings from FormData
    const parsedCertifications = typeof certifications === "string" ? JSON.parse(certifications) : (certifications || []);
    const parsedLanguages = typeof languages === "string" ? JSON.parse(languages) : (languages || []);
    const parsedServiceLevels = typeof serviceLevels === "string" ? JSON.parse(serviceLevels) : (serviceLevels || []);
    const parsedAvailability = typeof availabilityPreferences === "string" ? JSON.parse(availabilityPreferences) : (availabilityPreferences || {});

    // Save uploaded files
    let governmentIdRef = null;
    let backgroundCheckRef = null;
    let resumeRef = null;

    if (req.files?.governmentId?.[0]) {
      governmentIdRef = await saveFile(req.files.governmentId[0]);
    }
    if (req.files?.backgroundCheck?.[0]) {
      backgroundCheckRef = await saveFile(req.files.backgroundCheck[0]);
    }
    if (req.files?.resume?.[0]) {
      resumeRef = await saveFile(req.files.resume[0]);
    }

    // Get user info to populate name
    const User = require("../models/User");
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Geocode from postal code, fall back to Toronto centre
    const effectivePostal = postalCode || user.address?.postalCode || "";
    const coords = geocodePostalCode(effectivePostal) || [-79.3832, 43.6532];

    const pswWorker = new PSWWorker({
      user: req.user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      homeAddress: {
        street: street || user.address?.street || "",
        city: city || user.address?.city || "Toronto",
        postalCode: effectivePostal
      },
      yearsExperience: parseInt(yearsExperience) || 1,
      certifications: parsedCertifications,
      languages: parsedLanguages,
      serviceLevels: parsedServiceLevels,
      availabilityPreferences: parsedAvailability,
      shortIntro: shortIntro || "",
      gender: gender || "",
      referredByPSW: referredByPSW || "",
      governmentId: governmentIdRef,
      backgroundCheck: backgroundCheckRef,
      resume: resumeRef,
      applicationStatus: "pending",
      location: {
        type: "Point",
        coordinates: coords
      }
    });

    await pswWorker.save();

    res.status(201).json({
      message: "Application submitted successfully",
      applicationStatus: "pending",
      pswWorker
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /psw/application — check application status
exports.getApplication = async (req, res) => {
  try {
    const pswWorker = await PSWWorker.findOne({ user: req.user.id })
      .select("-__v");
    if (!pswWorker) {
      return res.json({ hasApplication: false });
    }
    res.json({ hasApplication: true, application: pswWorker });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Document Management ──

// Single file upload middleware for additional documents
const uploadSingleDoc = upload.single("document");
exports.uploadSingleDoc = uploadSingleDoc;

// GET /psw/application/documents — list all documents
exports.getDocuments = async (req, res) => {
  try {
    const pswWorker = await PSWWorker.findOne({ user: req.user.id })
      .populate("governmentId", "filename contentType size")
      .populate("backgroundCheck", "filename contentType size")
      .populate("resume", "filename contentType size")
      .populate("additionalDocuments.file", "filename contentType size");

    if (!pswWorker) {
      return res.status(404).json({ message: "No PSW application found" });
    }

    res.json({
      required: {
        governmentId: pswWorker.governmentId,
        backgroundCheck: pswWorker.backgroundCheck,
        resume: pswWorker.resume
      },
      additional: pswWorker.additionalDocuments || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /psw/application/documents — upload an additional document
exports.addDocument = async (req, res) => {
  try {
    const pswWorker = await PSWWorker.findOne({ user: req.user.id });
    if (!pswWorker) {
      return res.status(404).json({ message: "No PSW application found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileId = await saveFile(req.file);
    const label = req.body.label || req.file.originalname;

    pswWorker.additionalDocuments.push({ file: fileId, label });
    await pswWorker.save();

    res.status(201).json({
      message: "Document uploaded",
      document: pswWorker.additionalDocuments[pswWorker.additionalDocuments.length - 1]
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /psw/application/documents/:docId — remove an additional document
exports.removeDocument = async (req, res) => {
  try {
    const pswWorker = await PSWWorker.findOne({ user: req.user.id });
    if (!pswWorker) {
      return res.status(404).json({ message: "No PSW application found" });
    }

    const doc = pswWorker.additionalDocuments.id(req.params.docId);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Remove the Image record
    await Image.findByIdAndDelete(doc.file);

    // Remove from array
    pswWorker.additionalDocuments.pull(req.params.docId);
    await pswWorker.save();

    res.json({ message: "Document removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
