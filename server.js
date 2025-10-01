require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const User = require("./models/User");
const StaffAssign = require("./models/StaffAssign");
const authMiddleware = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory captcha store
const captchas = {};

// Connect DB
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connect error:", err));

// Create initial admin if none exists
(async function ensureAdmin() {
  try {
    console.log("Checking for existing admin...");
    const existing = await User.findOne({ role: "admin" }).exec();
    if (!existing) {
      console.log("No admin found, creating new admin...");
      const pwd = process.env.ADMIN_INIT_PASS || "Admin@123";
      const hash = await bcrypt.hash(pwd, 10);
      const admin = new User({ role: "admin", username: "admin", name: "Administrator", passwordHash: hash });
      await admin.save();
      console.log("✅ Initial admin created with username 'admin' and password:", pwd);
    } else {
      console.log("Admin already exists, skipping creation.");
    }
  } catch (err) {
    console.error("Error creating initial admin:", err);
  }
})();

// --- CAPTCHA endpoint ---
app.get("/api/captcha", (req, res) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const length = 6 + Math.floor(Math.random() * 3);
  let text = "";
  for (let i = 0; i < length; i++) text += chars[Math.floor(Math.random() * chars.length)];
  const id = uuidv4();
  captchas[id] = { text, expiresAt: Date.now() + 2 * 60 * 1000 };
  setTimeout(() => { delete captchas[id]; }, 2 * 60 * 1000 + 1000);
  res.json({ id, captcha: text });
});

function verifyCaptcha(id, input) {
  if (!id || !input) return false;
  const rec = captchas[id];
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) { delete captchas[id]; return false; }
  const ok = rec.text.toLowerCase() === (input || "").toLowerCase();
  if (ok) delete captchas[id];
  return ok;
}

// --- Auth login endpoint ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, identifier, password, captchaId, captchaInput } = req.body;
    const okCaptcha = verifyCaptcha(captchaId, captchaInput);
    if (!okCaptcha) return res.status(400).json({ error: "Invalid or expired captcha" });

    let user = null;
    if (role === "student") user = await User.findOne({ studentReg: identifier, role: "student" }).exec();
    else if (role === "staff") user = await User.findOne({ staffId: identifier, role: "staff" }).exec();
    else if (role === "admin") user = await User.findOne({ username: identifier, role: "admin" }).exec();
    else return res.status(400).json({ error: "Invalid role" });

    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id, role: role }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, role: role, name: user.name });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Admin: add student ---
app.post("/api/admin/add-student", authMiddleware("admin"), async (req, res) => {
  try {
    console.log("Add student request received:", req.body);
    const { studentReg, name, password, degree, year, department, section, dob, email, phone } = req.body;

    if (!studentReg || !name || !password || !degree || !year || !department || !section || !dob || !email || !phone) {
      return res.status(400).json({ error: "All student fields are required" });
    }

    const existing = await User.findOne({ studentReg, role: "student" }).exec();
    if (existing) return res.status(400).json({ error: "Student already exists" });

    const hash = await bcrypt.hash(password, 10);
    console.log("Creating student with reg:", studentReg);

    const student = new User({
      role: "student",
      studentReg,
      username: studentReg,
      name,
      passwordHash: hash,
      degree,
      year,
      department,
      section,
      dob,
      email,
      phone
    });

    await student.save();
    console.log("Student saved to 'users' collection, ID:", student._id);
    res.json({ message: "Student added", user: { studentReg, name, degree, year, department, section, dob, email, phone } });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Admin: add staff ---
app.post("/api/admin/add-staff", authMiddleware("admin"), async (req, res) => {
  try {
    console.log("Add staff request received:", req.body);
    const { staffId, name, password, email, phone, department, designation } = req.body;
    if (!staffId || !name || !password || !email || !phone || !department || !designation) {
      return res.status(400).json({ error: "All staff fields are required" });
    }

    const existing = await User.findOne({ staffId, role: "staff" }).exec();
    if (existing) return res.status(400).json({ error: "Staff already exists" });

    const hash = await bcrypt.hash(password, 10);
    console.log("Creating staff with id:", staffId);

    const staff = new User({
      role: "staff",
      staffId,
      username: staffId,
      name,
      passwordHash: hash,
      email,
      phone,
      department,
      designation
    });

    await staff.save();
    console.log("Staff saved to 'users' collection, ID:", staff._id);
    res.json({ message: "Staff added", user: { staffId, name, email, phone, department, designation } });
  } catch (err) {
    console.error("Add staff error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/assign-staff", authMiddleware("admin"), async (req, res) => {
  try {
    console.log("Assign staff request received:", req.body);
    const { staffId, staffName, department, year, section, subject } = req.body;
    if (!staffId || !staffName || !department || !year || !section || !subject) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const assign = new StaffAssign({ staffId, staffName, department, year, section, subject, assignedAt: Date.now() });
    await assign.save();
    console.log("Staff assignment saved to 'staffassign' collection, ID:", assign._id);

    res.json({ message: "Staff assigned successfully" });
  } catch (err) {
    console.error("Assign staff error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint to fetch all staff
app.get("/api/admin/staff-list", authMiddleware("admin"), async (req, res) => {
  try {
    const staffs = await User.find({ role: "staff" }, "staffId name department").lean();
    console.log("Fetched staff list:", staffs);
    res.json(staffs);
  } catch (err) {
    console.error("Fetch staff list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Admin: list users ---
app.get("/api/admin/users", authMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find({}, "-passwordHash").lean().sort((a, b) => a.name.localeCompare(b.name));
    console.log("Fetched users:", users);
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Simple test / health ---
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));