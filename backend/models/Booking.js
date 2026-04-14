const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({

  pswWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PSWWorker",
    required: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  client: {
    type: String,
    default: null
  },

  serviceAddress: {
    street: { type: String, default: "" },
    unit:   { type: String, default: "" },
    city:   { type: String, default: "" },
    postalCode: { type: String, default: "" },
    coordinates: { type: [Number], default: undefined }
  },

  serviceType: {
    type: String,
    required: true
  },

  serviceLevel: {
    type: String,
    default: null
  },

  // legacy fields (keep for compatibility if already used)
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true },

  // NEW fields for scheduling engine
  startTime: {
    type: Date,
    required: true
  },

  endTime: {
    type: Date,
    required: true
  },

  recurring: {
    type: Boolean,
    default: false
  },

  recurringInterval: {
    type: String,
    enum: ["daily","weekly","monthly"],
    default: null
  },

  daysPerWeek: {
    type: Number,
    default: null
  },

  preferredDays: {
    type: [String],
    default: []
  },

  lengthOfCareWeeks: {
    type: Number,
    default: null
  },

  visitDuration: {
    type: String,
    default: null
  },

  totalSlots: {
    type: Number,
    default: null
  },

  status: {
    type: String,
    enum: ["pending","confirmed","cancelled"],
    default: "pending"
  },

  cancelledAt: {
    type: Date,
    default: null
  },

  // ── Billing fields ──
  hourlyRate: {
    type: Number,
    default: null
  },

  totalHours: {
    type: Number,
    default: null
  },

  totalAmount: {
    type: Number,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);