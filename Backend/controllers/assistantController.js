const axios = require("axios");

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_HF_MODEL = process.env.HF_MODEL || "Qwen/Qwen2.5-7B-Instruct";
const FALLBACK_HF_MODELS = [
  "Qwen/Qwen2.5-7B-Instruct",
  "meta-llama/Llama-3.1-8B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "google/gemma-2-2b-it",
];

const SENSOR_GLOSSARY = [
  {
    key: "THROTTLE_POS",
    label: "Throttle Position",
    unit: "%",
    aliases: ["throttle", "throttle pos", "throttle position", "accelerator opening"],
    meaning: "Shows how open the throttle plate is. Higher values usually mean stronger acceleration demand.",
  },
  {
    key: "RPM",
    label: "Engine RPM",
    unit: "rpm",
    aliases: ["rpm", "engine speed", "revolutions"],
    meaning: "Engine speed in revolutions per minute. Higher RPM can increase heat and fuel demand.",
  },
  {
    key: "ENGINE_LOAD",
    label: "Engine Load",
    unit: "%",
    aliases: ["load", "engine load"],
    meaning: "Estimated engine workload. Persistently high load can raise wear and thermal stress.",
  },
  {
    key: "COOLANT_TEMP",
    label: "Coolant Temperature",
    unit: "C",
    aliases: ["coolant", "coolant temp", "temperature", "engine temperature"],
    meaning: "Tracks engine cooling status. Elevated values can indicate overheating risk.",
  },
  {
    key: "MAF",
    label: "Mass Air Flow",
    unit: "g/s",
    aliases: ["maf", "mass air flow", "air flow"],
    meaning: "Measures intake air amount. Abnormal MAF can affect mixture control and drivability.",
  },
  {
    key: "SHORT_FUEL_TRIM_1",
    label: "Short Fuel Trim",
    unit: "%",
    aliases: ["fuel trim", "short fuel trim", "stft"],
    meaning: "Immediate fuel correction by ECU. Large positive values suggest lean compensation.",
  },
  {
    key: "ELM_VOLTAGE",
    label: "System Voltage",
    unit: "V",
    aliases: ["voltage", "battery", "elm voltage"],
    meaning: "Electrical system voltage. Low or unstable voltage can affect sensor reliability.",
  },
];

const summarizePrediction = (payload = {}) => {
  const prediction = payload.prediction || {};
  const inputs = payload.inputs && typeof payload.inputs === "object" ? payload.inputs : {};
  const shap = prediction.shap_explanation || {};
  const topPositive = Array.isArray(shap.top_positive) ? shap.top_positive.slice(0, 3) : [];
  const topNegative = Array.isArray(shap.top_negative) ? shap.top_negative.slice(0, 3) : [];

  return {
    risk_level: prediction.risk_level,
    health_score: prediction.health_score,
    risk_description: prediction.risk_description,
    recommendations: Array.isArray(prediction.recommendations) ? prediction.recommendations.slice(0, 5) : [],
    shap_method: shap.method || null,
    top_positive: topPositive.map((item) => ({
      feature: item.feature,
      impact: item.impact,
      value: item.value,
    })),
    top_negative: topNegative.map((item) => ({
      feature: item.feature,
      impact: item.impact,
      value: item.value,
    })),
    inputs,
  };
};

const findSensorByQuestion = (question) => {
  const q = String(question || "").toLowerCase();
  return SENSOR_GLOSSARY.find((sensor) =>
    sensor.aliases.some((alias) => q.includes(alias))
  );
};

const isGreeting = (question) => /^(hi|hello|hey|yo|good\s(morning|afternoon|evening))\b/i.test(String(question || "").trim());

const asksAboutHeuristic = (question) =>
  /(heuristic\s*attribution|what\s+is\s+heuristic|why\s+heuristic|fallback\s*attribution)/i.test(
    String(question || "")
  );

const findImpactForFeature = (summary, featureKey) => {
  const positive = Array.isArray(summary.top_positive)
    ? summary.top_positive.find((item) => item.feature === featureKey)
    : null;
  if (positive) return { direction: "increasing", impact: positive.impact };

  const negative = Array.isArray(summary.top_negative)
    ? summary.top_negative.find((item) => item.feature === featureKey)
    : null;
  if (negative) return { direction: "decreasing", impact: negative.impact };

  return null;
};

