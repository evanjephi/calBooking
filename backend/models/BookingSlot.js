const mongoose = require("mongoose");

const bookingSlotSchema = new mongoose.Schema({

  bookingBlock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BookingBlock"
  },

  pswWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PSWWorker"
  },

  startTime: Date,
  endTime: Date,

  status: {
    type: String,
    default: "scheduled"
  }

}, { timestamps: true });

// Index for fast conflict queries (pswWorker + time range overlap)
bookingSlotSchema.index({ pswWorker: 1, startTime: 1, endTime: 1 });
// Index for looking up slots by block
bookingSlotSchema.index({ bookingBlock: 1 });

module.exports = mongoose.model("BookingSlot", bookingSlotSchema);