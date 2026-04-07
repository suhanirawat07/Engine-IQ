require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const predictRoutes = require("./routes/predict");
const userRoutes = require("./routes/user");
const assistantRoutes = require("./routes/assistant");

const app = express();
app.set("trust proxy", 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://engine-iq.vercel.app",
  "https://engine-iq-one.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...envOrigins,
]);

const vercelDomainPattern = /^https:\/\/[\w-]+\.vercel\.app$/i;
const renderDomainPattern = /^https:\/\/[\w-]+\.onrender\.com$/i;

const normalizeOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const defaultPort =
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80");
    const portSegment = parsed.port && !defaultPort ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${portSegment}`;
  } catch {
    return origin.replace(/\/$/, "");
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = normalizeOrigin(origin);
      const isAllowed =
        allowedOrigins.has(cleanOrigin) ||
        vercelDomainPattern.test(cleanOrigin) ||
        renderDomainPattern.test(cleanOrigin);

      if (!isAllowed) {
        console.warn("Blocked CORS origin:", cleanOrigin);
      }

      return callback(null, isAllowed);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

const isDbConnected = () => mongoose.connection.readyState === 1;

app.use("/api", (req, res, next) => {
  if (req.path === "/" || req.path === "/health") {
    return next();
  }

  if (!isDbConnected()) {
    return res.status(503).json({
      error: "Database unavailable. Please retry shortly.",
      dbState: mongoose.connection.readyState,
    });
  }

  return next();
});

// ─── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/predict", predictRoutes);
app.use("/api/users", userRoutes);
app.use("/api/assistant", assistantRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbConnected: isDbConnected(),
    dbState: mongoose.connection.readyState,
  });
});

app.get("/api", (req, res) => {
  res.json({ status: "ok", service: "backend-api" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});