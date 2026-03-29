const axios = require("axios");
const Prediction = require("../models/Prediction");
const SystemState = require("../models/SystemState");

const SENSOR_FIELDS = [
  "RPM", "SPEED", "THROTTLE_POS", "MAF", "SHORT_FUEL_TRIM_1",
  "COOLANT_TEMP", "INTAKE_TEMP", "LONG_FUEL_TRIM_1", "ENGINE_LOAD",
  "FUEL_LEVEL", "ELM_VOLTAGE", "FUEL_USAGE_ML_MIN", "FUEL_USED_TOTAL_ML",
  "RELATIVE_THROTTLE_POS", "ABSOLUTE_LOAD", "INTAKE_PRESSURE",
];

const VALID_RISK_LEVELS = new Set(["Healthy", "Moderate", "High Risk", "Critical"]);
const RETRAIN_STATE_KEY = "ml_retrain";
const DEFAULT_RETRAIN_INTERVAL = Math.max(
  parseInt(process.env.RETRAIN_EVERY_FEEDBACKS, 10) || 10,
  1
);

const getErrorMessage = (err) => err?.response?.data?.detail || err.message || "Unknown error";

const getFeedbackCount = () =>
  Prediction.countDocuments({ "feedback.submittedAt": { $type: "date" } });

const getOrCreateRetrainState = async (retrainInterval = DEFAULT_RETRAIN_INTERVAL) => {
  let state = await SystemState.findOne({ key: RETRAIN_STATE_KEY });
  if (!state) {
    state = await SystemState.create({
      key: RETRAIN_STATE_KEY,
      retrainInterval,
      lastRetrainStatus: "never",
      lastRetrainMessage: "No retraining has run yet.",
      lastProcessedFeedbackCount: 0,
    });
  }
  if (state.retrainInterval !== retrainInterval) {
    state.retrainInterval = retrainInterval;
    await state.save();
  }
  return state;
};

const buildFeedbackSamples = async () => {
  const feedbackPredictions = await Prediction.find({ "feedback.isAccurate": { $in: [true, false] } })
    .sort({ "feedback.submittedAt": -1 })
    .limit(5000)
    .lean();

  const samples = [];
  for (const item of feedbackPredictions) {
    const label = item.feedback?.isAccurate ? item.risk_level : item.feedback?.correctedRiskLevel;
    if (!VALID_RISK_LEVELS.has(label)) continue;

    const sample = { label };
    let valid = true;
    for (const field of SENSOR_FIELDS) {
      const value = Number(item[field]);
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      sample[field] = value;
    }
    if (valid) samples.push(sample);
  }
  return samples;
};

