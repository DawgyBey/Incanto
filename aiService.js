// backend-services-aiService.js

/**
 * AI Service — Powered by Google Gemini
 * Handles AI-powered gift recommendations and conversational interactions
 */

import config from "../config.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Send a message to Gemini and get a response back
 * @param {string} systemPrompt - Instructions for how Gemini should behave
 * @param {string} userMessage - The actual question or request
 * @returns {string} Gemini's text response
 */
async function callGemini(systemPrompt, userMessage) {
  const apiKey = config.geminiApiKey;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in your .env file. Please add it."
    );
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      `Gemini API error: ${err?.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Parse natural language input to extract gift preferences
 * @param {string} message - User message
 * @returns {Object} Extracted preferences
 */
export const parseGiftPreferences = (message) => {
  const message_lower = message.toLowerCase();
  const preferences = {
    budget: null,
    recipient: null,
    interests: [],
    personality: null,
    occasion: null,
  };

  const budgetMatch = message_lower.match(
    /(?:budget|price|under|around)\s*(?:of\s*)?(?:rs|npr)?\s*(\d+)/i
  );
  if (budgetMatch) preferences.budget = parseInt(budgetMatch[1]);

  const recipients = [
    "mom", "dad", "girlfriend", "boyfriend", "wife", "husband",
    "friend", "brother", "sister",
  ];
  const foundRecipient = recipients.find((r) => message_lower.includes(r));
  if (foundRecipient) preferences.recipient = foundRecipient;

  const occasions = ["birthday", "anniversary", "valentine", "gift", "present", "wedding"];
  const foundOccasion = occasions.find((o) => message_lower.includes(o));
  if (foundOccasion) preferences.occasion = foundOccasion;

  return preferences;
};

/**
 * Generate an AI-powered chat response for gift recommendations
 * @param {string} userMessage - What the user typed
 * @param {Array} conversationHistory - Previous messages in the chat
 * @returns {Object} AI response with message and suggestions
 */
export const generateAIChatResponse = async (userMessage, conversationHistory = []) => {
  const systemPrompt = `You are Incanto's friendly AI gift advisor. You help people find perfect gifts for their loved ones in Nepal.

Your personality:
- Warm, enthusiastic, and genuinely helpful
- You know about Nepali culture and gift-giving traditions
- You ask smart follow-up questions to narrow down the best gift
- You're concise — answers are 2-4 sentences max unless listing gifts

When suggesting gifts:
- Always mention 2-3 specific gift ideas with rough price ranges in NPR (Nepali Rupees)
- Explain briefly WHY each gift suits the person/occasion
- Ask one follow-up question to refine recommendations

If you don't have enough info (budget, recipient, occasion), ask for it naturally.
Never make up specific product links or store names.`;

  // Build conversation context for Gemini
  const historyText = conversationHistory
    .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const fullMessage = historyText
    ? `Previous conversation:\n${historyText}\n\nCustomer: ${userMessage}`
    : userMessage;

  const aiText = await callGemini(systemPrompt, fullMessage);

  return {
    message: aiText,
    confidence: 0.9,
    suggestedFollowUps: [
      "What's your budget?",
      "Tell me more about their personality",
      "What's the occasion?",
    ],
  };
};

/**
 * Analyze how suitable a gift is for a specific person/occasion
 * @param {Object} gift - Gift object from your database
 * @param {string} recipient - Who is receiving the gift
 * @param {string} occasion - What the occasion is
 * @param {number} budget - Budget in NPR
 * @returns {Object} Analysis with score and reasoning
 */
export const analyzeGiftSuitability = async (gift, recipient, occasion, budget) => {
  const systemPrompt = `You are a gift expert. Analyze gift suitability and respond ONLY with valid JSON in this exact format:
{
  "suitabilityScore": 0.85,
  "reasoning": "One sentence explanation",
  "pros": ["pro 1", "pro 2"],
  "cons": ["con 1"],
  "sentiment": "positive"
}
The score should be between 0 and 1. Sentiment is "positive", "neutral", or "negative".`;

  const userMessage = `Gift: ${gift.name} (Rs. ${gift.price})
Description: ${gift.description}
Tags: ${gift.tags?.join(", ") || "none"}
Recipient: ${recipient || "unknown"}
Occasion: ${occasion || "general gifting"}
Budget: Rs. ${budget || "flexible"}

