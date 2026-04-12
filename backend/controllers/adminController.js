const Post = require("../models/Post");
const Page = require("../models/Page");
const Client = require("../models/Client");
const PSWWorker = require("../models/PSWWorker");
const Booking = require("../models/Booking");
const BookingRequest = require("../models/BookingRequest");
const User = require("../models/User");

// ── Dashboard Stats (enhanced) ──
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      posts, pages, clients, psws, bookings, users,
      pendingBookings, confirmedBookings, cancelledBookings,
      bookingsThisWeek, bookingsThisMonth,
      bookingRequests, pendingRequests,
      revenueResult, recentBookings
    ] = await Promise.all([
      Post.countDocuments(),
      Page.countDocuments(),
      Client.countDocuments(),
      PSWWorker.countDocuments(),
      Booking.countDocuments(),
      User.countDocuments(),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "cancelled" }),
      Booking.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      BookingRequest.countDocuments(),
      BookingRequest.countDocuments({ status: "pending" }),
      Booking.aggregate([
        { $match: { status: "confirmed", totalAmount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "firstName lastName")
        .populate("pswWorker", "firstName lastName")
        .lean()
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    res.json({
      posts, pages, clients, psws, bookings, users,
      pendingBookings, confirmedBookings, cancelledBookings,
      bookingsThisWeek, bookingsThisMonth,
      bookingRequests, pendingRequests,
      totalRevenue,
      recentBookings: recentBookings.map(b => ({
        _id: b._id,
        client: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : b.client || "Unknown",
        psw: b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : "Unassigned",
        status: b.status,
        date: b.startTime || b.bookingDate,
        createdAt: b.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Posts CRUD ──
exports.getPosts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    const posts = await Post.find(filter).sort({ createdAt: -1 }).populate("author", "firstName lastName email");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author", "firstName lastName email");
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPost = async (req, res) => {
  try {
    const { title, slug, excerpt, body, coverImage, category, featured, status } = req.body;
    const post = new Post({
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      excerpt,
      body,
      coverImage: coverImage || null,
      category,
      featured: featured || false,
      status: status || "draft",
      author: req.user.id
    });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Pages CRUD ──
exports.getPages = async (req, res) => {
  try {
    const pages = await Page.find().sort({ title: 1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPage = async (req, res) => {
  try {
    const { title, slug, body, template, status } = req.body;
    const page = new Page({
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      body,
      template: template || "default",
      status: status || "draft"
    });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const page = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const page = await Page.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.json({ message: "Page deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Clients CRUD ──
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ lastName: 1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const client = new Client(req.body);
    await client.save();
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json({ message: "Client deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PSW Workers CRUD ──
exports.getPSWs = async (req, res) => {
  try {
    const psws = await PSWWorker.find().sort({ lastName: 1 }).lean();
    const counts = await Booking.aggregate([
      { $group: { _id: "$pswWorker", total: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.total]));
    const result = psws.map(p => ({ ...p, bookingCount: countMap[String(p._id)] || 0 }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPSW = async (req, res) => {
  try {
    const psw = await PSWWorker.findById(req.params.id);
    if (!psw) return res.status(404).json({ message: "PSW not found" });
    res.json(psw);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPSW = async (req, res) => {
  try {
    const psw = new PSWWorker(req.body);
    await psw.save();
    res.status(201).json(psw);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePSW = async (req, res) => {
  try {
    const psw = await PSWWorker.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!psw) return res.status(404).json({ message: "PSW not found" });
    res.json(psw);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePSW = async (req, res) => {
  try {
    const psw = await PSWWorker.findByIdAndDelete(req.params.id);
    if (!psw) return res.status(404).json({ message: "PSW not found" });
    res.json({ message: "PSW deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Bookings (read + update status) ──
exports.getBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const bookings = await Booking.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("pswWorker", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();
    // Flatten names for frontend convenience
    const result = bookings.map(b => ({
      ...b,
      clientName: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : b.client || null,
      clientEmail: b.userId?.email || null,
      pswName: b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : null
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Users ──
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { role, firstName, lastName } = req.body;
    const update = {};
    if (role) update.role = role;
    if (firstName) update.firstName = firstName;
    if (lastName) update.lastName = lastName;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Booking Requests (admin view into the pipeline) ──
exports.getBookingRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const requests = await BookingRequest.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("matchedPSWs", "firstName lastName")
      .populate("selectedPSW.pswId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();
    const result = requests.map(r => ({
      ...r,
      clientName: r.userId ? `${r.userId.firstName} ${r.userId.lastName}` : null,
      clientEmail: r.userId?.email || null,
      selectedPSWName: r.selectedPSW?.pswId
        ? `${r.selectedPSW.pswId.firstName} ${r.selectedPSW.pswId.lastName}`
        : r.selectedPSW?.name || null,
      matchedCount: r.matchedPSWs?.length || 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBookingRequest = async (req, res) => {
  try {
    const request = await BookingRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: "Booking request not found" });
    res.json({ message: "Booking request deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
