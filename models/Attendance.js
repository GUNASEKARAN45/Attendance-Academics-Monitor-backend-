// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentReg: { type: String, required: true },
  name: { type: String, required: true },
  year: { type: Number, required: true },
  department: { type: String, required: true },
  section: { type: String, required: true },
  date: { type: Date, required: true }, // date without time
  session1: { type: Number }, // optional: which session/period was marked
  session1: { type: Number, enum: [0, 1], default: null },
  session2: { type: Number, enum: [0, 1], default: null },
  session3: { type: Number, enum: [0, 1], default: null },
  session4: { type: Number, enum: [0, 1], default: null },
  session5: { type: Number, enum: [0, 1], default: null },
  session6: { type: Number, enum: [0, 1], default: null },
  session7: { type: Number, enum: [0, 1], default: null },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  markedAt: { type: Date, default: Date.now },
});

// Compound index for fast lookup
attendanceSchema.index({ studentId: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);