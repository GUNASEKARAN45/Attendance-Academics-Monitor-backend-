const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    // Connect to MongoDB Atlas using the connection string from .env
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Check if an admin already exists
    const existingAdmin = await User.findOne({ role: "admin" }).exec();
    if (existingAdmin) {
      console.log("Admin already exists, no action taken.");
      return;
    }

    // Define admin credentials
    const username = "admin";
    const name = "Administrator";
    const password = process.env.ADMIN_INIT_PASS || "Admin@123"; // Use .env password or default
    const hash = await bcrypt.hash(password, 10);

    // Create new admin user
    const admin = new User({
      role: "admin",
      username: username,
      name: name,
      passwordHash: hash,
    });

    // Save to database
    await admin.save();
    console.log(
      `✅ Admin created successfully with username '${username}' and password '${password}'`
    );
  } catch (err) {
    console.error("Error creating admin:", err);
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
}

createAdmin();