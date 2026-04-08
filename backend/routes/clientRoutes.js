const express = require("express");
const router = express.Router();
const Client = require("../models/Client");

// POST /clients - Create a new client
router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, address, location } = req.body;
    
    const client = new Client({
      firstName,
      lastName,
      address,
      location: location || {
        type: "Point",
        coordinates: [-79.3957, 43.6629] // default Toronto
      }
    });
    
    await client.save();
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET /clients - Get all clients
router.get("/", async (req, res) => {
  try {
    const clients = await Client.find();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