Is this a good gift?`;

  try {
    const aiText = await callGemini(systemPrompt, userMessage);
    // Extract JSON from the response (Gemini sometimes wraps it in markdown)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn("Gemini analysis parse error:", err.message);
  }

  // Fallback if parsing fails
  return {
    suitabilityScore: 0.75,
    reasoning: "This gift seems like a solid choice for the occasion.",
    pros: ["Thoughtful choice", "Good value"],
    cons: [],
    sentiment: "positive",
  };
};

/**
 * Assess personality type based on gift preferences
 * @param {Object} preferences - User's preferences (occasion, recipient, interests, etc.)
 * @returns {Object} Personality assessment
 */
export const assessPersonality = async (preferences) => {
  const systemPrompt = `You are a personality analyst for a gift-finding app. Based on gifting preferences, identify the giver's personality type. Respond ONLY with valid JSON in this exact format:
{
  "primaryType": "thoughtful",
  "secondaryType": "adventurous",
  "traits": ["empathetic", "creative", "generous"],
  "confidence": 0.8,
  "recommendations": "One sentence about their gifting style"
}`;

  const userMessage = `Preferences: ${JSON.stringify(preferences)}
What is this person's gifting personality?`;

  try {
    const aiText = await callGemini(systemPrompt, userMessage);
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn("Personality parse error:", err.message);
  }

  return {
    primaryType: "thoughtful",
    secondaryType: "practical",
    traits: ["caring", "budget-conscious", "detail-oriented"],
    confidence: 0.7,
    recommendations: "You tend to give gifts that are both meaningful and useful.",
  };
};

/**
 * Generate AI response for gift queries (simple version for recommendation flow)
 * @param {string} query - User query
 * @param {Array} giftSuggestions - Gift suggestions to discuss
 * @returns {Object} AI response
 */
export const generateAIResponse = async (query, giftSuggestions = []) => {
  const giftList = giftSuggestions
    .slice(0, 3)
    .map((g, i) => `${i + 1}. ${g.name} — Rs. ${g.price}`)
    .join("\n");

  const systemPrompt = `You are Incanto's gift advisor. You're presenting curated gift recommendations. Be warm, enthusiastic, and brief (2-3 sentences). Explain why these picks match what the user described.`;

  const userMessage = `User asked for: "${query}"
Here are the top picks:
${giftList}

Write a short, friendly message presenting these recommendations.`;

  try {
    const message = await callGemini(systemPrompt, userMessage);
    return {
      message,
      confidence: 0.9,
      suggestedFollowUps: [
        "Would you like more options?",
        "Want to adjust the budget?",
        "Should I find something more personal?",
      ],
    };
  } catch (err) {
    console.warn("Gemini response error, using fallback:", err.message);
    const suggestions = giftSuggestions
      .slice(0, 3)
      .map((g, i) => `${i + 1}. ${g.name} (Rs. ${g.price})`)
      .join("\n");
    return {
      message: `Based on your request, here are my top recommendations:\n\n${suggestions}`,
      confidence: 0.7,
      suggestedFollowUps: ["Would you like to know more?"],
    };
  }
};

/**
 * Score gift relevance based on conversation context (fast, no API call)
 */
export const scoreGiftRelevance = (gift, context = {}) => {
  let score = 0;
  const { budget, recipient, interests = [], personality, occasion } = context;

  if (budget && gift.price > budget) return -1;
  if (recipient && gift.recipients?.includes(recipient.toLowerCase())) score += 40;
  if (occasion && gift.occasion?.toLowerCase() === occasion.toLowerCase()) score += 30;
  if (interests.length > 0) {
    const matched = gift.tags?.filter((tag) => interests.includes(tag.toLowerCase())) || [];
    score += matched.length * 15;
  }
  if (personality && gift.tags?.some((tag) => tag.toLowerCase().includes(personality.toLowerCase()))) score += 25;

  return score;
};

/**
 * Check if Gemini is configured
 */
export const validateAIConfig = () => {
  return {
    geminiConfigured: !!config.geminiApiKey,
    canMakeAIRequests: !!config.geminiApiKey,
  };
};

export const formatConversationHistory = (messages = []) =>
  messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");