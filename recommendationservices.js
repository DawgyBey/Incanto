//backend-services-recommendationservices.js

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import config from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const giftsPath = join(__dirname, "../data/gifts.json");
let giftsCache = null;

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE REALITY (verified by reading every single gift):
//
// DB Recipients:  'Mom'  |  'Dad'  |  'Friend'
// DB Occasions:   'Birthday' | 'Anniversary' | 'Casual' | 'Festival'
// DB Categories:  'Tech' | 'Art' | 'Sport' | 'Food' | 'Clothing' | 'Lifestyle'
// DB Tags:        'budget' 'experience' 'funny' 'gadget' 'handmade'
//                 'practical' 'premium' 'romantic' 'sentimental'
//                 'sport' 'traditional' 'trendy' 'unique'
//
// KEY INSIGHT: Couple gifts (Couple Hoodies, Custom Couple T-shirt, 
// Custom Anniversary Print) are stored under Recipient='Friend' NOT 'Mom'.
// So 'partner' MUST search BOTH 'Mom' AND 'Friend'.
// ─────────────────────────────────────────────────────────────────────────────

// Each frontend recipient maps to an ARRAY of DB recipients to match against.
// This is what was broken — partner was only mapping to ['Mom'], missing
// all the couple gifts stored under 'Friend'.
const RECIPIENT_MAP = {
  mom:         ["Mom"],
  dad:         ["Dad"],
  friend:      ["Friend"],
  partner:     ["Mom", "Friend"],   // couple gifts are under Friend; mom gifts are romantic too
  sibling:     ["Friend"],          // youth/fun gifts — all under Friend
  colleague:   ["Friend"],          // practical/casual — Friend category
  child:       ["Friend"],          // fun gifts — Friend category
  grandparent: ["Mom"],             // traditional/lifestyle — Mom category
};

// Frontend occasion → exact DB Occasion string
const OCCASION_MAP = {
  birthday:    "Birthday",
  anniversary: "Anniversary",
  wedding:     "Anniversary",   // closest: romantic/formal
  festival:    "Festival",
  graduation:  "Birthday",      // celebratory
  babyshower:  "Festival",      // gift-giving occasion
  valentine:   "Anniversary",   // romantic — anniversary gifts fit perfectly
  justbecause: "Casual",
  casual:      "Casual",
};

// Frontend interest → DB Category names (exact case)
// Every interest maps to the categories that actually contain relevant gifts
const INTEREST_CATEGORY_MAP = {
  cooking:     ["Food", "Lifestyle"],
  food:        ["Food"],
  music:       ["Tech", "Lifestyle", "Art"],
  travel:      ["Sport", "Lifestyle", "Tech"],
  fitness:     ["Sport", "Lifestyle"],
  art:         ["Art", "Lifestyle"],
  books:       ["Art", "Lifestyle"],
  gaming:      ["Tech"],
  fashion:     ["Clothing"],
  tech:        ["Tech"],
  nature:      ["Lifestyle", "Sport", "Art"],
  skincare:    ["Lifestyle", "Food"],
  photography: ["Tech", "Art"],
};

// Frontend personality → tags that actually exist in the DB (lowercase)
const PERSONALITY_TAG_MAP = {
  funny:        ["funny", "unique"],
  romantic:     ["romantic", "sentimental", "handmade", "premium"],
  practical:    ["practical", "budget"],
  adventurous:  ["sport", "experience", "unique"],
  artistic:     ["handmade", "traditional", "unique"],
  intellectual: ["practical", "unique", "gadget"],
};

// For valentine/anniversary occasions: these tags strongly signal romantic suitability
const ROMANTIC_TAGS = ["romantic", "sentimental", "handmade", "premium"];

// ─── LOAD & NORMALIZE GIFTS ───────────────────────────────────────────────────

