const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["student","staff","admin"], required: true },
  studentReg: { type: String  },  // e.g. registration number for students
  staffId: { type: String },     // staff identifier
  username: { type: String, required: true },   // generic username (for admin can be admin id)
  name: { type: String },
  passwordHash: { type: String, required: true },
  degree: { type: String },         // e.g. B.E, B.Tech
  year: { type: Number },           // e.g. 1, 2, 3, 4
  department: { type: String },     // e.g. ECE, CSE
  section: { type: String },   
 

  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ studentReg: 1 }, { unique: true, sparse: true });
userSchema.index({ staffId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
