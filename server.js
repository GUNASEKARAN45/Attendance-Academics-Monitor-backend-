require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const multer = require('multer');
const upload = multer();

const User = require("./models/User");
const StaffAssign = require("./models/StaffAssign");
const authMiddleware = require("./middleware/auth");
const StudentMarks = require("./models/StudentMarks");

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory captcha store
const captchas = {};

// Connect DB
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log(" MongoDB connected"))
  .catch(err => console.error("MongoDB connect error:", err));

// Create initial admin if none exists
// ... (previous imports and middleware setup)

(async function ensureAdmin() {
  try {
    console.log("Checking for existing admin...");
    const existing = await User.findOne({ role: "admin" }).exec();
    if (!existing) {
      console.log("No admin found, creating new admin...");
      const pwd = process.env.ADMIN_INIT_PASS || "Admin@123";
      const hash = await bcrypt.hash(pwd, 10);
      const admin = new User({
        role: "admin",
        username: "admin",
        name: "admin", // Changed to "admin"
        designation: "Administrator", // Added designation
        adminId: "ADM001", // Added adminId
        passwordHash: hash,
      });
      await admin.save();
      console.log(
        " Initial admin created with username 'admin', name 'admin', designation 'Administrator', adminId 'ADM001', and password:",
        pwd
      );
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
  for (let i = 0; i < length; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }

  const id = uuidv4();
  captchas[id] = { text }; // store only captcha text, no expiry

  res.json({ id, captcha: text });
});

// --- CAPTCHA verification ---
function verifyCaptcha(id, input) {
  if (!id || !input) return false;
  const rec = captchas[id];
  if (!rec) return false;

  const ok = rec.text.toLowerCase() === (input || "").toLowerCase();

  if (ok) {
    // delete only after successful verification
    delete captchas[id];
  }

  return ok;
}

// --- Auth login endpoint ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, identifier, password, captchaId, captchaInput } = req.body;
    const okCaptcha = verifyCaptcha(captchaId, captchaInput);
    if (!okCaptcha) {
      return res.status(400).json({ error: "Invalid or expired captcha" });
    }

    let user = null;
    if (role === "student") {
      user = await User.findOne({ studentReg: identifier, role: "student" }).exec();
    } else if (role === "staff") {
      user = await User.findOne({ staffId: identifier, role: "staff" }).exec();
    } else if (role === "admin") {
      user = await User.findOne({ username: identifier, role: "admin" }).exec();
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id, role: role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "8h" }
    );

    res.json({ token, role: role, name: user.name });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Admin: add student ---

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

// --- Admin: assign staff ---
app.post("/api/admin/assign-staff", authMiddleware("admin"), async (req, res) => {
  try {
    console.log("Assign staff request received:", req.body);
    const { staffId, staffName, department, year, section, subject } = req.body;

    if (!staffId || !staffName || !department || !year || !section || !subject) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const assign = new StaffAssign({ 
      staffId, 
      staffName, 
      department, 
      year, 
      section, 
      subject, 
      assignedAt: Date.now() 
    });

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

// Add this new endpoint to your server.js, right after the other routes

// --- Get current user profile ---
app.get("/api/user/profile", authMiddleware(), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Fetch profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Change password ---
app.post("/api/user/change-password", authMiddleware(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current and new passwords are required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// === NEW: Get students by year, dept, section (for staff dashboard) ===
app.get("/api/staff/students", authMiddleware("staff"), async (req, res) => {
  try {
    const { year, department, section } = req.query;

    if (!year || !department || !section) {
      return res.status(400).json({ error: "Year, department, and section are required" });
    }

    const students = await User.find({
      role: "student",
      year: parseInt(year),
      department: department.toUpperCase(),
      section: section.toUpperCase(),
    })
      .select("studentReg name _id")
      .sort({ studentReg: 1 })
      .lean();

    res.json(students);
  } catch (err) {
    console.error("Error fetching students for attendance:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});


// GET: Fetch marks for selected class + subject
app.get("/api/staff/marks", authMiddleware("staff"), async (req, res) => {
  try {
    const { year, department, section, subject } = req.query;
    if (!year || !department || !section || !subject) {
      return res.status(400).json({ error: "All filters required" });
    }

    const students = await User.find({
      role: "student",
      year: parseInt(year),
      department: department.toUpperCase(),
      section: section.toUpperCase(),
    }).select("studentReg name _id").lean();

    // For each student, find or create marks record
    const marksData = await Promise.all(
      students.map(async (student) => {
        let record = await StudentMarks.findOne({
          studentId: student._id,
          subject,
          year: parseInt(year),
          department: department.toUpperCase(),
          section: section.toUpperCase(),
        });

        if (!record) {
          record = await StudentMarks.create({
            studentId: student._id,
            studentReg: student.studentReg,
            name: student.name,
            year: parseInt(year),
            department: department.toUpperCase(),
            section: section.toUpperCase(),
            subject,
            ut1: 0, ut2: 0, ut3: 0, model1: 0, sem: 0,
          });
        }

        return {
          _id: record._id,
          studentReg: student.studentReg,
          name: student.name,
          ut1: record.ut1,
          ut2: record.ut2,
          ut3: record.ut3,
          model1: record.model1,
          sem: record.sem,
        };
      })
    );

    res.json(marksData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST: Save all marks

app.post("/api/staff/marks/save", authMiddleware("staff"), async (req, res) => {
  try {
    const { marks, subject, year, department, section } = req.body;

    const updates = marks.map(async (m) => {
      await StudentMarks.updateOne(
        { _id: m._id },  // ← NOW MATCHES THE _id SENT FROM FRONTEND
        {
          $set: {
            ut1: m.ut1,
            ut2: m.ut2,
            ut3: m.ut3,
            model1: m.model1,
            sem: m.sem,
            updatedAt: new Date(),
          },
        }
      );
    });

    await Promise.all(updates);
    res.json({ message: "Marks saved successfully!" });
  } catch (err) {
    console.error("Save marks error:", err);
    res.status(500).json({ error: "Failed to save marks" });
  }
});

app.post("/api/admin/add-student", authMiddleware("admin"), async (req, res) => {
  try {
    const {
      studentReg, name, password, degree, year, department, section,
      dob, email, phone, faceEmbedding
    } = req.body;

    if (!studentReg || !name || !password || !degree || !year || !department || !section || !dob || !email || !phone) {
      return res.status(400).json({ error: "All student fields are required" });
    }

    const existing = await User.findOne({ studentReg, role: "student" });
    if (existing) return res.status(400).json({ error: "Student already exists" });

    const hash = await bcrypt.hash(password, 10);

    const student = new User({
      role: "student",
      studentReg,
      username: studentReg,
      name,
      passwordHash: hash,
      degree,
      year: parseInt(year),
      department: department.toUpperCase(),
      section: section.toUpperCase(),
      dob: new Date(dob),
      email,
      phone,
      faceEmbedding: faceEmbedding || null,
    });

    await student.save();
    res.json({ message: "Student added with Face Recognition!" });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: Fetch full student insights (marks + attendance placeholder)
app.get("/api/staff/student-insights", authMiddleware("staff"), async (req, res) => {
  try {
    const { studentId, subject, year, department, section } = req.query;

    if (!studentId || !subject || !year || !department || !section) {
      return res.status(400).json({ error: "All parameters are required" });
    }

    // Fetch student basic info
    const student = await User.findById(studentId)
      .select("studentReg name")
      .lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Fetch marks for this subject
    let marksRecord = await StudentMarks.findOne({
      studentId,
      subject,
      year: parseInt(year),
      department: department.toUpperCase(),
      section: section.toUpperCase(),
    }).lean();

    // If no marks record → create default with 0s
    if (!marksRecord) {
      marksRecord = {
        ut1: 0,
        ut2: 0,
        ut3: 0,
        model1: 0,
        sem: 0,
      };
    }

    // Hardcoded predictive insights (you can make this dynamic later)
    const insights = [
      marksRecord.ut1 < 40 ? "Struggling in Unit Test 1 – needs revision" : "Good performance in Unit Test 1",
      marksRecord.sem > 80 ? "Strong semester performance expected" : "Focus needed for semester exam preparation",
      "Consistent attendance recommended to improve overall grade",
    ];

    res.json({
      regNo: student.studentReg.slice(-5), // last 5 digits
      fullRegNo: student.studentReg,
      name: student.name,
      attendancePercentage: 0, // We'll add real attendance later
      marks: {
        ut1: marksRecord.ut1 || 0,
        ut2: marksRecord.ut2 || 0,
        ut3: marksRecord.ut3 || 0,
        model1: marksRecord.model1 || 0,
        sem: marksRecord.sem || 0,
      },
      insights,
    });
  } catch (err) {
    console.error("Error fetching student insights:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// server.js — Add this endpoint
app.get("/api/admin/filtered-students", authMiddleware("admin"), async (req, res) => {
  try {
    const { department, year, section } = req.query;

    const query = { role: "student" };
    if (department) query.department = department.toUpperCase();
    if (year) query.year = parseInt(year);
    if (section) query.section = section.toUpperCase();

    const students = await User.find(query)
      .select("studentReg name")
      .sort({ studentReg: 1 })
      .lean();

    // Return students with default attendance: absent
    const attendanceData = students.map(s => ({
      regNo: s.studentReg,
      name: s.name,
      status: false,    // absent by default
      late: false
    }));

    res.json({
      attendance: attendanceData,
      totalStudents: attendanceData.length,
      presentCount: 0,
      lateCount: 0,
      absentCount: attendanceData.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// GET marks for selected class + subject
// GET marks for a class + subject (real students + real marks or 0)
app.get("/api/admin/marks", authMiddleware("admin"), async (req, res) => {
  try {
    const { department, year, section, subject } = req.query;

    if (!department || !year || !section || !subject) {
      return res.status(400).json({ error: "All filters required" });
    }

    // Get ALL real students in this class
    const students = await User.find({
      role: "student",
      department: department.toUpperCase(),
      year: parseInt(year),
      section: section.toUpperCase(),
    })
      .select("studentReg name")
      .sort({ studentReg: 1 })
      .lean();

    if (students.length === 0) {
      return res.json([]);
    }

    // Get existing marks
    const marksRecords = await StudentMarks.find({
      department: department.toUpperCase(),
      year: parseInt(year),
      section: section.toUpperCase(),
      subject: subject,
    }).lean();

    const marksMap = {};
    marksRecords.forEach(m => {
      marksMap[m.studentReg] = m;
    });

    // Build final list: every student appears, marks = real or 0
    const result = students.map(student => {
      const m = marksMap[student.studentReg] || {};
      return {
        regNo: student.studentReg,
        name: student.name,
        marks: {
          ut1: m.ut1 || 0,
          ut2: m.ut2 || 0,
          ut3: m.ut3 || 0,
          model1: m.model1 || 0,
          sem: m.sem || 0,
        }
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});




// --- Simple test / health ---
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));
