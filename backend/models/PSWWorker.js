const mongoose = require("mongoose");

const pswWorkerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  firstName: { type: String, required: true },
  lastName: { type: String, required: true },

  homeAddress: {
    street: String,
    city: { type: String, default: "Toronto" },
    postalCode: String
  },

  serviceType: [String],

  serviceLevels: {
    type: [String],
    default: []
  },

  // existing detailed schedule
  availability: [
    { 
      day: String, 
      startTime: String, 
      endTime: String 
    }
  ],

  // new simplified availability flags
  availabilityPreferences: {
    daytime: { type: Boolean, default: false },
    evening: { type: Boolean, default: false },
    overnight: { type: Boolean, default: false },
    weekend: { type: Boolean, default: false }
  },

  // new fields
  yearsExperience: {
    type: Number,
    default: 1
  },

  rating: {
    type: Number,
    default: 4.5
  },

  profilePhoto: { type: String, default: "" },
  gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
  bio: { type: String, default: "" },

  // PSW Application fields
  certifications: { type: [String], default: [] },
  languages: { type: [String], default: [] },
  shortIntro: { type: String, default: "" },
  referredByPSW: { type: String, default: "" },

  // Document uploads (stored as file refs in Image model)
  governmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Image", default: null },
  backgroundCheck: { type: mongoose.Schema.Types.ObjectId, ref: "Image", default: null },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: "Image", default: null },

  // Additional documents uploaded after application
  additionalDocuments: [{
    file: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    label: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now }
  }],

  applicationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected", ""],
    default: ""
  },

  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  }

});

pswWorkerSchema.index({ location: "2dsphere" });
pswWorkerSchema.index({ "homeAddress.postalCode": 1 });

module.exports = mongoose.model("PSWWorker", pswWorkerSchema);