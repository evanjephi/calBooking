const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const admin = require("../controllers/adminController");
const { uploadMiddleware, uploadImage, deleteImage } = require("../controllers/imageController");

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// Dashboard
router.get("/stats", admin.getStats);

// Posts
router.get("/posts", admin.getPosts);
router.get("/posts/:id", admin.getPost);
router.post("/posts", admin.createPost);
router.put("/posts/:id", admin.updatePost);
router.delete("/posts/:id", admin.deletePost);

// Pages
router.get("/pages", admin.getPages);
router.get("/pages/:id", admin.getPage);
router.post("/pages", admin.createPage);
router.put("/pages/:id", admin.updatePage);
router.delete("/pages/:id", admin.deletePage);

// Clients
router.get("/clients", admin.getClients);
router.get("/clients/:id", admin.getClient);
router.post("/clients", admin.createClient);
router.put("/clients/:id", admin.updateClient);
router.delete("/clients/:id", admin.deleteClient);

// PSW Workers
router.get("/psws", admin.getPSWs);
router.get("/psws/:id", admin.getPSW);
router.post("/psws", admin.createPSW);
router.put("/psws/:id", admin.updatePSW);
router.delete("/psws/:id", admin.deletePSW);

// Bookings
router.get("/bookings", admin.getBookings);
router.get("/bookings/:id", admin.getBooking);
router.put("/bookings/:id", admin.updateBooking);
router.delete("/bookings/:id", admin.deleteBooking);

// Users
router.get("/users", admin.getUsers);
router.put("/users/:id", admin.updateUser);
router.delete("/users/:id", admin.deleteUser);

// Booking Requests (pipeline tracking)
router.get("/booking-requests", admin.getBookingRequests);
router.delete("/booking-requests/:id", admin.deleteBookingRequest);

// Images
router.post("/images", uploadMiddleware, uploadImage);
router.delete("/images/:id", deleteImage);

module.exports = router;