const buildFallbackAnswer = ({ question, summary }) => {
  const risk = summary.risk_level || "Unknown";
  const score = Number.isFinite(Number(summary.health_score))
    ? Number(summary.health_score).toFixed(1)
    : "N/A";
  const reasons = summary.top_positive
    .map((item) => `${item.feature} (impact ${Number(item.impact || 0).toFixed(3)})`)
    .join(", ");

  if (isGreeting(question)) {
    return [
      `Hi. Current status is ${risk} with health score ${score}.`,
      "I can explain specific sensors, SHAP drivers, and actions for this exact report.",
      "Try: what is RPM here, why is risk high, or what does heuristic attribution mean?",
    ].join(" ");
  }

  if (asksAboutHeuristic(question)) {
    const method = summary.shap_method || "Heuristic Attribution (Fallback)";
    return [
      `${method} means we estimate feature influence from your current sensor deviations when full SHAP output is limited or unavailable.`,
      "It is an approximation for interpretability, not the model's exact internal decomposition.",
      reasons ? `In this report, strongest estimated risk drivers are: ${reasons}.` : "No dominant estimated risk drivers were detected in this report.",
    ].join(" ");
  }

  const sensor = findSensorByQuestion(question);
  if (sensor) {
    const rawValue = summary.inputs?.[sensor.key];
    const hasValue = Number.isFinite(Number(rawValue));
    const currentValue = hasValue ? Number(rawValue) : null;
    const impact = findImpactForFeature(summary, sensor.key);

    const valueText = hasValue
      ? `Current value in this report is ${currentValue}${sensor.unit ? ` ${sensor.unit}` : ""}.`
      : "I do not have a concrete value for this sensor in the current context.";
    const impactText = impact
      ? `For this prediction, it is ${impact.direction} risk with SHAP impact ${Number(impact.impact || 0).toFixed(3)}.`
      : "It is not one of the strongest SHAP drivers in this prediction.";

    return `${sensor.label}: ${sensor.meaning} ${valueText} ${impactText}`;
  }

  if (/why|reason|high/i.test(question)) {
    return [
      `Your current risk is ${risk} with a health score of ${score}.`,
      reasons
        ? `Main risk drivers from explainability are: ${reasons}.`
        : "The current prediction indicates elevated risk, but no strong SHAP drivers were available.",
      summary.recommendations?.length
        ? `Priority actions: ${summary.recommendations.join(" ")}`
        : "Collect one more scan and monitor temperature, load, and fuel trims for trend changes.",
    ].join(" ");
  }

  return [
    `Engine status summary: risk ${risk}, health score ${score}.`,
    summary.risk_description || "No additional description was provided by the model.",
    reasons ? `Strongest current risk drivers are ${reasons}.` : "No dominant SHAP risk drivers were available.",
    "You can ask about specific sensors like throttle, RPM, coolant temperature, fuel trim, or MAF.",
  ].join(" ");
};

const callOpenAI = async ({ question, summary }) => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const systemPrompt = [
    "You are an automotive diagnostic assistant.",
    "Use only the provided prediction context.",
    "Do not claim certainty; suggest verification steps.",
    "Keep response under 170 words and include concise actionable advice.",
  ].join(" ");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 350,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Prediction context: ${JSON.stringify(summary)}\n\nUser question: ${question}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  return response?.data?.choices?.[0]?.message?.content?.trim() || null;
};

const callHuggingFace = async ({ question, summary }) => {
  if (!process.env.HF_API_KEY) {
    return null;
  }

  const systemPrompt = [
    "You are an automotive diagnostic assistant.",
    "Use only provided prediction context.",
    "If uncertain, state uncertainty clearly.",
    "Be concise and practical.",
  ].join(" ");

  const configuredCandidates = (process.env.HF_MODEL_CANDIDATES || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const modelCandidates = Array.from(
    new Set([DEFAULT_HF_MODEL, ...configuredCandidates, ...FALLBACK_HF_MODELS])
  );

  let lastError = null;
  for (const model of modelCandidates) {
    try {
      const routerRes = await axios.post(
        "https://router.huggingface.co/v1/chat/completions",
        {
          model,
          temperature: 0.3,
          max_tokens: 260,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Prediction context: ${JSON.stringify(summary)}\n\nUser question: ${question}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      const content = routerRes?.data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
    } catch (routerErr) {
      lastError = routerErr;
      console.warn(
        `HF router call failed for model ${model}:`,
        routerErr?.response?.status || routerErr.message
      );
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
};

exports.chatWithAssistant = async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();
    const prediction = req.body?.prediction;
    const inputs = req.body?.inputs;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }
    if (!prediction || typeof prediction !== "object") {
      return res.status(400).json({ error: "prediction context is required" });
    }

    const limitedQuestion = question.slice(0, 500);
    const summary = summarizePrediction({ prediction, inputs });
    const provider = (process.env.AI_PROVIDER || "openai").trim().toLowerCase();

    let answer = null;
    let usedProvider = "fallback";

    try {
      if (provider === "huggingface") {
        if (!process.env.HF_API_KEY) {
          return res.status(400).json({
            error: "HuggingFace is selected but HF_API_KEY is missing in backend environment.",
          });
        }
        answer = await callHuggingFace({ question: limitedQuestion, summary });
        usedProvider = answer ? "huggingface" : usedProvider;
      } else if (provider === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          return res.status(400).json({
            error: "OpenAI is selected but OPENAI_API_KEY is missing in backend environment.",
          });
        }
        answer = await callOpenAI({ question: limitedQuestion, summary });
        usedProvider = answer ? "openai" : usedProvider;
      } else {
        answer = await callOpenAI({ question: limitedQuestion, summary });
        usedProvider = answer ? "openai" : usedProvider;
        if (!answer) {
          answer = await callHuggingFace({ question: limitedQuestion, summary });
          if (answer) usedProvider = "huggingface";
        }
      }
    } catch (providerErr) {
      console.warn("AI provider call failed:", providerErr.message);
    }

    if (!answer) {
      answer = buildFallbackAnswer({ question: limitedQuestion, summary });
      usedProvider = "fallback";
    }

    return res.json({ success: true, answer, provider: usedProvider });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
