import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SENSORS, SENSOR_CATEGORIES } from "../services/sensorMeta";
import { apiBaseUrl, submitPrediction } from "../services/api";
import { useEffect } from "react";
import axios from "axios";

const getDefaults = () => {
  const obj = {};
  SENSORS.forEach((s) => {
    obj[s.key] = s.default;
  });
  return obj;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState(getDefaults());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [apiError, setApiError] = useState("");
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
  // Ping both services on page load to wake them up
  axios.get(`${apiBaseUrl}/health`, { timeout: 120000 })
    .catch(() => {});
}, []);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleReset = () => {
    setValues(getDefaults());
    setErrors({});
    setApiError("");
  };

  const validate = () => {
    const newErrors = {};
    for (const s of SENSORS) {
      const v = parseFloat(values[s.key]);
      if (values[s.key] === "" || values[s.key] === null || values[s.key] === undefined || isNaN(v)) {
        newErrors[s.key] = "Required";
      } else if (v < s.min || v > s.max) {
        newErrors[s.key] = `Must be ${s.min}–${s.max} ${s.unit}`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError("");
    try {
      const payload = {
        userId: user?.uid,
        ...Object.fromEntries(
          SENSORS.map((s) => [s.key, parseFloat(values[s.key])])
        ),
      };
      const { data } = await submitPrediction(payload);
      navigate("/result", {
        state: { prediction: data.prediction, inputs: payload },
      });
    } catch (err) {
      setApiError(
        err.response?.data?.error ||
          (err.code === "ERR_NETWORK"
            ? "Cannot reach backend API. Start Backend (port 5000) and ML-API (port 8000), then try again."
            : "") ||
          err.message ||
          "Prediction failed. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredSensors =
    activeCategory === "All"
      ? SENSORS
      : SENSORS.filter((s) => s.category === activeCategory);

  const filledCount = SENSORS.filter(
    (s) =>
      values[s.key] !== "" &&
      values[s.key] !== null &&
      values[s.key] !== undefined &&
      !isNaN(parseFloat(values[s.key]))
  ).length;

  const progress = Math.round((filledCount / SENSORS.length) * 100);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-stone-900 mb-2">Engine Diagnostic Form</h1>
        <p className="text-stone-500 text-sm">
          Enter all 16 OBD-II sensor readings from your vehicle diagnostic tool.
        </p>
      </div>

      <div className="bg-transparent border border-[#44403c] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-stone-500 font-mono">FIELDS COMPLETED</span>
          <span className="text-xs font-bold text-amber-400">{filledCount} / {SENSORS.length}</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["All", ...SENSOR_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === cat
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-stone-100 text-stone-500 border border-stone-300 hover:border-gray-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {apiError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span className="font-semibold">Error: </span>{apiError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredSensors.map((sensor) => (
            <div key={sensor.key} className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={sensor.key}
                  className="text-xs font-semibold text-stone-700 flex items-center gap-1.5"
                >
                  <span>{sensor.icon}</span>
                  {sensor.label}
                </label>
                <button
                  type="button"
                  onMouseEnter={() => setTooltip(sensor.key)}
                  onMouseLeave={() => setTooltip(null)}
                  className="w-4 h-4 rounded-full bg-stone-200 hover:bg-amber-500/30 text-stone-500 hover:text-amber-400 text-[10px] flex items-center justify-center transition-colors flex-shrink-0"
                >
                  ?
                </button>
                {tooltip === sensor.key && (
                  <div className="absolute right-0 top-6 z-50 w-64 bg-stone-100 border border-stone-300 rounded-xl p-3 shadow-xl text-xs text-stone-700 leading-relaxed">
                    <p className="font-semibold text-amber-400 mb-1">{sensor.label}</p>
                    {sensor.tooltip}
                    <p className="mt-2 text-stone-400">Range: {sensor.min} – {sensor.max} {sensor.unit}</p>
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  id={sensor.key}
                  type="number"
                  min={sensor.min}
                  max={sensor.max}
                  step={sensor.step}
                  value={values[sensor.key]}
                  onChange={(e) => handleChange(sensor.key, e.target.value)}
                  className={`w-full bg-stone-100 border ${
                    errors[sensor.key]
                      ? "border-red-500/70"
                      : "border-stone-300 focus:border-amber-500/70"
                  } rounded-lg px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-1 ${
                    errors[sensor.key] ? "focus:ring-red-500/30" : "focus:ring-amber-500/30"
                  } transition-all pr-16`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-mono pointer-events-none">
                  {sensor.unit}
                </span>
              </div>
              {errors[sensor.key] && (
                <p className="mt-1 text-xs text-red-400">{errors[sensor.key]}</p>
              )}
            </div>
          ))}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
            ⚠️ {Object.keys(errors).length} field(s) need attention.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-4 bg-amber-500 hover:bg-cyan-400 disabled:bg-amber-500/50 text-gray-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 text-sm disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                Waking up server, please wait...
              </>
            ) : (
              "🔬 Run ML Prediction"
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-all text-sm border border-stone-300"
          >
            Reset Defaults
          </button>
        </div>
      </form>
    </div>
  );
}