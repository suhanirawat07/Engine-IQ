const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Firebase UID
    // ── 16 sensor inputs ──────────────────────────────────────────────────
    RPM: { type: Number, required: true },
    SPEED: { type: Number, required: true },
    THROTTLE_POS: { type: Number, required: true },
    MAF: { type: Number, required: true },
    SHORT_FUEL_TRIM_1: { type: Number, required: true },
    COOLANT_TEMP: { type: Number, required: true },
    INTAKE_TEMP: { type: Number, required: true },
    LONG_FUEL_TRIM_1: { type: Number, required: true },
    ENGINE_LOAD: { type: Number, required: true },
    FUEL_LEVEL: { type: Number, required: true },
    ELM_VOLTAGE: { type: Number, required: true },
    FUEL_USAGE_ML_MIN: { type: Number, required: true },
    FUEL_USED_TOTAL_ML: { type: Number, required: true },
    RELATIVE_THROTTLE_POS: { type: Number, required: true },
    ABSOLUTE_LOAD: { type: Number, required: true },
    INTAKE_PRESSURE: { type: Number, required: true },
    // ── ML output ─────────────────────────────────────────────────────────
    health_score: { type: Number, required: true },
    risk_level: { type: String, required: true },
    risk_description: { type: String },
    recommendations: [{ type: String }],
    shap_explanation: { type: Object },
    feedback: {
      isAccurate: { type: Boolean },
      correctedRiskLevel: {
        type: String,
        enum: ["Healthy", "Moderate", "High Risk", "Critical"],
      },
      notes: { type: String, maxlength: 500 },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Index for fast per-user queries
predictionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Prediction", predictionSchema);
