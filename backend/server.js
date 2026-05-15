import dotenv from "dotenv";
dotenv.config(); // MUST be first

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
<<<<<<< HEAD
import config from "./config.js";
=======
>>>>>>> origin/devashish

import indexRouter from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
<<<<<<< HEAD
const allowedOrigins = (config.clientOrigin || "*")
=======
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "*")
>>>>>>> origin/devashish
  .split(",")
  .map((origin) => origin.trim());

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin(origin, callback) {
      const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
<<<<<<< HEAD
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin) || localDevOrigin) {
=======
      const localFileOrigin = process.env.NODE_ENV !== "production" && origin === "null";
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin) || localDevOrigin || localFileOrigin) {
>>>>>>> origin/devashish
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiter
const limiter = rateLimit({
<<<<<<< HEAD
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
=======
  windowMs: 15 * 60 * 1000,
  max: 100,
>>>>>>> origin/devashish
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use(limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use("/api/v1", indexRouter);

// Health check
app.get("/health", (_req, res) => {
<<<<<<< HEAD
  res.json({
    success: true,
    message: "Incanto API is running",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
=======
  res.json({ success: true, message: "Incanto API is running" });
>>>>>>> origin/devashish
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use(errorHandler);

// Server start
<<<<<<< HEAD
app.listen(config.port, () => {
  console.log(`Incanto API running on port ${config.port} (${config.nodeEnv})`);
=======
app.listen(PORT, () => {
  console.log(`Incanto API running on port ${PORT}`);
>>>>>>> origin/devashish
});

export default app;
