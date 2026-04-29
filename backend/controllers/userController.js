/**
 * controllers/userController.js
 *
 * Handles HTTP req/res for user-related routes.
 * Business logic lives in services/userService.js — keep controllers thin.
 */

import crypto from "crypto";
import { config } from "../config/index.js";
import { signToken } from "../middleware/auth.js";
import { createError } from "../middleware/errorHandler.js";
import {
  findUserByEmail,
  createUser,
  upsertGoogleUser,
  updatePersonalInfo,
  getUserPreferences,
  upsertPreferences,
  getCart,
  addToCart,
  removeFromCart,
  getRecentlyViewed,
  trackRecentlyViewed,
  toPublicUser,
  passwordsMatch,
} from "../services/userService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const decodeGoogleCredential = (credential) => {
  const parts = String(credential || "").split(".");
  if (parts.length < 2) return null;
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
};

/** Fetch all related data and send a full auth response. */
const issueAuthResponse = async (res, user, status = 200) => {
  const [prefs, cart, recentlyViewed] = await Promise.all([
    getUserPreferences(user.id),
    getCart(user.id),
    getRecentlyViewed(user.id),
  ]);

  const token = signToken(user);
  return res.status(status).json({
    success: true,
    data: {
      token,
      tokenType: "Bearer",
      expiresIn: config.auth.tokenTtlMs / 1000,
      user: toPublicUser(user, prefs, cart, recentlyViewed),
    },
  });
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const register = async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password)
      return next(createError("Username, email, and password are required.", 400));
    if (!/^\S+@\S+\.\S+$/.test(email))
      return next(createError("Please enter a valid email address.", 400));
    if (password.length < 8)
      return next(createError("Password must be at least 8 characters.", 400));

    const user = await createUser({ username, email, password });
    await issueAuthResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await findUserByEmail(email);
    if (!user || !user.password_hash || !passwordsMatch(password, user.password_hash))
      return next(createError("Invalid email or password.", 401));

    await issueAuthResponse(res, user);
  } catch (err) {
    next(err);
  }
};

export const loginWithGoogle = async (req, res, next) => {
  try {
    const payload = decodeGoogleCredential(req.body.credential);
    if (!payload?.email)
      return next(createError("A valid Google credential token is required.", 400));

    const { googleClientId } = config.auth;
    if (googleClientId && payload.aud !== googleClientId)
      return next(createError("Google credential was not issued for this app.", 401));

    const user = await upsertGoogleUser({
      email: payload.email,
      username: payload.name || payload.email.split("@")[0],
      verified: Boolean(payload.email_verified),
    });

    await issueAuthResponse(res, user);
  } catch (err) {
    next(createError("Could not read the Google credential token.", 400));
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const [prefs, cart, recentlyViewed] = await Promise.all([
      getUserPreferences(req.user.id),
      getCart(req.user.id),
      getRecentlyViewed(req.user.id),
    ]);
    res.json({ success: true, data: { user: toPublicUser(req.user, prefs, cart, recentlyViewed) } });
  } catch (err) {
    next(err);
  }
};

// ── Preferences ───────────────────────────────────────────────────────────────

export const savePreferences = async (req, res, next) => {
  try {
    const prefs = await upsertPreferences(req.user.id, {
      recipient: req.body.recipient || null,
      budget: Number(req.body.budget) || null,
      interests: Array.isArray(req.body.interests)
        ? req.body.interests
        : String(req.body.interests || "")
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean),
      personality: req.body.personality || null,
      occasion: req.body.occasion || null,
    });

    res.json({ success: true, message: "Preferences saved.", data: { preferences: prefs } });
  } catch (err) {
    next(err);
  }
};

// ── Personal Info ─────────────────────────────────────────────────────────────

export const savePersonalInfo = async (req, res, next) => {
  try {
    const updated = await updatePersonalInfo(req.user.id, {
      fullName: String(req.body.fullName || "").trim(),
      phone: String(req.body.phone || "").trim(),
      birthday: String(req.body.birthday || "").trim(),
      location: String(req.body.location || "").trim(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: "Personal information saved.", data: { personalInfo: updated.personal_info } });
  } catch (err) {
    next(err);
  }
};

// ── Cart ──────────────────────────────────────────────────────────────────────

export const addGiftToCart = async (req, res, next) => {
  try {
    const gift = req.body.gift || req.body;
    if (!gift?.id || !gift?.name)
      return res.status(400).json({ success: false, message: "Gift id and name are required." });

    const cart = await addToCart(req.user.id, gift);
    res.json({ success: true, data: { cart } });
  } catch (err) {
    next(err);
  }
};

export const removeGiftFromCart = async (req, res, next) => {
  try {
    const cart = await removeFromCart(req.user.id, req.params.id);
    res.json({ success: true, data: { cart } });
  } catch (err) {
    next(err);
  }
};

// ── Recently Viewed ───────────────────────────────────────────────────────────

export const addRecentlyViewed = async (req, res, next) => {
  try {
    const gift = req.body.gift || req.body;
    if (!gift?.id || !gift?.name)
      return res.status(400).json({ success: false, message: "Gift id and name are required." });

    const recentlyViewed = await trackRecentlyViewed(req.user.id, gift);
    res.json({ success: true, data: { recentlyViewed } });
  } catch (err) {
    next(err);
  }
};
