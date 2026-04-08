import React, { useState } from "react";
import { SENSORS, SENSOR_CATEGORIES } from "../services/sensorMeta";
import RevealSection from "../components/RevealSection";

const maintenanceTips = [
  {
    icon: "🛢️",
    title: "Engine Oil",
    tips: [
      "Change engine oil every 5,000–10,000 km or as specified in your vehicle manual.",
      "Check oil level monthly using the dipstick — top up if below the minimum mark.",
      "Use the manufacturer-recommended oil grade (e.g., 5W-30).",
      "A dark, gritty oil appearance indicates it's overdue for a change.",
    ],
  },
  {
    icon: "🌡️",
    title: "Cooling System",
    tips: [
      "Check coolant level in the overflow reservoir every month.",
      "Flush and replace coolant every 2 years or 40,000 km.",
      "Inspect radiator hoses for cracks, leaks, or swelling.",
      "Never open the radiator cap when the engine is hot — risk of severe burns.",
      "A continuously high COOLANT_TEMP reading indicates a cooling system fault.",
    ],
  },
  {
    icon: "⛽",
    title: "Fuel System",
    tips: [
      "Avoid running the fuel tank below 10% — it stresses the fuel pump.",
      "Use the correct octane rating fuel for your engine.",
      "Replace the fuel filter every 30,000–50,000 km.",
      "Persistent LONG_FUEL_TRIM or SHORT_FUEL_TRIM deviations above ±10% may indicate dirty fuel injectors.",
      "Consider a fuel system cleaner additive every 15,000 km.",
    ],
  },
  {
    icon: "🎛️",
    title: "Throttle System",
    tips: [
      "Clean the throttle body every 30,000 km to prevent carbon build-up.",
      "A sticky throttle or erratic THROTTLE_POS readings can indicate a dirty throttle body.",
      "Check the accelerator pedal for smooth, consistent movement.",
      "Have the throttle position sensor inspected if idle surges are frequent.",
    ],
  },
  {
    icon: "💨",
    title: "Air Intake",
    tips: [
      "Replace the engine air filter every 15,000–30,000 km or yearly.",
      "A clogged air filter reduces MAF readings and increases fuel consumption.",
      "Check intake hoses and connections for cracks that cause vacuum leaks.",
      "Clean the MAF sensor with dedicated MAF cleaner spray — never touch the wire.",
    ],
  },
  {
    icon: "🔋",
    title: "Electrical System",
    tips: [
      "ELM_VOLTAGE should read 13.5–14.7 V when the engine is running (alternator charging).",
      "Below 12.5 V at idle may indicate a failing alternator or old battery.",
      "Test the battery every 2 years; replace every 3–5 years.",
      "Keep battery terminals clean — remove corrosion with baking soda and water.",
    ],
  },
];

const howToMeasure = [
  {
    tool: "OBD-II Scanner / ELM327 Adapter",
    icon: "🔌",
    description:
      "The most reliable method. Plug a Bluetooth or USB ELM327 adapter into the OBD-II port (usually under the dashboard on the driver's side). Pair it with an app like Torque Pro, OBD Fusion, or Car Scanner ELM OBD2.",
    steps: [
      "Locate the OBD-II port (16-pin trapezoid connector) under the dashboard.",
      "Plug in the ELM327 Bluetooth or Wi-Fi adapter.",
      "Turn ignition to ON or start the engine.",
      "Open the companion app on your smartphone.",
      "Navigate to Real-Time / Live Data to read all 16 parameters.",
    ],
  },
  {
    tool: "Recommended Apps",
    icon: "📱",
    description: "These free and paid apps display OBD-II PIDs in real time:",
    steps: [
      "Torque Pro (Android) — Full PID support, customisable dashboards.",
      "OBD Fusion (iOS & Android) — Clean interface, advanced logging.",
      "Car Scanner ELM OBD2 (iOS & Android) — Free, feature-rich.",
      "DashCommand — Professional-grade with data logging.",
      "FORScan (Ford vehicles) — Deep manufacturer-specific data.",
    ],
  },
  {
    tool: "Professional Diagnostic Tool",
    icon: "🔧",
    description:
      "Automotive technicians use professional scan tools (Snap-on, Autel, Launch) that access all manufacturer-specific PIDs. Visit your dealer or mechanic and ask for a 'live data printout' or 'OBD-II log file'.",
    steps: [
      "Ask your mechanic for a full live-data export during a running test.",
      "Ensure they capture data at idle and at mid-load (steady 60 km/h).",
      "Request values for all 16 parameters listed in this system.",
      "Some workshops provide digital reports — use those values directly.",
    ],
  },
];

