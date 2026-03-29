const mongoose = require("mongoose");

const systemStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    feedbackCount: { type: Number, default: 0 },
    retrainInterval: { type: Number, default: 10 },
    lastProcessedFeedbackCount: { type: Number, default: 0 },
    lastRetrainAt: { type: Date },
    lastRetrainStatus: {
      type: String,
      enum: ["never", "running", "success", "failed"],
      default: "never",
    },
    lastRetrainMessage: { type: String, default: "No retraining has run yet." },
    lastRetrainSampleCount: { type: Number, default: 0 },
    isRetraining: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemState", systemStateSchema);
