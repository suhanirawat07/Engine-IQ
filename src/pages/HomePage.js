import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { RISK_CONFIG } from "../services/sensorMeta";
import RevealSection from "../components/RevealSection";

const features = [
  { icon: "🔬", title: "16-Sensor Analysis", desc: "Real OBD-II parameters for accurate engine diagnostics" },
  { icon: "🤖", title: "ML-Powered Prediction", desc: "Random Forest model trained on real vehicle telemetry data" },
  { icon: "📊", title: "Health Dashboard", desc: "Visual score gauge and trend charts for your vehicle history" },
  { icon: "📖", title: "User Manual", desc: "Learn what each sensor means and how to keep your engine healthy" },
];

const riskLevels = Object.entries(RISK_CONFIG).map(([level, cfg]) => ({
  level, ...cfg,
}));

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStart = () => navigate(user ? "/dashboard" : "/login");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* ── Hero ── */}
      <RevealSection className="text-center mb-16 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-300 text-xs font-mono mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          ML-POWERED · REAL-TIME · OBD-II
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-stone-900 dark:text-stone-100 mb-6 leading-tight tracking-tight">
          Engine Health<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Intelligence
          </span>
        </h1>

        <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Input 16 OBD-II sensor readings from your vehicle and our machine learning engine will 
          compute a real-time health score, risk level, and personalised maintenance recommendations.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-amber-500 hover:bg-cyan-400 text-gray-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/30 hover:shadow-cyan-400/40 hover:scale-[1.02] text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          >
            Start Diagnostics →
          </button>
          <button
            onClick={() => navigate("/manual")}
            className="px-8 py-4 bg-transparent border border-stone-300 dark:border-slate-600 hover:border-stone-500 dark:hover:border-slate-400 text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-stone-100 font-semibold rounded-xl transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            Read User Manual
          </button>
        </div>
      </RevealSection>

      {/* ── Risk level legend ── */}
      <RevealSection className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 sm:mb-20" threshold={0.2}>
        {riskLevels.map(({ level, color, range }) => (
          <div
            key={level}
            className="card-surface rounded-xl p-4 text-center hover:border-cyan-500/50 transition-colors duration-200"
          >
            <div
              className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
            >
              <span style={{ color }}>{level === "Healthy" ? "✓" : level === "Critical" ? "!" : "~"}</span>
            </div>
            <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{level}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Score {range}</p>
          </div>
        ))}
      </RevealSection>

      {/* ── Features ── */}
      <RevealSection className="mb-16 sm:mb-20" threshold={0.2}>
        <h2 className="text-2xl font-bold text-center text-stone-900 dark:text-stone-100 mb-10">
          Everything you need for engine intelligence
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="card-surface rounded-2xl p-6 hover:border-amber-500/40 transition-all duration-200 group"
            >
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-2 group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors duration-200">{title}</h3>
              <p className="text-stone-600 dark:text-stone-300 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── CTA ── */}
      <RevealSection className="bg-gradient-to-r from-amber-500/10 to-blue-600/10 border border-amber-500/20 rounded-2xl p-7 sm:p-10 text-center" threshold={0.2}>
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 mb-4">Ready to scan your engine?</h2>
        <p className="text-stone-600 dark:text-stone-300 mb-8 text-sm sm:text-base">Connect your OBD-II scanner, read the values, and get your report in seconds.</p>
        <button
          onClick={handleStart}
          className="px-10 py-4 bg-amber-500 hover:bg-cyan-400 text-gray-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        >
          {user ? "Go to Dashboard" : "Sign In & Start"}
        </button>
      </RevealSection>
    </div>
  );
}
