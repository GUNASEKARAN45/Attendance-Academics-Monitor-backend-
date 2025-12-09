// models/ExamSchedule.js
const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  subjectCode: { type: String, required: true },
  examType: {
    type: String,
    enum: ['UT1', 'UT2', 'UT3', 'Model', 'Semester'],
    required: true
  },
  examDate: { type: Date, required: true },
  year: { type: Number, required: true },
  department: { type: String, required: true, uppercase: true },
  section: { type: String, required: true, uppercase: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamSchedule', examSchema);