import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAuth } from "../hooks/useAuth";
import { fetchHistory, deletePrediction } from "../services/api";
import { RISK_CONFIG } from "../services/sensorMeta";
import RevealSection from "../components/RevealSection";

const RISK_COLORS = {
  Healthy: "#22c55e",
  Moderate: "#eab308",
  "High Risk": "#f97316",
  Critical: "#ef4444",
};

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const color = RISK_COLORS[payload.risk_level] || "#6b7280";
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#111827" strokeWidth={2} />;
};

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await fetchHistory(user.uid, 50);
      setPredictions(data.predictions || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this prediction record?")) return;
    setDeleting(id);
    try {
      await deletePrediction(id, user.uid);
      setPredictions((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  // Prepare chart data (oldest first)
  const chartData = [...predictions]
    .reverse()
    .map((p, i) => ({
      index: i + 1,
      health_score: p.health_score,
      risk_level: p.risk_level,
      date: new Date(p.createdAt).toLocaleDateString(),
    }));

  const chartSummary = chartData.length
    ? `Health score trend for ${chartData.length} scans. Latest score ${chartData[chartData.length - 1].health_score?.toFixed(1)} on ${chartData[chartData.length - 1].date}.`
    : "Health score trend chart with no data available.";

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <p className="text-stone-500 text-sm">Loading history...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-10">
      {/* Header */}
      <RevealSection className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-stone-100 tracking-tight">Prediction History</h1>
          <p className="text-stone-600 dark:text-stone-300 text-sm mt-1">{predictions.length} scans recorded</p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-amber-500 text-gray-950 font-bold rounded-xl text-sm hover:bg-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          + New Scan
        </button>
      </RevealSection>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-300 text-sm" role="alert">{error}</div>
      )}

      {predictions.length === 0 ? (
        <RevealSection className="card-surface rounded-2xl p-16 text-center" threshold={0.2}>
          <div className="text-5xl mb-4">📋</div>
          <p className="text-stone-600 dark:text-stone-300 mb-6">No predictions yet. Run your first diagnostic scan!</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-amber-500 text-gray-950 font-bold rounded-xl text-sm hover:bg-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            Start Scanning
          </button>
        </RevealSection>
      ) : (
        <>
          {/* Trend chart */}
          <RevealSection className="card-surface rounded-2xl p-4 sm:p-6 mb-6" threshold={0.2}>
            <h2 id="history-chart-title" className="font-bold text-stone-900 dark:text-stone-100 mb-1">Health Score Trend</h2>
            <p id="history-chart-desc" className="text-xs text-stone-500 dark:text-stone-400 mb-6">
              History of your engine health scores over time
            </p>
            <div
              role="img"
              aria-labelledby="history-chart-title"
              aria-describedby="history-chart-desc history-chart-summary"
            >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.35} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} tickMargin={10} minTickGap={12} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#67e8f9" }}
                />
                <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Healthy", fill: "#22c55e", fontSize: 10 }} />
                <ReferenceLine y={50} stroke="#eab308" strokeDasharray="4 4" label={{ value: "Moderate", fill: "#eab308", fontSize: 10 }} />
                <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Critical", fill: "#ef4444", fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="health_score"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
            <p id="history-chart-summary" className="sr-only">
              {chartSummary}
            </p>
          </RevealSection>

          {/* Table */}
          <RevealSection className="card-surface rounded-2xl overflow-hidden" threshold={0.2}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Prediction history with date, score, risk level, and visible sensor columns.
                </caption>
                <thead>
                  <tr className="border-b border-stone-300 dark:border-slate-700 bg-stone-100/70 dark:bg-slate-900/60">
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3">DATE</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3">SCORE</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3">RISK LEVEL</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3 hidden md:table-cell">RPM</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3 hidden md:table-cell">COOLANT</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3 hidden lg:table-cell">VOLTAGE</th>
                    <th scope="col" className="text-left text-xs font-semibold text-stone-500 dark:text-stone-400 px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => {
                    const cfg = RISK_CONFIG[p.risk_level] || RISK_CONFIG["Healthy"];
                    return (
                      <tr key={p._id} className="border-b border-stone-300/70 dark:border-slate-700/70 hover:bg-stone-100/60 dark:hover:bg-slate-800/50 transition-colors duration-200">
                        <th scope="row" className="px-3 sm:px-4 py-2.5 text-stone-600 dark:text-stone-300 text-xs leading-tight font-normal text-left">
                          {new Date(p.createdAt).toLocaleString()}
                        </th>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span className="font-bold" style={{ color: cfg.color }}>
                            {p.health_score.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold text-gray-950"
                            style={{ backgroundColor: cfg.color }}
                          >
                            {p.risk_level}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-stone-600 dark:text-stone-300 hidden md:table-cell">{p.RPM}</td>
                        <td className="px-3 sm:px-4 py-2.5 text-stone-600 dark:text-stone-300 hidden md:table-cell">{p.COOLANT_TEMP}°C</td>
                        <td className="px-3 sm:px-4 py-2.5 text-stone-600 dark:text-stone-300 hidden lg:table-cell">{p.ELM_VOLTAGE}V</td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <button
                            onClick={() => handleDelete(p._id)}
                            disabled={deleting === p._id}
                            aria-label={`Delete prediction from ${new Date(p.createdAt).toLocaleString()}`}
                            className="text-xs text-stone-500 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-300 transition-colors duration-200 disabled:opacity-50"
                          >
                            {deleting === p._id ? "..." : "✕"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </RevealSection>
        </>
      )}
    </div>
  );
}
