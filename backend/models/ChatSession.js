const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: [
      {
        role: { type: String, enum: ["system", "user", "assistant", "tool"], required: true },
        content: { type: String, default: "" },
        tool_calls: { type: mongoose.Schema.Types.Mixed, default: undefined },
        tool_call_id: { type: String, default: undefined },
        name: { type: String, default: undefined },
      },
    ],
    bookingRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingRequest",
      default: null,
    },
    currentStep: {
      type: String,
      enum: ["greeting", "gathering_info", "checking_availability", "selecting_psw", "finalizing", "complete", "general_qa"],
      default: "greeting",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
chatSessionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("ChatSession", chatSessionSchema);
