/**
 * controllers/giftController.js
 *
 * Handles HTTP req/res for gift-related routes.
 * Scoring logic lives in services/giftService.js.
 */

import { createError } from "../middleware/errorHandler.js";
import { getUserPreferences } from "../services/userService.js";
import { getRecommendations } from "../services/giftService.js";

export const recommendations = async (req, res, next) => {
  try {
    const { budget, recipient, interests, personality, occasion, limit = 10, page = 1 } = req.query;

    // If the user is authenticated, load their saved preferences as defaults
    let savedPrefs = {};
    if (req.user) {
      savedPrefs = (await getUserPreferences(req.user.id)) || {};
    }

    // Query params always override saved prefs
    const resolvedBudget =
      budget !== undefined ? parseFloat(budget) : savedPrefs.budget ?? null;
    const resolvedRecipient =
      recipient !== undefined ? recipient : savedPrefs.recipient ?? null;
    const resolvedInterests =
      interests !== undefined
        ? String(interests).split(",").map((i) => i.trim().toLowerCase())
        : savedPrefs.interests ?? [];
    const resolvedPersonality =
      personality !== undefined ? personality : savedPrefs.personality ?? null;
    const resolvedOccasion =
      occasion !== undefined ? occasion : savedPrefs.occasion ?? null;

    if (resolvedBudget !== null && (isNaN(resolvedBudget) || resolvedBudget < 0)) {
      return next(createError("Budget must be a non-negative number.", 400));
    }

    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    const parsedPage = Math.max(parseInt(page) || 1, 1);

    const result = await getRecommendations(
      {
        budget: resolvedBudget,
        recipient: resolvedRecipient,
        interests: resolvedInterests,
        personality: resolvedPersonality,
        occasion: resolvedOccasion,
      },
      { limit: parsedLimit, page: parsedPage }
    );

    res.json({
      success: true,
      message: "Recommendations retrieved successfully.",
      data: {
        appliedFilters: {
          budget: resolvedBudget,
          recipient: resolvedRecipient,
          interests: resolvedInterests,
          personality: resolvedPersonality,
          occasion: resolvedOccasion,
        },
        ...result,
      },
    });
  } catch (err) {
    next(err);
  }
};
