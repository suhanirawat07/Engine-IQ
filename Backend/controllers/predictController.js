const axios = require("axios");
const Prediction = require("../models/Prediction");

const SENSOR_FIELDS = [
  "RPM", "SPEED", "THROTTLE_POS", "MAF", "SHORT_FUEL_TRIM_1",
  "COOLANT_TEMP", "INTAKE_TEMP", "LONG_FUEL_TRIM_1", "ENGINE_LOAD",
  "FUEL_LEVEL", "ELM_VOLTAGE", "FUEL_USAGE_ML_MIN", "FUEL_USED_TOTAL_ML",
  "RELATIVE_THROTTLE_POS", "ABSOLUTE_LOAD", "INTAKE_PRESSURE",
];

/**
 * POST /api/predict
 * Forwards sensor data to Python ML API, stores result, returns prediction.
 */
exports.predict = async (req, res) => {
  try {
    const { userId, ...sensorData } = req.body;

    // Validate all 16 fields are present
    const missing = SENSOR_FIELDS.filter(
      (f) => sensorData[f] === undefined || sensorData[f] === null
    );
    if (missing.length) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
    }

    // Build payload for ML API
    const mlPayload = {};
    for (const field of SENSOR_FIELDS) {
      mlPayload[field] = parseFloat(sensorData[field]);
    }

    // Call Python ML API
    const mlResponse = await axios.post(
      `${process.env.ML_API_URL}/predict`,
      mlPayload,
      { timeout: 120000 }
    );

    const { risk_level, health_score, risk_description, recommendations } = mlResponse.data;

    // Persist to MongoDB (only if userId provided)
    let saved = null;
    if (userId) {
      saved = await Prediction.create({
        userId,
        ...mlPayload,
        health_score,
        risk_level,
        risk_description,
        recommendations,
      });
    }

    return res.json({
      success: true,
      prediction: {
        risk_level,
        health_score,
        risk_description,
        recommendations,
        id: saved?._id,
        createdAt: saved?.createdAt || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Predict error:", err.message);
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "ML API unavailable. Please ensure the Python server is running." });
    }
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/predict/history/:userId
 * Returns last 50 predictions for the given user.
 */
exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = parseInt(req.query.skip) || 0;

    const [predictions, total] = await Promise.all([
      Prediction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Prediction.countDocuments({ userId }),
    ]);

    return res.json({ success: true, predictions, total, limit, skip });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/predict/:id
 * Deletes a single prediction record.
 */
exports.deletePrediction = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const result = await Prediction.findOneAndDelete({ _id: id, userId });
    if (!result) return res.status(404).json({ error: "Prediction not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
