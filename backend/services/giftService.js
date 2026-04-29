/**
 * services/giftService.js
 *
 * Gift scoring, filtering, and recommendation logic.
 * Data is loaded from data/gifts.json (static catalogue).
 * To swap in a database-backed catalogue later, replace loadGifts().
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GIFTS_PATH = join(__dirname, "../data/gifts.json");

let giftsCache = null;

// ── Data loading ──────────────────────────────────────────────────────────────

const normalizeRecipient = (r) => String(r || "").trim().toLowerCase();

const normalizeTags = (tags) =>
  String(tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

const normalizeGift = (raw) => {
  const recipients = Array.isArray(raw.Recipient)
    ? raw.Recipient.map(normalizeRecipient)
    : String(raw.Recipient || "")
        .split(/[,;&]/)
        .map(normalizeRecipient)
        .filter(Boolean);

  const occasion = String(raw.Occasion || raw.occasion || "").trim();
  if (occasion.toLowerCase() === "anniversary") recipients.push("partner");

  return {
    id: raw.id,
    name: raw["Item Name"] || raw.name || "Gift",
    category: String(raw.Category || raw.category || "").trim(),
    occasion,
    recipients: recipients.length > 0 ? recipients : ["other"],
    price: Number(raw["Price (NPR)"] ?? raw.price ?? 0),
    description: String(raw.Description || raw.description || "").trim(),
    availability: String(raw.Availability || raw.availability || "").trim(),
    tags: normalizeTags(raw.Tags || raw.tags),
    imageUrl: "",
    link: String(raw.daraz_search_link || raw.link || "").trim(),
  };
};

const loadGifts = () => {
  if (!giftsCache) {
    const raw = readFileSync(GIFTS_PATH, "utf-8");
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : data.nepal_gift_database || data.gifts || [];
    giftsCache = list.map(normalizeGift);
  }
  return giftsCache;
};

// ── Scoring ───────────────────────────────────────────────────────────────────

const PERSONALITY_TAG_MAP = {
  funny: ["funny", "quirky", "playful"],
  romantic: ["romantic", "sentimental", "personalized", "luxury"],
  practical: ["practical", "budget", "useful", "everyday"],
  adventurous: ["adventure", "travel", "outdoor", "experiential"],
  artistic: ["artistic", "creative", "design", "handmade"],
  intellectual: ["intellectual", "books", "learning", "tech"],
};

const OCCASION_RECIPIENT_MAP = {
  birthday:    ["friend", "dad", "mom", "sibling", "colleague", "child"],
  anniversary: ["partner", "wife", "husband"],
  valentine:   ["partner", "wife", "husband"],
  festival:    ["mom", "dad", "family", "other"],
  casual:      ["friend", "colleague", "sibling"],
  wedding:     ["partner", "wife", "husband", "family"],
  graduation:  ["friend", "sibling", "child"],
  christmas:   ["mom", "dad", "sibling", "family"],
  "new year":  ["friend", "family", "colleague"],
};

const scoreGift = (gift, { budget, recipient, interests, personality, occasion }) => {
  let score = 0;

  // Hard exclude: over budget
  if (budget != null && gift.price > budget) return -1;

  const normRecipient = normalizeRecipient(recipient);
  if (normRecipient && gift.recipients.includes(normRecipient)) score += 40;

  const normOccasion = String(occasion || "").trim().toLowerCase();
  if (normOccasion && gift.occasion.toLowerCase() === normOccasion) score += 20;

  // Hard exclude: incompatible occasion/recipient pair
  if (normOccasion && OCCASION_RECIPIENT_MAP[normOccasion]) {
    const allowed = OCCASION_RECIPIENT_MAP[normOccasion].map(normalizeRecipient);
    if (!gift.recipients.some((r) => allowed.includes(r))) return -1;
  }

  const normInterests = (interests || [])
    .map((i) => String(i).trim().toLowerCase())
    .filter(Boolean);

  if (normInterests.length > 0) {
    const tagMatches = gift.tags.filter((t) => normInterests.includes(t));
    score += tagMatches.length * 25;
    if (normInterests.includes(gift.category.toLowerCase())) score += 15;
    if (normInterests.includes(gift.occasion.toLowerCase())) score += 10;
  }

  if (personality) {
    const pTags = PERSONALITY_TAG_MAP[String(personality).trim().toLowerCase()] || [];
    score += gift.tags.filter((t) => pTags.includes(t)).length * 20;
  }

  if (gift.tags.includes("premium")) score += 5;
  if (gift.tags.includes("trendy")) score += 5;
  if (gift.tags.includes("budget")) score += 5;

  if (budget != null) {
    const delta = Math.max(0, budget - gift.price);
    score += delta <= 500 ? 10 : delta <= 1500 ? 5 : 0;
  }

  return score;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const getRecommendations = async (preferences = {}, options = {}) => {
  const {
    budget = null,
    recipient = null,
    interests = [],
    personality = null,
    occasion = null,
  } = preferences;

  const { limit = 10, page = 1 } = options;
  const gifts = loadGifts();

  const scored = gifts
    .map((g) => ({ ...g, score: scoreGift(g, { budget, recipient, interests, personality, occasion }) }))
    .filter((g) => g.score >= 0)
    .sort((a, b) => b.score - a.score || a.price - b.price || a.name.localeCompare(b.name));

  const total = scored.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const results = scored.slice(start, start + limit).map(({ score, ...g }) => g);

  return { total, page, totalPages, limit, results };
};
