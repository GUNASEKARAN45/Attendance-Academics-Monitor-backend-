// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "student", "staff"], required: true },
  studentReg: { type: String, unique: true, sparse: true },
  staffId: { type: String, unique: true, sparse: true },
  adminId: { type: String, unique: true, sparse: true },
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },

  // Student fields
  degree: { type: String },
  year: { type: Number },
  department: { type: String },
  section: { type: String },
  dob: { type: Date },
  email: { type: String },
  phone: { type: String },

  // Staff fields
  designation: { type: String },

  // NEW: Face Embedding (512-dimensional vector)
  faceEmbedding: {
    type: [Number],     // Array of floats
    default: null,
    validate: {
      validator: function(v) {
        return v === null || (Array.isArray(v) && v.length === 512);
      },
      message: "Face embedding must be a 512-length array or null"
    }
  },

  createdAt: { type: Date, default: Date.now },
});


userSchema.index({ studentReg: 1 }, { unique: true, sparse: true });
userSchema.index({ staffId: 1 }, { unique: true, sparse: true });
userSchema.index({ adminId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);