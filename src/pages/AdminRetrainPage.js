import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRetrainStats } from "../services/api";
import { useAuth } from "../hooks/useAuth";

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
        <div className="bg-transparent border border-[#44403c] rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-black text-stone-900 mb-2">Admin Access Required</h1>
          <p className="text-stone-500 text-sm mb-6">
            This page is only available to admin users.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-amber-500 text-gray-950 font-bold rounded-xl text-sm"
          >
            Back To Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-stone-900">Admin Retrain Monitor</h1>
          <p className="text-stone-500 text-sm mt-1">
            View scheduler health and latest model retrain outcomes.
          </p>
        </div>
        <button
          onClick={loadRetrainStats}
          disabled={statsLoading}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm border border-stone-300 hover:bg-stone-200 disabled:opacity-60"
        >
          {statsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="bg-transparent border border-[#44403c] rounded-2xl p-6">
        <p className="text-stone-500 text-sm mb-4">
          Auto-retraining runs every {retrainStats?.retrainInterval || "N/A"} new feedback entries.
        </p>

        {statsError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {statsError}
          </div>
        )}

        {statsLoading && !retrainStats ? (
          <p className="text-sm text-stone-600">Loading retrain stats...</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-stone-100 rounded-lg border border-stone-300 p-3">
              <p className="text-xs text-stone-500">Feedback Count</p>
              <p className="text-lg font-bold text-stone-900">{retrainStats?.feedbackCount ?? "-"}</p>
            </div>
            <div className="bg-stone-100 rounded-lg border border-stone-300 p-3">
              <p className="text-xs text-stone-500">Last Retrain Time</p>
              <p className="text-sm font-semibold text-stone-900">{formatDate(retrainStats?.lastRetrainAt)}</p>
            </div>
            <div className="bg-stone-100 rounded-lg border border-stone-300 p-3">
              <p className="text-xs text-stone-500">Last Retrain Status</p>
              <p className="text-sm font-semibold text-stone-900">{retrainStats?.lastRetrainStatus || "never"}</p>
            </div>
          </div>
        )}

        {!!retrainStats && (
          <div className="mt-4 bg-stone-100 rounded-lg border border-stone-300 p-3">
            <p className="text-xs text-stone-500 mb-1">Status Message</p>
            <p className="text-sm text-stone-700">{retrainStats?.lastRetrainMessage || "No retraining has run yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
