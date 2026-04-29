/**
 * config/index.js
 *
 * All runtime configuration in one place.
 * Import { config } wherever you need env values — never read process.env directly elsewhere.
 */

import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",

  cors: {
    // Comma-separated origins in CLIENT_ORIGIN env var
    allowedOrigins: (process.env.CLIENT_ORIGIN || "*")
      .split(",")
      .map((o) => o.trim()),
  },

  auth: {
    tokenSecret: process.env.AUTH_TOKEN_SECRET || "incanto-dev-secret-change-me",
    tokenTtlMs: 1000 * 60 * 60 * 24 * 7, // 7 days
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
  },
};
