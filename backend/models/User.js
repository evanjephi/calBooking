const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      minlength: 6
      // Not required at schema level — web registration enforces it,
      // phone-only users are created without a password and cannot log in.
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: null
    },
    address: {
      street: { type: String, default: "" },
      unit:   { type: String, default: "" },
      city:   { type: String, default: "" },
      postalCode: { type: String, default: "" },
      coordinates: { type: [Number], default: undefined }
    },
    role: {
      type: String,
      enum: ["client", "psw", "admin"],
      default: "client"
    },
    source: {
      type: String,
      enum: ["web", "phone"],
      default: "web"
    }
  },
  { timestamps: true }
);

// Hash password before saving (only when password exists and is modified)
userSchema.pre("save", async function () {
  if (!this.password || !this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method — returns false if no password set
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip password from JSON output
userSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  }
});

// Sparse index on phone for fast lookup (only indexes docs that have phone)
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
