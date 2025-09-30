const express = require("express");
const Student = require("../models/Student");
const router = express.Router();

// Mark student present
router.post("/mark", async (req, res) => {
    try {
        const { studentId, name } = req.body;

        let student = await Student.findOne({ studentId });

        if (!student) {
            student = new Student({ studentId, name, present: true });
        } else {
            student.present = true;
            student.date = Date.now();
        }

        await student.save();
        res.json({ message: "Attendance marked", student });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get attendance list
router.get("/list", async (req, res) => {
    try {
        const students = await Student.find();
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
