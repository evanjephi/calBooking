const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const { buildCache } = require("./services/postalCodeCache");
// Import models to register schemas
require("./models/Client");
require("./models/PSWWorker");
require("./models/Booking");
require("./models/User");
require("./models/Post");
require("./models/Page");
require("./models/Image");
require("./models/ChatSession");
const authRoutes = require("./routes/authRoutes");
const pswRoutes = require("./routes/pswRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const clientRoutes = require("./routes/clientRoutes");
const bookingCallRoutes = require("./routes/bookingCallRoutes");
const bookingRequestRoutes = require("./routes/bookingRequestRoutes");
const bookingBlockRoutes = require("./routes/bookingBlockRoutes");
const adminRoutes = require("./routes/adminRoutes");
const postRoutes = require("./routes/postRoutes");
const pageRoutes = require("./routes/pageRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { serveImage } = require("./controllers/imageController");



const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Test route
app.get("/", (req, res) => res.send("API running"));

// Routes
app.use("/auth", authRoutes);
app.use("/psws", pswRoutes);
app.use("/bookings", bookingRoutes);
app.use("/clients", clientRoutes);
app.use("/booking-calls", bookingCallRoutes);
app.use("/booking-requests", bookingRequestRoutes);
app.use("/booking-blocks", bookingBlockRoutes);
app.use("/admin", adminRoutes);
app.use("/posts", postRoutes);
app.use("/pages", pageRoutes);
app.use("/chat", chatRoutes);
app.get("/images/:id", serveImage);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
(async () => {
  try {
    await connectDB();
    await buildCache();  // warm postal-code cache after DB is ready
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
})();

module.exports = app;