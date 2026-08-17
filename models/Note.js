// models/Note.js
const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    noteDate: {
      type: Date,
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes for query performance
noteSchema.index({ teacherId: 1, noteDate: 1 });
noteSchema.index({ attendanceId: 1 });

module.exports = mongoose.model("Note", noteSchema);
