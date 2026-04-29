/**
 * middleware/auth.js
 *
 * JWT verification middleware.
 * Use `requireAuth` to protect routes that need a logged-in user.
 * Use `optionalAuth` for routes that work with or without a token.
 */

import crypto from "crypto";
import { config } from "../config/index.js";
import { findUserById } from "../services/userService.js";
import { createError } from "./errorHandler.js";

const { tokenSecret } = config.auth;

// ── Token helpers ─────────────────────────────────────────────────────────────

const base64Url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export const signToken = (user) => {
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Date.now() + config.auth.tokenTtlMs,
  };
  const body = base64Url(payload);
  const signature = crypto
    .createHmac("sha256", tokenSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
};

export const verifyToken = (token) => {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, signature] = token.split(".");
    const expected = crypto
      .createHmac("sha256", tokenSecret)
      .update(body)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    )
      return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

// ── Middleware ────────────────────────────────────────────────────────────────

const extractUser = async (req) => {
  const rawHeader = req.get("Authorization") || "";
  const token = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;

  return await findUserById(payload.sub);
};

/** Rejects unauthenticated requests with 401. */
export const requireAuth = async (req, _res, next) => {
  try {
    const user = await extractUser(req);
    if (!user) return next(createError("Unauthorized or expired token.", 401));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Populates req.user if a valid token is present, but never rejects. */
export const optionalAuth = async (req, _res, next) => {
  try {
    req.user = (await extractUser(req)) || null;
    next();
  } catch {
    req.user = null;
    next();
  }
};
