import axios from "axios";

const rawApiUrl = (process.env.REACT_APP_API_URL || "http://localhost:5000").trim();
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
export const apiBaseUrl = `${normalizedApiUrl}/api`;

const localHosts = new Set(["localhost", "127.0.0.1"]);
const browserHost = typeof window !== "undefined" ? window.location.hostname : "";
export const isHostedFrontend = Boolean(browserHost && !localHosts.has(browserHost));
export const isLocalApiTarget = /localhost|127\.0\.0\.1/i.test(normalizedApiUrl);

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000,
});

export const submitPrediction = (payload) => api.post("/predict", payload);
export const fetchHistory = (userId, limit = 20, skip = 0) =>
  api.get(`/predict/history/${userId}?limit=${limit}&skip=${skip}`);
export const deletePrediction = (id, userId) =>
  api.delete(`/predict/${id}`, { data: { userId } });
export const submitPredictionFeedback = (id, payload) =>
  api.patch(`/predict/${id}/feedback`, payload);
export const triggerRetrainFromFeedback = (payload = {}) =>
  api.post("/predict/retrain", payload);
export const fetchRetrainStats = () => api.get("/predict/retrain/stats");
export const askAssistant = (payload) => api.post("/assistant/chat", payload);

export default api;
