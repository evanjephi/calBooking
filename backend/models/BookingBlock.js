const mongoose = require("mongoose");

const bookingBlockSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  clientId: String,

  serviceAddress: {
    street: { type: String, default: "" },
    unit:   { type: String, default: "" },
    city:   { type: String, default: "" },
    postalCode: { type: String, default: "" },
    coordinates: { type: [Number], default: undefined }
  },

  createdBy: {
    type: String,
    enum: ["client", "representative", "admin"]
  },

  contact: {
    email: String,
    phone: String
  },

  startDate: Date,
  endDate: Date,

  slots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BookingSlot"
  }]

}, { timestamps: true });

module.exports = mongoose.model("BookingBlock", bookingBlockSchema);