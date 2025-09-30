const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    present: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Student", studentSchema);
