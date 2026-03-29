const User = require("../models/User");

/**
 * POST /api/users/sync
 * Creates or updates a user record from Firebase auth data.
 */
exports.syncUser = async (req, res) => {
  try {
    const { googleId, email, name, photoURL } = req.body;
    if (!googleId || !email) {
      return res.status(400).json({ error: "googleId and email required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const adminEmailSet = new Set(adminEmails);

    const existingUser = await User.findOne({ googleId }).lean();
    let role = existingUser?.role || "user";
    if (adminEmailSet.has(normalizedEmail)) role = "admin";

    const user = await User.findOneAndUpdate(
      { googleId },
      { googleId, email: normalizedEmail, name, photoURL, role },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
