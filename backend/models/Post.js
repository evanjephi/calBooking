const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: "", trim: true },
    body: { type: String, default: "" },
    coverImage: { type: mongoose.Schema.Types.ObjectId, ref: "Image", default: null },
    category: {
      type: String,
      enum: ["clients", "providers"],
      required: true
    },
    featured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft"
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
