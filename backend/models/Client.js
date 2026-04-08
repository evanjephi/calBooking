const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  _id: String, // Allow string IDs like "client1", "client2"
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  address: {
    street: String,
    city: { type: String, default: "Toronto" },
    postalCode: String,
    coordinates: { type: [Number], default: [-79.3957, 43.6629] } // [lng, lat] - default Toronto
  }
});

module.exports = mongoose.model("Client", clientSchema);