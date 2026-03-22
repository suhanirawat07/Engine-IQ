import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api`,
  timeout: 120000,
});

export const submitPrediction = (payload) => api.post("/predict", payload);
export const fetchHistory = (userId, limit = 20, skip = 0) =>
  api.get(`/predict/history/${userId}?limit=${limit}&skip=${skip}`);
export const deletePrediction = (id, userId) =>
  api.delete(`/predict/${id}`, { data: { userId } });

export default api;
