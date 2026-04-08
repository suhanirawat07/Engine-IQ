import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SENSORS, SENSOR_CATEGORIES } from "../services/sensorMeta";
import {
  apiBaseUrl,
  isHostedFrontend,
  isLocalApiTarget,
  submitPrediction,
} from "../services/api";
import axios from "axios";
import RevealSection from "../components/RevealSection";

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

  const getNetworkErrorMessage = () => {
    if (isHostedFrontend && isLocalApiTarget) {
      return "Frontend is deployed but API URL points to localhost. Set REACT_APP_API_URL in Vercel to your deployed backend URL and redeploy.";
    }

    if (isHostedFrontend) {
      return `Cannot reach backend API at ${apiBaseUrl}. Verify backend is deployed, running, and CORS allows this frontend domain.`;
    }

    return "Cannot reach backend API. Start Backend (port 5000) and ML-API (port 8000), then try again.";
  };

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
            ? getNetworkErrorMessage()
            : "") ||
          err.message ||
          "Prediction failed. Check that the backend API is reachable."
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <RevealSection className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-stone-100 mb-2 tracking-tight">Engine Diagnostic Form</h1>
        <p className="text-stone-600 dark:text-stone-300 text-base sm:text-lg leading-relaxed max-w-3xl">
          Enter all 16 OBD-II sensor readings from your vehicle diagnostic tool.
        </p>
      </RevealSection>

      <RevealSection className="card-surface rounded-xl p-4 mb-6" threshold={0.2}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-stone-600 dark:text-stone-300 font-mono tracking-wide">FIELDS COMPLETED</span>
          <span className="text-xs font-bold text-amber-500 dark:text-amber-300">{filledCount} / {SENSORS.length}</span>
        </div>
        <div className="h-2 bg-stone-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </RevealSection>

      <RevealSection className="flex flex-wrap gap-2 mb-6" threshold={0.2}>
        {["All", ...SENSOR_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
              activeCategory === cat
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                : "bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-600 hover:border-stone-500 dark:hover:border-slate-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </RevealSection>

      {apiError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-300 text-sm" role="alert">
          <span className="font-semibold">Error: </span>{apiError}
        </div>
      )}

      <RevealSection threshold={0.2}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8">
          {filteredSensors.map((sensor) => (
            <div key={sensor.key} className="relative">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={sensor.key}
                  className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5"
                >
                  <span>{sensor.icon}</span>
                  {sensor.label}
                </label>
                <button
                  type="button"
                  onMouseEnter={() => setTooltip(sensor.key)}
                  onMouseLeave={() => setTooltip(null)}
                  className="w-5 h-5 rounded-full bg-stone-200 dark:bg-slate-700 hover:bg-amber-500/30 text-stone-600 dark:text-stone-300 hover:text-amber-500 dark:hover:text-amber-300 text-[10px] flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                  aria-label={`Show help for ${sensor.label}`}
                >
                  ?
                </button>
                {tooltip === sensor.key && (
                  <div className="absolute right-0 top-7 z-50 w-64 bg-stone-100 dark:bg-slate-800 border border-stone-300 dark:border-slate-600 rounded-xl p-3 shadow-xl text-xs text-stone-700 dark:text-stone-200 leading-relaxed">
                    <p className="font-semibold text-amber-600 dark:text-amber-300 mb-1">{sensor.label}</p>
                    {sensor.tooltip}
                    <p className="mt-2 text-stone-500 dark:text-stone-400">Range: {sensor.min} – {sensor.max} {sensor.unit}</p>
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
                  aria-invalid={Boolean(errors[sensor.key])}
                  aria-describedby={`${sensor.key}-help ${errors[sensor.key] ? `${sensor.key}-error` : ""}`.trim()}
                  className={`w-full bg-stone-100 dark:bg-slate-800 border ${
                    errors[sensor.key]
                      ? "border-red-500/80"
                      : "border-stone-300 dark:border-slate-600 focus:border-cyan-500"
                  } rounded-lg px-3 py-3 text-base text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 ${
                    errors[sensor.key] ? "focus:ring-red-500/30" : "focus:ring-cyan-500/30"
                  } transition-all duration-200 ease-in-out pr-16`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 dark:text-stone-400 font-mono pointer-events-none">
                  {sensor.unit}
                </span>
              </div>
              <p id={`${sensor.key}-help`} className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Expected range: {sensor.min} to {sensor.max} {sensor.unit}
              </p>
              {errors[sensor.key] && (
                <p id={`${sensor.key}-error`} className="mt-1 text-xs text-red-500 dark:text-red-300">{errors[sensor.key]}</p>
              )}
            </div>
          ))}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-700 dark:text-yellow-300 text-sm" role="alert">
            ⚠️ {Object.keys(errors).length} field(s) need attention.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-4 bg-amber-500 hover:bg-cyan-400 disabled:bg-amber-500/50 text-gray-950 font-bold rounded-xl transition-all duration-200 ease-in-out shadow-lg shadow-amber-500/20 text-sm disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            aria-busy={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Waking up server, please wait...
              </>
            ) : (
              "🔬 Run ML Prediction"
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-4 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 font-semibold rounded-xl transition-all duration-200 ease-in-out text-sm border border-stone-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            Reset Defaults
          </button>
        </div>
      </form>
      </RevealSection>
    </div>
  );
}