const normalizeTags = (raw) =>
  String(raw || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

const loadGifts = () => {
  if (!giftsCache) {
    const data = JSON.parse(readFileSync(giftsPath, "utf-8"));
    const list = Array.isArray(data) ? data : data.nepal_gift_database || data.gifts || [];
    giftsCache = list.map((g) => ({
      id:           g.id,
      name:         String(g["Item Name"] || g.name || "").trim(),
      category:     String(g.Category  || g.category  || "").trim(),
      occasion:     String(g.Occasion  || g.occasion  || "").trim(),
      recipient:    String(g.Recipient || g.recipient || "").trim(),
      price:        Number(g["Price (NPR)"] ?? g.price ?? 0),
      description:  String(g.Description  || g.description  || "").trim(),
      availability: String(g.Availability || g.availability || "").trim(),
      tags:         normalizeTags(g.Tags || g.tags),
      imageUrl:     String(g.image_url || "").trim(),
      link:         String(g.daraz_search_link || g.link || "").trim(),
    }));
  }
  return giftsCache;
};

// ─── SCORING ──────────────────────────────────────────────────────────────────

const scoreGift = (gift, {
  dbRecipients,     // array e.g. ['Mom','Friend']
  dbOccasion,       // string e.g. 'Anniversary'
  relevantCats,     // Set e.g. Set{'Clothing'}
  normInterests,    // array e.g. ['fashion']
  personality,      // string e.g. 'romantic'
  budget,           // number
  isRomanticOccasion, // bool — true for valentine/anniversary
}) => {
  let score = 0;

  // Hard cut: never show gifts over budget
  if (budget !== null && budget !== undefined && gift.price > budget) return -1;

  // ── Recipient match ──────────────────────────────────────────────────────
  // dbRecipients is now an array, so we check if gift.recipient is in it
  if (dbRecipients.length > 0 && dbRecipients.includes(gift.recipient)) {
    score += 50;
  }

  // ── Occasion match ───────────────────────────────────────────────────────
  if (dbOccasion && gift.occasion === dbOccasion) {
    score += 30;
  }

  // ── Interest → Category match ────────────────────────────────────────────
  if (relevantCats.size > 0 && relevantCats.has(gift.category)) {
    score += 40;
  }

  // ── Romantic occasion bonus ──────────────────────────────────────────────
  // For valentine/anniversary, gift with romantic tags should rank higher
  if (isRomanticOccasion) {
    const romanticMatches = gift.tags.filter((t) => ROMANTIC_TAGS.includes(t)).length;
    score += romanticMatches * 12;
  }

  // ── Personality → tag match ──────────────────────────────────────────────
  if (personality) {
    const pTags = PERSONALITY_TAG_MAP[personality.toLowerCase()] || [];
    score += gift.tags.filter((t) => pTags.includes(t)).length * 15;
  }

  // ── Tag-level interest match (secondary) ─────────────────────────────────
  if (normInterests.length > 0) {
    score += gift.tags.filter((t) => normInterests.includes(t)).length * 8;
  }

  // ── Quality signal boosts ────────────────────────────────────────────────
  if (gift.tags.includes("premium"))  score += 3;
  if (gift.tags.includes("handmade")) score += 3;
  if (gift.tags.includes("trendy"))   score += 2;

  // ── Budget proximity boost ───────────────────────────────────────────────
  if (budget !== null && budget !== undefined) {
    const headroom = budget - gift.price;
    if (headroom >= 0 && headroom <= 500)  score += 8;
    else if (headroom <= 1500)             score += 4;
  }

  return score;
};

// ─── GEMINI RANKING ───────────────────────────────────────────────────────────

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function rankWithGemini(candidates, { recipient, occasion, budget, interests, personality }) {
  const apiKey = config.geminiApiKey;

  if (!apiKey) {
    console.warn("[Incanto] GEMINI_API_KEY not set — using rule-based order.");
    return candidates.map((g) => ({
      id: g.id,
      reason: `A thoughtful ${g.category.toLowerCase()} gift for ${recipient || "them"}.`,
    }));
  }

  const giftList = candidates
    .map((g) =>
      `ID:${g.id} | "${g.name}" | Category:${g.category} | Rs.${g.price} | Tags:${g.tags.join(",")} | ${g.description}`
    )
    .join("\n");

  const system = `You are a gift ranking expert for Incanto, a Nepali gift-finding app.
Rank the gifts below from BEST to WORST for the buyer's exact preferences.
Write one specific reason per gift (1 sentence). Mention the recipient and occasion or interest.
Respond ONLY with valid JSON — no markdown fences, no extra text.

Format:
{
  "ranked": [
    { "id": 1, "reason": "Perfect for a partner on Valentine's Day — this couple hoodie makes a romantic and fun statement." },
    { "id": 2, "reason": "..." }
  ]
}`;

  const user = `Preferences:
- Recipient: ${recipient || "not specified"}
- Occasion: ${occasion || "not specified"}
- Budget: Rs. ${budget || "flexible"}
- Interests: ${interests?.length ? interests.join(", ") : "none selected"}
- Personality: ${personality || "not specified"}

Rank ALL ${candidates.length} gifts listed here:
${giftList}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || res.statusText);
    }

    const data = await res.json();
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Gemini response");

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.ranked)) throw new Error("Missing ranked array");
    return parsed.ranked;

  } catch (err) {
    console.error("[Incanto] Gemini failed, using rule-based order:", err.message);
    return candidates.map((g) => ({
      id: g.id,
      reason: `A great ${g.category.toLowerCase()} gift for ${recipient || "the recipient"}.`,
    }));
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export const getRecommendations = async (preferences = {}, options = {}) => {
  const gifts = loadGifts();

  const {
    budget      = null,
    recipient   = null,
    interests   = [],
    personality = null,
    occasion    = null,
  } = preferences;

  const { limit = 10, page = 1 } = options;

  // ── Translate frontend values → DB values ─────────────────────────────────
  const recipientKey  = String(recipient || "").toLowerCase().trim();
  const occasionKey   = String(occasion  || "").toLowerCase().trim();

  // dbRecipients is now an ARRAY (fixes the partner → both Mom+Friend problem)
  const dbRecipients = RECIPIENT_MAP[recipientKey] || [];
  const dbOccasion   = OCCASION_MAP[occasionKey]   || null;

  const normInterests = (interests || [])
    .map((i) => String(i).trim().toLowerCase())
    .filter(Boolean);

  const relevantCats = new Set(
    normInterests.flatMap((i) => INTEREST_CATEGORY_MAP[i] || [])
  );

  // Valentine and anniversary → boost romantic gifts
  const isRomanticOccasion = ["valentine", "anniversary", "wedding"].includes(occasionKey);

  console.log(`[Incanto] recipient:${recipient}→[${dbRecipients}] | occasion:${occasion}→${dbOccasion} | interests:[${normInterests}]→cats:[${[...relevantCats]}] | romantic:${isRomanticOccasion} | budget:${budget}`);

  // ── Score every gift ──────────────────────────────────────────────────────
  const POOL_SIZE = 25;

  const allScored = gifts
    .map((g) => ({
      ...g,
      _score: scoreGift(g, {
        dbRecipients,
        dbOccasion,
        relevantCats,
        normInterests,
        personality,
        budget,
        isRomanticOccasion,
      }),
    }))
    .filter((g) => g._score >= 0)
    .sort((a, b) => b._score - a._score || a.price - b.price);

  // ── Build candidate pool ──────────────────────────────────────────────────
  // When interests chosen: fill pool with interest-category matches first.
  // When romantic occasion: also prioritise romantic-tagged gifts.
  let candidates;

  if (relevantCats.size > 0) {
    const hits   = allScored.filter((g) => relevantCats.has(g.category));
    const others = allScored.filter((g) => !relevantCats.has(g.category));
    candidates = [
      ...hits.slice(0, POOL_SIZE),
      ...others.slice(0, Math.max(0, POOL_SIZE - hits.length)),
    ].slice(0, POOL_SIZE);
  } else if (isRomanticOccasion && relevantCats.size === 0) {
    // No interest chosen but romantic occasion — float romantic gifts to top
    const romantic = allScored.filter((g) => g.tags.includes("romantic") || g.tags.includes("sentimental"));
    const others   = allScored.filter((g) => !g.tags.includes("romantic") && !g.tags.includes("sentimental"));
    candidates = [
      ...romantic.slice(0, POOL_SIZE),
      ...others.slice(0, Math.max(0, POOL_SIZE - romantic.length)),
    ].slice(0, POOL_SIZE);
  } else {
    candidates = allScored.slice(0, POOL_SIZE);
  }

  candidates = candidates.map(({ _score, ...g }) => g);

  console.log(`[Incanto] Pool: ${candidates.length} gifts | top 5: ${candidates.slice(0,5).map(g=>`${g.name}(${g.category})`).join(", ")}`);

  if (candidates.length === 0) {
    return { total: 0, page, totalPages: 0, limit, results: [] };
  }

  // ── Gemini re-ranks ───────────────────────────────────────────────────────
  const aiRanking = await rankWithGemini(candidates, {
    recipient, occasion, budget,
    interests: normInterests,
    personality,
  });

  // ── Merge AI order + reasons ──────────────────────────────────────────────
  const byId     = Object.fromEntries(candidates.map((g) => [g.id, g]));
  const reasonOf = Object.fromEntries(aiRanking.map((r) => [r.id, r.reason || ""]));

  const aiIds  = aiRanking.map((r) => r.id).filter((id) => byId[id]);
  const missed = candidates.filter((g) => !new Set(aiIds).has(g.id)).map((g) => g.id);

  const ranked = [...aiIds, ...missed].map((id) => ({
    ...byId[id],
    aiReason: reasonOf[id] || "",
  }));

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total      = ranked.length;
  const totalPages = Math.ceil(total / limit);
  const start      = (page - 1) * limit;

  return { total, page, totalPages, limit, results: ranked.slice(start, start + limit) };
};