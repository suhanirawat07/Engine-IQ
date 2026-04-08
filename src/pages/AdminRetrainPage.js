import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRetrainStats } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import RevealSection from "../components/RevealSection";

export default function AdminRetrainPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [retrainStats, setRetrainStats] = useState(null);

  const isAdminUser = user?.role === "admin";

  const loadRetrainStats = async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetchRetrainStats();
      setRetrainStats(res.data?.stats || null);
    } catch (err) {
      setStatsError(err?.response?.data?.error || "Failed to load retrain stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUser) {
      loadRetrainStats();
    }
  }, [isAdminUser]);

  const formatDate = (value) => {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString();
  };

  if (!isAdminUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <RevealSection className="card-surface rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 mb-2">Admin Access Required</h1>
          <p className="text-stone-600 dark:text-stone-300 text-sm mb-6">
            This page is only available to admin users.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-amber-500 text-gray-950 font-bold rounded-xl text-sm hover:bg-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            Back To Dashboard
          </button>
        </RevealSection>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <RevealSection className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-stone-100 tracking-tight">Admin Retrain Monitor</h1>
          <p className="text-stone-600 dark:text-stone-300 text-sm mt-1">
            View scheduler health and latest model retrain outcomes.
          </p>
        </div>
        <button
          onClick={loadRetrainStats}
          disabled={statsLoading}
          className="px-4 py-2 bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-200 rounded-xl text-sm border border-stone-300 dark:border-slate-600 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {statsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </RevealSection>

      <RevealSection className="card-surface rounded-2xl p-6" threshold={0.2}>
        <p className="text-stone-600 dark:text-stone-300 text-sm mb-4">
          Auto-retraining runs every {retrainStats?.retrainInterval || "N/A"} new feedback entries.
        </p>

        {statsError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 dark:text-red-300 text-sm" role="alert">
            {statsError}
          </div>
        )}

        {statsLoading && !retrainStats ? (
          <p className="text-sm text-stone-600 dark:text-stone-300" role="status" aria-live="polite">
            Loading retrain stats...
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-stone-100 dark:bg-slate-800 rounded-lg border border-stone-300 dark:border-slate-600 p-3">
              <p className="text-xs text-stone-500 dark:text-stone-400">Feedback Count</p>
              <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{retrainStats?.feedbackCount ?? "-"}</p>
            </div>
            <div className="bg-stone-100 dark:bg-slate-800 rounded-lg border border-stone-300 dark:border-slate-600 p-3">
              <p className="text-xs text-stone-500 dark:text-stone-400">Last Retrain Time</p>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{formatDate(retrainStats?.lastRetrainAt)}</p>
            </div>
            <div className="bg-stone-100 dark:bg-slate-800 rounded-lg border border-stone-300 dark:border-slate-600 p-3">
              <p className="text-xs text-stone-500 dark:text-stone-400">Last Retrain Status</p>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{retrainStats?.lastRetrainStatus || "never"}</p>
            </div>
          </div>
        )}

        {!!retrainStats && (
          <div className="mt-4 bg-stone-100 dark:bg-slate-800 rounded-lg border border-stone-300 dark:border-slate-600 p-3">
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Status Message</p>
            <p className="text-sm text-stone-700 dark:text-stone-200">{retrainStats?.lastRetrainMessage || "No retraining has run yet."}</p>
          </div>
        )}
      </RevealSection>
    </div>
  );
}
