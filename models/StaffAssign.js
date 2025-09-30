const mongoose = require("mongoose");

const staffAssignSchema = new mongoose.Schema({
  staffId: { type: String, required: true },       // staff's unique ID
  staffName: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StaffAssign", staffAssignSchema);
