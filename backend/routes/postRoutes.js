const express = require("express");
const router = express.Router();
const Post = require("../models/Post");

// GET /posts — public, published posts only
router.get("/", async (req, res) => {
  try {
    const filter = { status: "published" };
    if (req.query.category) filter.category = req.query.category;
    const posts = await Post.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .select("-body")
      .populate("author", "firstName lastName");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /posts/:slug — public, single post by slug
router.get("/:slug", async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: "published" })
      .populate("author", "firstName lastName");
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
