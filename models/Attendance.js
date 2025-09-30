// models/Attendance.js
const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema({
  date: String,
  subject: String,
  status: String
});

const attendanceSchema = new mongoose.Schema({
  studentReg: { type: String, required: true },
  records: [recordSchema]
});

module.exports = mongoose.model("Attendance", attendanceSchema);
