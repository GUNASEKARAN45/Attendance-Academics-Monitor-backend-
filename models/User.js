const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "student", "staff"], required: true },
  studentReg: { type: String, unique: true, sparse: true }, // For students
  staffId: { type: String, unique: true, sparse: true },   // For staff
  adminId: { type: String, unique: true, sparse: true },   // For admin (added)
  username: { type: String, required: true, unique: true }, // Generic username
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  degree: { type: String },         // For students
  year: { type: Number },           // For students
  department: { type: String },     // For students and staff
  section: { type: String },        // For students
  dob: { type: Date },              // For students
  email: { type: String },          // For students and staff
  phone: { type: String },          // For students and staff
  designation: { type: String },    // For staff
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ studentReg: 1 }, { unique: true, sparse: true });
userSchema.index({ staffId: 1 }, { unique: true, sparse: true });
userSchema.index({ adminId: 1 }, { unique: true, sparse: true }); // Added index for adminId

module.exports = mongoose.model("User", userSchema);