require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const User = require("./models/User");
const authMiddleware = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory captcha store: { id: { text, expiresAt } }
const captchas = {};

// Connect DB
mongoose.connect(process.env.MONGO_URI, { })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connect error:", err));

// Create initial admin if none exists
(async function ensureAdmin() {
  try {
    const existing = await User.findOne({ role: "admin" }).exec();
    if (!existing) {
      const pwd = process.env.ADMIN_INIT_PASS || "Admin@123";
      const hash = await bcrypt.hash(pwd, 10);
      const admin = new User({ role: "admin", username: "admin", name: "Administrator", passwordHash: hash });
      await admin.save();
      console.log("✅ Initial admin created with username 'admin' and password from .env");
    }
  } catch (err) {
    console.error("Error creating initial admin:", err);
  }
})();

// --- CAPTCHA endpoint ---
app.get("/api/captcha", (req, res) => {
  // generate random mix of words & letters - length 6-8
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // avoid similar chars
  const length = 6 + Math.floor(Math.random() * 3);
  let text = "";
  for (let i=0;i<length;i++) text += chars[Math.floor(Math.random() * chars.length)];
  const id = uuidv4();
  captchas[id] = { text, expiresAt: Date.now() + 2*60*1000 }; // 2 minutes expiry
  // cleanup old ones occasionally (simple)
  setTimeout(() => { delete captchas[id]; }, 2*60*1000 + 1000);
  res.json({ id, captcha: text });
});

// Helper: validate captcha
function verifyCaptcha(id, input) {
  if (!id || !input) return false;
  const rec = captchas[id];
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) { delete captchas[id]; return false; }
  const ok = rec.text.toLowerCase() === (input || "").toLowerCase();
  if (ok) delete captchas[id];
  return ok;
}

// --- Auth login endpoint (single unified endpoint) ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, identifier, password, captchaId, captchaInput } = req.body;
    // verify captcha
    const okCaptcha = verifyCaptcha(captchaId, captchaInput);
    if (!okCaptcha) return res.status(400).json({ error: "Invalid or expired captcha" });

    // find user based on role and identifier
    let user = null;
    if (role === "student") user = await User.findOne({ role: "student", studentReg: identifier }).exec();
    else if (role === "staff") user = await User.findOne({ role: "staff", staffId: identifier }).exec();
    else if (role === "admin") user = await User.findOne({ role: "admin", username: identifier }).exec();
    else return res.status(400).json({ error: "Invalid role" });

    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    // create token
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Admin: add student ---
app.post("/api/admin/add-student", authMiddleware("admin"), async (req, res) => {
  try {
    const { studentReg, name, password, degree, year, department, section } = req.body;

    // Validate all required fields
    if (!studentReg || !name || !password || !degree || !year || !department || !section) {
      return res.status(400).json({ error: "All student fields are required" });
    }

    // Check for existing student or username
    const existing = await User.findOne({ $or: [{ studentReg }, { username: studentReg }] }).exec();
    if (existing) return res.status(400).json({ error: "Student or username already exists" });

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create student with all fields
    const user = new User({
      role: "student",
      studentReg,
      username: studentReg,
      name,
      passwordHash: hash,
      degree,
      year,
      department,
      section
    });

    await user.save();
    res.json({ message: "Student added", user: { studentReg, name, degree, year, department, section } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// --- Admin: add staff ---
app.post("/api/admin/add-staff", authMiddleware("admin"), async (req, res) => {
  try {
    const { staffId, name, password } = req.body;
    if (!staffId || !password) return res.status(400).json({ error: "Missing fields" });
    const existing = await User.findOne({ $or: [{ staffId }, { username: staffId }] }).exec();
    if (existing) return res.status(400).json({ error: "Staff or username already exists" });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      role: "staff",
      staffId,
      username: staffId,
      name,
      passwordHash: hash
    });
    await user.save();
    res.json({ message: "Staff added", user: { staffId, name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const StaffAssign = require("./models/StaffAssign");

app.post("/api/admin/assign-staff", authMiddleware("admin"), async (req, res) => {
  try {
    const { staffId, staffName, department, year, section } = req.body;
    if (!staffId || !department || !year || !section) 
      return res.status(400).json({ error: "All fields are required" });

    // Save to StaffAssign collection
    const assign = new StaffAssign({ staffId, staffName, department, year, section });
    await assign.save();

    res.json({ message: "Staff assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint to fetch all staff
app.get("/api/admin/staff-list", authMiddleware("admin"), async (req, res) => {
  try {
    const staffs = await User.find({ role: "staff" }, "staffId name department").lean();
    res.json(staffs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// --- Admin: list users (for UI) ---
app.get("/api/admin/users", authMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find({}, "-passwordHash").sort({ role: 1, name: 1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- Simple test / health ---
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));