export default function ManualPage() {
  const [activeSection, setActiveSection] = useState("sensors");
  const [expandedSensor, setExpandedSensor] = useState(null);
  const [filterCat, setFilterCat] = useState("All");

  const filteredSensors = filterCat === "All" ? SENSORS : SENSORS.filter((s) => s.category === filterCat);

  const sections = [
    { id: "sensors", label: "📡 Sensor Guide" },
    { id: "howto", label: "🔌 How to Measure" },
    { id: "tips", label: "🔧 Maintenance Tips" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-10">
      {/* Header */}
      <RevealSection className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-500 dark:text-blue-300 text-xs font-mono mb-4">
          📖 USER MANUAL
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-stone-100 mb-3 tracking-tight">Understanding Your Engine Data</h1>
        <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-base sm:text-lg">
          This manual explains all 16 OBD-II sensor parameters used by the EngineScan prediction system,
          how to measure them, and how to keep your engine in peak condition.
        </p>
      </RevealSection>

      {/* Section tabs */}
      <RevealSection className="flex gap-2 mb-8 flex-wrap" threshold={0.2}>
        {sections.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
              activeSection === id
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                : "bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-slate-600 hover:border-stone-500 dark:hover:border-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </RevealSection>

      {/* ── Sensor Guide ── */}
      {activeSection === "sensors" && (
        <RevealSection>
          <p className="text-stone-600 dark:text-stone-300 text-sm mb-6">
            Click on any sensor to expand its full description, typical value ranges, and what abnormal readings mean.
          </p>
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {["All", ...SENSOR_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                  filterCat === cat
                    ? "bg-blue-500/20 text-blue-500 dark:text-blue-300 border border-blue-500/40"
                    : "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredSensors.map((s) => (
              <div
                key={s.key}
                className="card-surface rounded-xl overflow-hidden hover:border-cyan-500/40 transition-colors duration-200"
              >
                <button
                  className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  onClick={() => setExpandedSensor(expandedSensor === s.key ? null : s.key)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{s.icon}</span>
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{s.label}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">{s.key} · {s.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 dark:text-stone-400 hidden sm:block px-2 py-0.5 bg-stone-100 dark:bg-slate-800 rounded-full">
                      {s.category}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400 text-xs">{expandedSensor === s.key ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expandedSensor === s.key && (
                  <div className="px-5 pb-5 border-t border-stone-300 dark:border-slate-700">
                    <p className="text-stone-700 dark:text-stone-200 text-sm mt-4 leading-relaxed mb-4">{s.tooltip}</p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-stone-100 dark:bg-slate-800 rounded-lg p-3 text-center border border-stone-300 dark:border-slate-600">
                        <p className="text-stone-500 dark:text-stone-400 mb-1">Minimum</p>
                        <p className="font-bold text-stone-900 dark:text-stone-100">{s.min} {s.unit}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <p className="text-stone-500 dark:text-stone-300 mb-1">Typical</p>
                        <p className="font-bold text-amber-600 dark:text-amber-300">{s.default} {s.unit}</p>
                      </div>
                      <div className="bg-stone-100 dark:bg-slate-800 rounded-lg p-3 text-center border border-stone-300 dark:border-slate-600">
                        <p className="text-stone-500 dark:text-stone-400 mb-1">Maximum</p>
                        <p className="font-bold text-stone-900 dark:text-stone-100">{s.max} {s.unit}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {/* ── How to Measure ── */}
      {activeSection === "howto" && (
        <RevealSection className="space-y-6">
          {howToMeasure.map(({ tool, icon, description, steps }) => (
            <div key={tool} className="card-surface rounded-2xl p-5 sm:p-6">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">{icon}</span>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg">{tool}</h3>
                  <p className="text-stone-600 dark:text-stone-300 text-sm mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
              <ol className="space-y-2 ml-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-200">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </RevealSection>
      )}

      {/* ── Maintenance Tips ── */}
      {activeSection === "tips" && (
        <RevealSection className="space-y-6">
          {maintenanceTips.map(({ icon, title, tips }) => (
            <div key={title} className="card-surface rounded-2xl p-5 sm:p-6">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg mb-4 flex items-center gap-2">
                <span>{icon}</span> {title}
              </h3>
              <ul className="space-y-2">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-200">
                    <span className="text-emerald-500 dark:text-emerald-300 mt-0.5 flex-shrink-0">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </RevealSection>
      )}
    </div>
  );
}
