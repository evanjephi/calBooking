const multer = require("multer");
const Image = require("../models/Image");

// Multer config — store in memory, limit 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

// POST /admin/images — upload an image
exports.uploadMiddleware = upload.single("image");

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const image = new Image({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer,
      size: req.file.size
    });
    await image.save();

    res.status(201).json({
      _id: image._id,
      filename: image.filename,
      contentType: image.contentType,
      size: image.size,
      url: `/images/${image._id}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /images/:id — serve an image (public)
exports.serveImage = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.send(image.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /admin/images/:id
exports.deleteImage = async (req, res) => {
  try {
    const image = await Image.findByIdAndDelete(req.params.id);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }
    res.json({ message: "Image deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