const executeRetrain = async ({ state, minSamples, trigger }) => {
  const samples = await buildFeedbackSamples();
  if (samples.length < minSamples) {
    throw new Error(`Not enough feedback samples to retrain. Need at least ${minSamples}, got ${samples.length}.`);
  }

  const mlResponse = await axios.post(
    `${process.env.ML_API_URL}/retrain`,
    { samples },
    { timeout: 180000 }
  );

  const feedbackCount = await getFeedbackCount();
  state.feedbackCount = feedbackCount;
  state.lastProcessedFeedbackCount = feedbackCount;
  state.lastRetrainAt = new Date();
  state.lastRetrainStatus = "success";
  state.lastRetrainMessage = `Retrained successfully from ${samples.length} feedback samples (${trigger}).`;
  state.lastRetrainSampleCount = samples.length;
  state.isRetraining = false;
  await state.save();

  return {
    retrain: mlResponse.data,
    sampleCount: samples.length,
  };
};

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

    const {
      risk_level,
      health_score,
      risk_description,
      recommendations,
      shap_explanation,
    } = mlResponse.data;

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
        shap_explanation,
      });
    }

    return res.json({
      success: true,
      prediction: {
        risk_level,
        health_score,
        risk_description,
        recommendations,
        shap_explanation,
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

/**
 * PATCH /api/predict/:id/feedback
 * Captures user feedback on prediction quality.
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, isAccurate, correctedRiskLevel, notes } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (typeof isAccurate !== "boolean") {
      return res.status(400).json({ error: "isAccurate must be boolean" });
    }
    if (!isAccurate && !correctedRiskLevel) {
      return res.status(400).json({ error: "correctedRiskLevel is required when prediction is inaccurate" });
    }
    if (correctedRiskLevel && !VALID_RISK_LEVELS.has(correctedRiskLevel)) {
      return res.status(400).json({ error: "Invalid correctedRiskLevel" });
    }

    const prediction = await Prediction.findOne({ _id: id, userId });
    if (!prediction) return res.status(404).json({ error: "Prediction not found" });

    prediction.feedback = {
      isAccurate,
      correctedRiskLevel: isAccurate ? undefined : correctedRiskLevel,
      notes: notes?.trim() || undefined,
      submittedAt: new Date(),
    };

    await prediction.save();

    const retrainInterval = Math.max(
      parseInt(req.body?.retrainInterval, 10) || DEFAULT_RETRAIN_INTERVAL,
      1
    );
    const state = await getOrCreateRetrainState(retrainInterval);
    const feedbackCount = await getFeedbackCount();
    const pendingFeedback = Math.max(0, feedbackCount - (state.lastProcessedFeedbackCount || 0));

    state.feedbackCount = feedbackCount;
    state.retrainInterval = retrainInterval;

    let retrainResult = null;
    let retrainTriggered = false;

    if (!state.isRetraining && pendingFeedback >= retrainInterval) {
      retrainTriggered = true;
      state.isRetraining = true;
      state.lastRetrainStatus = "running";
      state.lastRetrainMessage = `Scheduled retrain started after ${pendingFeedback} new feedback entries.`;
      await state.save();

      try {
        const scheduled = await executeRetrain({
          state,
          minSamples: Math.max(retrainInterval, 2),
          trigger: "scheduled",
        });
        retrainResult = {
          success: true,
          sampleCount: scheduled.sampleCount,
        };
      } catch (retrainErr) {
        state.lastRetrainStatus = "failed";
        state.lastRetrainMessage = getErrorMessage(retrainErr);
        state.lastRetrainSampleCount = 0;
        state.isRetraining = false;
        await state.save();

        retrainResult = {
          success: false,
          error: getErrorMessage(retrainErr),
        };
      }
    } else {
      const remaining = Math.max(0, retrainInterval - pendingFeedback);
      if (!state.isRetraining) {
        state.lastRetrainMessage =
          remaining > 0
            ? `Waiting for ${remaining} more feedback entr${remaining === 1 ? "y" : "ies"} before next retrain.`
            : state.lastRetrainMessage;
      }
      await state.save();
    }

    return res.json({
      success: true,
      predictionId: prediction._id,
      scheduler: {
        retrainInterval,
        feedbackCount,
        pendingFeedback,
        retrainTriggered,
        retrainResult,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/predict/retrain
 * Builds a feedback-derived dataset and requests ML API retraining.
 */
exports.retrainFromFeedback = async (req, res) => {
  try {
    const minSamples = Math.max(parseInt(req.body?.minSamples, 10) || 10, 2);

    const state = await getOrCreateRetrainState();
    if (state.isRetraining) {
      return res.status(409).json({ error: "Retraining is already in progress." });
    }

    state.isRetraining = true;
    state.lastRetrainStatus = "running";
    state.lastRetrainMessage = "Manual retrain started.";
    await state.save();

    const manual = await executeRetrain({ state, minSamples, trigger: "manual" });

    return res.json({ success: true, retrain: manual.retrain, sampleCount: manual.sampleCount });
  } catch (err) {
    const state = await SystemState.findOne({ key: RETRAIN_STATE_KEY });
    if (state) {
      state.lastRetrainStatus = "failed";
      state.lastRetrainMessage = getErrorMessage(err);
      state.lastRetrainSampleCount = 0;
      state.isRetraining = false;
      await state.save();
    }
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

/**
 * GET /api/predict/retrain/stats
 * Returns scheduler and latest retrain status for admin cards.
 */
exports.getRetrainStats = async (req, res) => {
  try {
    const state = await getOrCreateRetrainState();
    const feedbackCount = await getFeedbackCount();
    const pendingFeedback = Math.max(0, feedbackCount - (state.lastProcessedFeedbackCount || 0));

    if (state.feedbackCount !== feedbackCount) {
      state.feedbackCount = feedbackCount;
      await state.save();
    }

    return res.json({
      success: true,
      stats: {
        feedbackCount,
        retrainInterval: state.retrainInterval || DEFAULT_RETRAIN_INTERVAL,
        pendingFeedback,
        lastRetrainAt: state.lastRetrainAt,
        lastRetrainStatus: state.lastRetrainStatus,
        lastRetrainMessage: state.lastRetrainMessage,
        lastRetrainSampleCount: state.lastRetrainSampleCount,
        isRetraining: state.isRetraining,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
