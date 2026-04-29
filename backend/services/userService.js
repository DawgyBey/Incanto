/**
 * services/userService.js
 *
 * All database operations for users.
 * Controllers call these functions — they never touch JSON directly.
 */

import crypto from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { v4 as uuidv4 } from "uuid";
import { createError } from "../middleware/errorHandler.js";

// ── Helpers ─────────────────────────────────────────────────────────────

const readJson = (path) => {
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeJson = (path, data) => {
  writeFileSync(path, JSON.stringify(data, null, 2));
};

// ── Password helpers ──────────────────────────────────────────────────────────

const hashPassword = (
  password,
  salt = crypto.randomBytes(16).toString("hex")
) => {
  const hash = crypto
    .pbkdf2Sync(password, salt, 120_000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
};

export const passwordsMatch = (password, savedHash) => {
  const [salt] = savedHash.split(":");
  return hashPassword(password, salt) === savedHash;
};

// ── Shape helpers ─────────────────────────────────────────────────────────────

/**
 * Strip sensitive fields before sending to the client.
 * Add/remove fields here if the shape ever changes.
 */
export const toPublicUser = (user, preferences = null, cart = [], recentlyViewed = []) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  verified: user.verified,
  provider: user.provider,
  personalInfo: user.personal_info || {},
  preferences: preferences || {},
  cart,
  recentlyViewed,
  createdAt: user.created_at,
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const findUserByEmail = async (email) => {
  const data = readJson(USERS_PATH);
  return data.users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
};

export const findUserById = async (id) => {
  const data = readJson(USERS_PATH);
  return data.users.find(user => user.id === id) || null;
};

export const createUser = async ({ username, email, password, provider = "password", verified = false }) => {
  const data = readJson(USERS_PATH);
  if (data.users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
    throw createError("An account with this email already exists.", 409);
  }

  const user = {
    id: uuidv4(),
    username,
    email: email.toLowerCase(),
    password_hash: password ? hashPassword(password) : null,
    verified,
    provider,
    personal_info: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  data.users.push(user);
  writeJson(USERS_PATH, data);
  return user;
};

export const upsertGoogleUser = async ({ email, username, verified }) => {
  const data = readJson(USERS_PATH);
  let user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (user) {
    // Merge google into existing account
    user.verified = user.verified || verified;
    user.provider = user.provider === "password" ? "password+google" : user.provider;
    user.updated_at = new Date().toISOString();
  } else {
    user = {
      id: uuidv4(),
      username,
      email: email.toLowerCase(),
      password_hash: null,
      verified,
      provider: "google",
      personal_info: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    data.users.push(user);
  }

  writeJson(USERS_PATH, data);
  return user;
};

export const updatePersonalInfo = async (userId, info) => {
  const data = readJson(USERS_PATH);
  const user = data.users.find(u => u.id === userId);
  if (!user) throw createError("User not found.", 404);

  user.personal_info = info;
  user.updated_at = new Date().toISOString();
  writeJson(USERS_PATH, data);
  return user;
};

// ── Preferences ───────────────────────────────────────────────────────────────

export const getUserPreferences = async (userId) => {
  const data = readJson(PREFERENCES_PATH);
  return data.preferences.find(p => p.user_id === userId) || null;
};

export const upsertPreferences = async (userId, prefs) => {
  const data = readJson(PREFERENCES_PATH);
  let pref = data.preferences.find(p => p.user_id === userId);

  if (pref) {
    Object.assign(pref, prefs, { updated_at: new Date().toISOString() });
  } else {
    pref = {
      user_id: userId,
      ...prefs,
      updated_at: new Date().toISOString(),
    };
    data.preferences.push(pref);
  }

  writeJson(PREFERENCES_PATH, data);
  return pref;
};

// ── Cart ──────────────────────────────────────────────────────────────────────

export const getCart = async (userId) => {
  const data = readJson(CART_PATH);
  return data.cart.filter(item => item.user_id === userId).sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
};

export const addToCart = async (userId, gift) => {
  const data = readJson(CART_PATH);
  const existing = data.cart.find(item => item.user_id === userId && String(item.gift_id) === String(gift.id));

  if (existing) {
    existing.quantity += 1;
  } else {
    data.cart.push({
      id: uuidv4(),
      user_id: userId,
      gift_id: String(gift.id),
      gift_data: gift,
      quantity: 1,
      added_at: new Date().toISOString(),
    });
  }

  writeJson(CART_PATH, data);
  return getCart(userId);
};

export const removeFromCart = async (userId, giftId) => {
  const data = readJson(CART_PATH);
  data.cart = data.cart.filter(item => !(item.user_id === userId && String(item.gift_id) === String(giftId)));
  writeJson(CART_PATH, data);
  return getCart(userId);
};

// ── Recently Viewed ───────────────────────────────────────────────────────────

export const getRecentlyViewed = async (userId) => {
  const data = readJson(RECENTLY_VIEWED_PATH);
  return data.recentlyViewed
    .filter(item => item.user_id === userId)
    .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at))
    .slice(0, 6);
};

export const trackRecentlyViewed = async (userId, gift) => {
  const data = readJson(RECENTLY_VIEWED_PATH);
  // Remove existing entry if present
  data.recentlyViewed = data.recentlyViewed.filter(item => !(item.user_id === userId && String(item.gift_id) === String(gift.id)));

  // Add new entry
  data.recentlyViewed.push({
    id: uuidv4(),
    user_id: userId,
    gift_id: String(gift.id),
    gift_data: gift,
    viewed_at: new Date().toISOString(),
  });

  writeJson(RECENTLY_VIEWED_PATH, data);
  return getRecentlyViewed(userId);
};
