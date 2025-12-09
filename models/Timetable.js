// models/Timetable.js
const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  department: { type: String, required: true, uppercase: true },
  section: { type: String, required: true, uppercase: true },
  day: { 
    type: String, 
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 
    required: true 
  },
  period: { 
    type: String, 
    enum: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7'], 
    required: true 
  },
  subject: { type: String, required: true },
  staffName: { type: String, required: true },
  room: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Timetable', timetableSchema);