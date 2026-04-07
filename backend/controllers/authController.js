const User = require("../models/User");
const PSWWorker = require("../models/PSWWorker");
const { generateToken } = require("../middleware/auth");
const { geocodePostalCode } = require("../services/geocoder");

// POST /auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const userData = { email, password, firstName, lastName };
    if (phone) userData.phone = phone;
    if (address) {
      userData.address = {
        street: address.street || "",
        unit: address.unit || "",
        city: address.city || "",
        postalCode: address.postalCode || ""
      };
      // Auto-geocode from postal code
      const coords = geocodePostalCode(address.postalCode);
      if (coords) userData.address.coordinates = coords;
    }
    // Only allow client or psw from registration (never admin)
    if (role === "psw") {
      userData.role = "psw";
    }

    const user = new User(userData);
    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      message: "Account created",
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /auth/me — returns current user from token
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /auth/profile — update profile info
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { firstName, lastName, phone, address } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address) {
      user.address = {
        street: address.street || "",
        unit: address.unit || "",
        city: address.city || "",
        postalCode: address.postalCode || ""
      };
      const coords = geocodePostalCode(address.postalCode);
      if (coords) user.address.coordinates = coords;
    }

    await user.save();

    // Sync name changes to PSWWorker if user is a PSW
    if (user.role === "psw") {
      await PSWWorker.findOneAndUpdate(
        { user: user._id },
        { firstName: user.firstName, lastName: user.lastName }
      );
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /auth/password — change password
exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const { currentPassword, newPassword } = req.body;

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
