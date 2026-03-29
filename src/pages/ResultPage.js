import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RISK_CONFIG, SENSORS } from "../services/sensorMeta";
import HealthGauge from "../components/HealthGauge";
import { useAuth } from "../hooks/useAuth";
import { askAssistant, submitPredictionFeedback } from "../services/api";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const prediction = state?.prediction;
  const inputs = state?.inputs;
  const risk_level = prediction?.risk_level || "Healthy";
  const health_score = prediction?.health_score ?? 0;
  const risk_description = prediction?.risk_description || "";
  const recommendations = prediction?.recommendations || [];
  const cfg = RISK_CONFIG[risk_level] || RISK_CONFIG["Healthy"];
  const [isAccurate, setIsAccurate] = useState(null);
  const [correctedRiskLevel, setCorrectedRiskLevel] = useState(risk_level);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "I can explain this prediction using your sensor and SHAP data. Ask: Why is my engine risk high?",
    },
  ]);

  // Guard: if navigated here directly without state
  if (!prediction) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-stone-500 gap-4">
        <p>No prediction result found.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-6 py-3 bg-amber-500 text-gray-950 font-bold rounded-xl text-sm"
        >
          Run Diagnostics
        </button>
      </div>
    );
  }

  const buildLocalExplanation = () => {
    if (!inputs) return null;

    const rows = SENSORS.map((sensor) => {
      const value = Number(inputs[sensor.key]);
      const safeValue = Number.isFinite(value) ? value : Number(sensor.default);
      const range = Math.max(1, Number(sensor.max) - Number(sensor.min));
      const impact = (safeValue - Number(sensor.default)) / range;
      return {
        feature: sensor.key,
        value: safeValue,
        impact,
        direction: impact >= 0 ? "increase" : "decrease",
        abs_impact: Math.abs(impact),
      };
    });

    const ranked = [...rows].sort((a, b) => b.abs_impact - a.abs_impact);
    return {
      method: "Heuristic Attribution (Fallback)",
      predicted_class: null,
      base_value: 0,
      top_positive: ranked.filter((r) => r.impact > 0).slice(0, 5),
      top_negative: ranked.filter((r) => r.impact < 0).slice(0, 5),
      top_features: ranked.slice(0, 8),
    };
  };

  const shap = prediction?.shap_explanation || buildLocalExplanation();

  const prettySensorName = (key) =>
    SENSORS.find((sensor) => sensor.key === key)?.label || key;

  const renderImpactRow = (row, colorClass) => {
    const barWidth = Math.max(8, Math.min(100, (row.abs_impact / 0.5) * 100));
    return (
      <div key={`${row.feature}-${row.impact}`} className="bg-stone-100 rounded-xl p-3 border border-stone-300">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-stone-900">{prettySensorName(row.feature)}</p>
          <p className="text-xs font-mono text-stone-500">impact {row.impact.toFixed(4)}</p>
        </div>
        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${barWidth}%` }} />
        </div>
        <p className="mt-2 text-xs text-stone-600">Input value: {row.value}</p>
      </div>
    );
  };

  const toRiskPoints = (impact) => Math.max(1, Math.round(Math.abs(impact) * 100));

  const topReasons =
    (shap?.top_positive?.length ? shap.top_positive : shap?.top_features || []).slice(0, 3);

  const handleSubmitFeedback = async () => {
    if (!prediction?.id) {
      setFeedbackStatus("Feedback requires a saved prediction. Please login and run a new scan.");
      return;
    }
    if (!user?.uid) {
      setFeedbackStatus("Please login to submit feedback.");
      return;
    }
    if (typeof isAccurate !== "boolean") {
      setFeedbackStatus("Please select whether this prediction was accurate.");
      return;
    }
    if (!isAccurate && !correctedRiskLevel) {
      setFeedbackStatus("Please choose the corrected risk level.");
      return;
    }

    setFeedbackBusy(true);
    setFeedbackStatus("");
    try {
      const feedbackRes = await submitPredictionFeedback(prediction.id, {
        userId: user.uid,
        isAccurate,
        correctedRiskLevel: isAccurate ? undefined : correctedRiskLevel,
        notes: feedbackNotes,
      });
      const scheduler = feedbackRes?.data?.scheduler;
      if (scheduler?.retrainTriggered && scheduler?.retrainResult?.success) {
        setFeedbackStatus(
          `Thanks! Feedback saved and scheduled retrain completed with ${scheduler.retrainResult.sampleCount} samples.`
        );
      } else if (scheduler?.retrainTriggered && scheduler?.retrainResult?.error) {
        setFeedbackStatus(`Feedback saved, but retrain failed: ${scheduler.retrainResult.error}`);
      } else {
        const remaining = Math.max(0, (scheduler?.retrainInterval || 0) - (scheduler?.pendingFeedback || 0));
        setFeedbackStatus(
          `Thanks! Feedback saved. Next auto-retrain in ${remaining} more feedback entr${remaining === 1 ? "y" : "ies"}.`
        );
      }

    } catch (err) {
      setFeedbackStatus(
        err?.response?.data?.error ||
          (err?.code === "ERR_NETWORK"
            ? "Cannot submit feedback right now. Check backend CORS/server status and try again."
            : "Failed to submit feedback.")
      );
    } finally {
      setFeedbackBusy(false);
    }
  };

  const handleAskAssistant = async () => {
    const question = assistantInput.trim();
    if (!question) return;

    const assistantPredictionContext = {
      risk_level,
      health_score,
      risk_description,
      recommendations,
      shap_explanation: shap,
    };

    setAssistantBusy(true);
    setAssistantError("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setAssistantInput("");

    try {
      const { data } = await askAssistant({
        question,
        prediction: assistantPredictionContext,
        inputs,
      });
      const providerTag = data?.provider ? ` (${data.provider})` : "";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `${data?.answer || "No response received."}${providerTag}` },
      ]);
    } catch (err) {
      setAssistantError(err?.response?.data?.error || "Assistant unavailable right now.");
    } finally {
      setAssistantBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900">Diagnostic Result</h1>
          <p className="text-stone-500 text-sm mt-1">{new Date().toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm border border-stone-300 hover:bg-stone-200 transition-all"
          >
            ← New Scan
          </button>
          <button
            onClick={() => navigate("/history")}
            className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-sm hover:bg-amber-500/20 transition-all"
          >
            View History
          </button>
        </div>
      </div>

      {/* Main result card */}
      <div
        className="bg-transparent border rounded-2xl p-8 mb-6 text-center"
        style={{ borderColor: `${cfg.color}40` }}
      >
        {/* Gauge */}
        <div className="flex justify-center mb-6">
          <HealthGauge score={health_score} riskLevel={risk_level} size={220} />
        </div>

        {/* Risk badge */}
        <div
          className="inline-block px-6 py-2 rounded-full font-bold text-gray-950 text-lg mb-4"
          style={{ backgroundColor: cfg.color }}
        >
          {risk_level}
        </div>

        {/* Description */}
        <p className="text-stone-700 text-sm max-w-xl mx-auto leading-relaxed">{risk_description}</p>
      </div>

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <div className="bg-transparent border border-[#44403c] rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
            <span>💡</span> Recommendations
          </h2>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-0.5 text-amber-400 flex-shrink-0">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SHAP XAI report */}
      <div className="bg-transparent border border-[#44403c] rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-stone-900 mb-2 flex items-center gap-2">
          <span>🧠</span> SHAP Explanation (XAI)
        </h2>
        <p className="text-stone-500 text-sm mb-4">
          This report highlights which sensor readings pushed the model toward the current prediction.
        </p>

        <div className="bg-stone-100 rounded-xl border border-stone-300 p-4 mb-5">
          <p className="text-sm font-semibold text-stone-900 mb-2">Health Score = {Math.round(health_score)}</p>
          <p className="text-sm font-semibold text-stone-900 mb-2">Top Reasons:</p>
          <ul className="space-y-1">
            {topReasons.map((row) => (
              <li key={`reason-${row.feature}-${row.impact}`} className="text-sm text-stone-700">
                - {row.impact >= 0 ? "High" : "Low"} {prettySensorName(row.feature)} ({row.impact >= 0 ? "+" : "-"}
                {toRiskPoints(row.impact)} risk)
              </li>
            ))}
          </ul>
        </div>

        {!shap ? (
          <div className="bg-stone-100 rounded-xl border border-stone-300 p-4">
            <p className="text-sm font-semibold text-stone-900 mb-1">Explanation temporarily unavailable</p>
            <p className="text-sm text-stone-600">
              The prediction completed, but no SHAP payload was returned by the ML service for this run.
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-stone-100 rounded-xl border border-stone-300 p-4">
                <p className="text-xs text-stone-500 mb-1">Method</p>
                <p className="text-sm font-semibold text-stone-900">{shap.method || "SHAP"}</p>
              </div>
              <div className="bg-stone-100 rounded-xl border border-stone-300 p-4">
                <p className="text-xs text-stone-500 mb-1">Base Value (model output baseline)</p>
                <p className="text-sm font-semibold text-stone-900">
                  {typeof shap.base_value === "number" ? shap.base_value.toFixed(4) : "N/A"}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-bold text-stone-900 mb-3">↑ Features Increasing Predicted Risk</h3>
                <div className="space-y-3">
                  {(shap.top_positive || []).length ? (
                    shap.top_positive.map((row) => renderImpactRow(row, "bg-red-500"))
                  ) : (
                    <p className="text-sm text-stone-500">No strong positive risk drivers detected.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-stone-900 mb-3">↓ Features Decreasing Predicted Risk</h3>
                <div className="space-y-3">
                  {(shap.top_negative || []).length ? (
                    shap.top_negative.map((row) => renderImpactRow(row, "bg-green-500"))
                  ) : (
                    <p className="text-sm text-stone-500">No strong protective drivers detected.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Feedback loop */}
      <div className="bg-transparent border border-[#44403c] rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-stone-900 mb-2 flex items-center gap-2">
          <span>🔁</span> Real-time Learning Feedback
        </h2>
        <p className="text-stone-500 text-sm mb-4">Was this prediction accurate?</p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={() => setIsAccurate(true)}
            className={`px-4 py-2 rounded-xl text-sm border transition-all ${
              isAccurate === true
                ? "bg-green-500/20 border-green-500/50 text-green-400"
                : "bg-stone-100 border-stone-300 text-stone-700"
            }`}
          >
            Yes, Accurate
          </button>
          <button
            type="button"
            onClick={() => setIsAccurate(false)}
            className={`px-4 py-2 rounded-xl text-sm border transition-all ${
              isAccurate === false
                ? "bg-red-500/20 border-red-500/50 text-red-400"
                : "bg-stone-100 border-stone-300 text-stone-700"
            }`}
          >
            No, Not Accurate
          </button>
        </div>

        {isAccurate === false && (
          <div className="mb-4">
            <label className="text-xs text-stone-500 block mb-1">Corrected Risk Level</label>
            <select
              value={correctedRiskLevel}
              onChange={(e) => setCorrectedRiskLevel(e.target.value)}
              className="w-full sm:w-72 bg-stone-100 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900"
            >
              {Object.keys(RISK_CONFIG).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="text-xs text-stone-500 block mb-1">Notes (optional)</label>
          <textarea
            value={feedbackNotes}
            onChange={(e) => setFeedbackNotes(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full bg-stone-100 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900"
            placeholder="e.g., Temperature warning happened after this scan"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmitFeedback}
          disabled={feedbackBusy}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-gray-950 font-bold rounded-xl text-sm transition-all"
        >
          {feedbackBusy ? "Saving feedback..." : "Submit Feedback"}
        </button>

        {feedbackStatus && (
          <p className="mt-3 text-sm text-stone-700">{feedbackStatus}</p>
        )}
      </div>

      {/* Input summary */}
      {inputs && (
        <div className="bg-transparent border border-[#44403c] rounded-2xl p-6">
          <h2 className="font-bold text-stone-900 mb-4">Sensor Readings Submitted</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SENSORS.map((s) => (
              <div key={s.key} className="bg-stone-100 rounded-lg p-2.5">
                <p className="text-xs text-stone-400 mb-0.5">{s.label}</p>
                <p className="text-sm font-bold text-stone-900">
                  {inputs[s.key]} <span className="text-xs font-normal text-stone-500">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating AI assistant */}
      <div className="fixed bottom-5 right-5 z-50">
        {assistantOpen && (
          <div className="w-[min(92vw,380px)] mb-3 bg-white border border-stone-300 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-stone-900">AI Assistant</p>
                <p className="text-xs text-stone-500">Ask about this prediction</p>
              </div>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="text-stone-500 hover:text-stone-900 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-3 max-h-72 overflow-y-auto space-y-3 bg-stone-50">
              {chatMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-amber-500/20 text-stone-900 border border-amber-500/40"
                      : "bg-white text-stone-700 border border-stone-300"
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 text-stone-500">
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-stone-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !assistantBusy) {
                      e.preventDefault();
                      handleAskAssistant();
                    }
                  }}
                  className="flex-1 bg-stone-100 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900"
                  placeholder="Why is my engine risk high?"
                />
                <button
                  type="button"
                  onClick={handleAskAssistant}
                  disabled={assistantBusy || !assistantInput.trim()}
                  className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-gray-950 font-bold rounded-lg text-xs transition-all"
                >
                  {assistantBusy ? "..." : "Send"}
                </button>
              </div>
              {assistantError && <p className="mt-2 text-xs text-red-500">{assistantError}</p>}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAssistantOpen((prev) => !prev)}
          className="w-14 h-14 rounded-full bg-cyan-500 hover:bg-cyan-400 text-gray-950 shadow-xl border border-cyan-300 flex items-center justify-center text-xl"
          aria-label="Open AI assistant"
          title="Open AI assistant"
        >
          🤖
        </button>
      </div>
    </div>
  );
}
