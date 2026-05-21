import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const giftsPath = join(__dirname, "../data/gifts.json");

let giftsCache = null;

const normalizeRecipient = (recipient) =>
  String(recipient || "").trim().toLowerCase();

const normalizeTags = (tags) =>
  String(tags || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

const normalizeText = (text) => String(text || "").trim().toLowerCase();

const buildRecipientAliases = (recipients) => {
  const aliasSet = new Set(recipients);

  if (recipients.some((r) => ["mom", "dad"].includes(r))) {
    aliasSet.add("parent");
  }

  if (recipients.some((r) => ["partner", "wife", "husband"].includes(r))) {
    aliasSet.add("partner");
  }

  if (recipients.some((r) => ["mom", "dad", "sibling", "child", "partner", "wife", "husband", "family"].includes(r))) {
    aliasSet.add("family");
  }

  return Array.from(aliasSet);
};

const normalizeGift = (rawGift) => {
  const recipients = Array.isArray(rawGift.Recipient)
    ? rawGift.Recipient.map(normalizeRecipient)
    : String(rawGift.Recipient || "")
        .split(/[,;&]/)
        .map(normalizeRecipient)
        .filter(Boolean);

  const occasion = String(rawGift.Occasion || rawGift.occasion || "").trim();
  if (occasion.toLowerCase() === "anniversary") {
    recipients.push("partner");
  }

  const normalizedRecipients = buildRecipientAliases(recipients);

  return {
    id: rawGift.id,
    name: rawGift["Item Name"] || rawGift.name || "Gift",
    category: String(rawGift.Category || rawGift.category || "").trim(),
    occasion: occasion,
    recipients: normalizedRecipients.length > 0 ? normalizedRecipients : ["other"],
    price: Number(rawGift["Price (NPR)"] ?? rawGift.price ?? 0),
    description: String(rawGift.Description || rawGift.description || "").trim(),
    availability: String(rawGift.Availability || rawGift.availability || "").trim(),
    tags: normalizeTags(rawGift.Tags || rawGift.tags),
    imageUrl: "",
    link: String(rawGift.daraz_search_link || rawGift.link || "").trim(),
  };
};

const loadGifts = () => {
  if (!giftsCache) {
    const raw = readFileSync(giftsPath, "utf-8");
    const data = JSON.parse(raw);
    const giftList = Array.isArray(data)
      ? data
      : data.nepal_gift_database || data.gifts || [];
    giftsCache = giftList.map(normalizeGift);
  }
  return giftsCache;
};

const personalityTagMap = {
  funny: ["funny", "quirky", "playful"],
  romantic: ["romantic", "sentimental", "personalized", "luxury"],
  practical: ["practical", "budget", "useful", "everyday"],
  adventurous: ["adventure", "travel", "outdoor", "experiential"],
  artistic: ["artistic", "creative", "design", "handmade"],
  intellectual: ["intellectual", "books", "learning", "tech"],
};

const occasionRecipientMap = {
  "birthday": ["friend", "dad", "mom", "sibling", "colleague", "child"],
  "anniversary": ["partner", "wife", "husband"],
  "valentine": ["partner", "wife", "husband"],
  "festival": ["mom", "dad", "family", "friend", "colleague", "child", "other"],
  "casual": ["friend", "colleague", "sibling"],
  "wedding": ["friend", "sibling", "colleague", "family"],
  "graduation": ["friend", "sibling", "child", "colleague", "partner"],
  "babyshower": ["partner", "friend", "sibling", "colleague", "mom", "child"],
  "justbecause": ["friend", "colleague", "sibling", "partner", "family"],
  "christmas": ["mom", "dad", "sibling", "family"],
  "new year": ["friend", "family", "colleague"],
};

const matchesInterests = (gift, interests) => {
  if (!interests.length) return true;

  const normalizedCategory = normalizeText(gift.category);
  const normalizedOccasion = normalizeText(gift.occasion);

  return interests.some((interest) =>
    gift.tags.includes(interest) ||
    normalizedCategory === interest ||
    normalizedOccasion === interest
  );
};

const matchesPersonality = (gift, personality) => {
  if (!personality) return true;
  const normalizedPersonality = normalizeText(personality);
  const personalityTags = personalityTagMap[normalizedPersonality] || [normalizedPersonality];
  return gift.tags.some((tag) => personalityTags.includes(tag));
};

const scoreGift = (gift, { budget, recipient, interests, personality, occasion }) => {
  let score = 0;

  const normalizedRecipient = normalizeRecipient(recipient);
  const normalizedOccasion = normalizeText(occasion);
  const normalizedInterests = (interests || []).map((i) => normalizeText(i)).filter(Boolean);

  if (budget !== null && budget !== undefined && gift.price > budget) {
    return -1;
  }

  if (normalizedRecipient && !gift.recipients.includes(normalizedRecipient)) {
    return -1;
  }

  if (normalizedOccasion && gift.occasion.toLowerCase() !== normalizedOccasion) {
    return -1;
  }

  if (normalizedInterests.length > 0 && !matchesInterests(gift, normalizedInterests)) {
    return -1;
  }

  if (personality && !matchesPersonality(gift, personality)) {
    return -1;
  }

  if (normalizedRecipient && gift.recipients.includes(normalizedRecipient)) {
    score += 40;
  }

  if (normalizedOccasion && gift.occasion.toLowerCase() === normalizedOccasion) {
    score += 20;
  }

  if (normalizedOccasion && occasionRecipientMap[normalizedOccasion]) {
    const allowedRecipients = occasionRecipientMap[normalizedOccasion].map(normalizeRecipient);
    const hasCompatibleRecipient = gift.recipients.some((rec) => allowedRecipients.includes(rec));
    if (!hasCompatibleRecipient) {
      return -1; // Exclude gift if no compatible recipient
    }
  }

  if (normalizedInterests.length > 0) {
    const matchedTags = gift.tags.filter((tag) => normalizedInterests.includes(tag));
    score += matchedTags.length * 25;

    if (normalizedInterests.includes(normalizeText(gift.category))) {
      score += 15;
    }

    if (normalizedInterests.includes(normalizeText(gift.occasion))) {
      score += 10;
    }
  }

  if (personality) {
    const normalizedPersonality = normalizeText(personality);
    const personalityTags = personalityTagMap[normalizedPersonality] || [normalizedPersonality];
    const personalityMatches = gift.tags.filter((tag) => personalityTags.includes(tag));
    score += personalityMatches.length * 20;
  }

  if (gift.tags.includes("premium")) score += 5;
  if (gift.tags.includes("trendy")) score += 5;
  if (gift.tags.includes("budget")) score += 5;

  if (budget !== null && budget !== undefined) {
    const delta = Math.max(0, budget - gift.price);
    if (delta <= 500) score += 10;
    else if (delta <= 1500) score += 5;
  }

  return score;
};

export const getRecommendations = async (preferences = {}, options = {}) => {
  const gifts = loadGifts();
  const { budget = null, recipient = null, interests = [], personality = null, occasion = null } = preferences;
  const { limit = 10, page = 1 } = options;

  const scored = gifts
    .map((gift) => ({
      ...gift,
      score: scoreGift(gift, { budget, recipient, interests, personality, occasion }),
    }))
    .filter((gift) => gift.score >= 0)
    .sort((a, b) => b.score - a.score || a.price - b.price || a.name.localeCompare(b.name));

  const total = scored.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const results = scored.slice(start, start + limit).map(({ score, ...gift }) => gift);

  return {
    total,
    page,
    totalPages,
    limit,
    results,
  };
};
