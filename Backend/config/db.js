const mongoose = require("mongoose");

const RETRY_DELAY_MS = Math.max(parseInt(process.env.DB_RETRY_DELAY_MS, 10) || 10000, 1000);

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    const masked = uri.replace(/:[^@]+@/, ":***@");
    console.log(`📡 Connecting to MongoDB: ${masked}`);
    
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("   Ensure: 1) MONGODB_URI is set, 2) Atlas Network Access allows Render IP (0.0.0.0/0 for testing), 3) Password is URL-encoded");
    console.log(`⏳ Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(() => {
      connectDB();
    }, RETRY_DELAY_MS);
  }
};

module.exports = connectDB;
