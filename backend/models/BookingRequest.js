const mongoose = require("mongoose");

const bookingRequestSchema = new mongoose.Schema(
{
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  clientId: {
    type: String,
    required: false
  },

  serviceAddress: {
    street: { type: String, default: "" },
    unit:   { type: String, default: "" },
    city:   { type: String, default: "" },
    postalCode: { type: String, default: "" },
    coordinates: { type: [Number], default: undefined }
  },

  serviceLevel: {
    type: String,
    enum: ["home_helper", "care_services", "specialized_care"],
    default: null
  },

  // "one-time" or "recurring"
  bookingType: {
    type: String,
    enum: ["one-time", "recurring"],
    default: "recurring"
  },

  location: {
    city: String,
    postalCode: String,
    coordinates: {
      type: [Number], // [lng, lat]
      index: "2dsphere"
    }
  },

  daysPerWeek: {
    type: Number,
    min: 1,
    max: 7
  },

  // Specific days the client selected (e.g. ["Monday","Wednesday","Friday"])
  preferredDays: {
    type: [String],
    default: []
  },

  // Specific start hour chosen by the client (0-23), e.g. 10 = 10:00 AM
  preferredStartHour: {
    type: Number,
    min: 0,
    max: 23,
    default: null
  },

  // For one-time bookings: the specific date
  specificDate: {
    type: Date,
    default: null
  },

  timeOfDay: {
    type: String,
    enum: ["daytime", "evening", "overnight", "weekend"]
  },

  visitDuration: {
    type: String,
    enum: [
      "1 hour",
      "2-3 hours",
      "4-6 hours",
      "more than 6 hours"
    ]
  },

  lengthOfCareWeeks: {
    type: Number
  },

  startTime: {
    type: Date
  },

  endTime: {
    type: Date
  },

  availabilityCount: {
    type: Number,
    default: 0
  },

  contact: {
    email: String,
    phone: String
  },

  matchedPSWs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PSWWorker"
    }
  ],

  selectedPSW: {
    pswId: { type: mongoose.Schema.Types.ObjectId, ref: "PSWWorker" },
    name: String
  },

  slotAssignments: [{
    pswId: { type: mongoose.Schema.Types.ObjectId, ref: "PSWWorker" },
    pswName: String,
    slots: [{
      date: Date,
      startTime: Date,
      endTime: Date
    }]
  }],

  status: {
    type: String,
    enum: ["pending", "confirmed", "booked", "cancelled"],
    default: "pending"
  },

  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  },

  source: {
    type: String,
    enum: ["api", "phone"],
    default: "api"
  },

  timezone: {
    type: String,
    default: "America/Toronto"
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("BookingRequest", bookingRequestSchema);