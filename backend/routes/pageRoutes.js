const express = require("express");
const router = express.Router();
const Page = require("../models/Page");

// GET /pages/:slug — public, single page by slug
router.get("/:slug", async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, status: "published" });
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
