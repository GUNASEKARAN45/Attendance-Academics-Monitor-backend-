// models/StudentMarks.js
const mongoose = require('mongoose');

const studentMarksSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentReg: { type: String, required: true },
  name: { type: String, required: true },
  year: { type: Number, required: true },
  department: { type: String, required: true },
  section: { type: String, required: true },
  subject: { type: String, required: true },
  ut1: { type: Number, default: 0 },
  ut2: { type: Number, default: 0 },
  ut3: { type: Number, default: 0 },
  model1: { type: Number, default: 0 },
  sem: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StudentMarks', studentMarksSchema);