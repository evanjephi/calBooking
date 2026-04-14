const mongoose = require("mongoose");

const serviceLevelSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[a-z][a-z0-9_]*$/
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    clientRate: {
      type: Number,
      required: true,
      min: 0
    },
    pswRate: {
      type: Number,
      required: true,
      min: 0
    },
    icon: {
      type: String,
      default: "🏠"
    },
    examples: {
      type: String,
      default: ""
    },
    popular: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceLevel", serviceLevelSchema);
