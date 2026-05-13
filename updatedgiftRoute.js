import { Router } from "express";
import { getRecommendations } from "../services/recommendationService.js";
import { createError } from "../middleware/errorHandler.js";
import { searchDaraz } from "../services/darazService.js"; // We will create this next!

const router = Router();

// 1. YOUR ORIGINAL ROUTE (Recommendations)
router.get("/recommendations", async (req, res, next) => {
  try {
    const { budget, recipient, interests, personality, occasion, limit = 10, page = 1 } = req.query;

    const resolvedBudget = budget !== undefined ? parseFloat(budget) : null;
    const resolvedRecipient = recipient !== undefined ? recipient : null;
    const resolvedInterests = interests !== undefined 
        ? String(interests).split(",").map((i) => i.trim().toLowerCase()) 
        : [];
    const resolvedPersonality = personality !== undefined ? personality : null;
    const resolvedOccasion = occasion !== undefined ? occasion : null;

    if (resolvedBudget !== null && (isNaN(resolvedBudget) || resolvedBudget < 0)) {
      return next(createError("Budget must be a non-negative number.", 400));
    }

    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    const parsedPage = Math.max(parseInt(page) || 1, 1);

    const recommendations = await getRecommendations(
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
        ...recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. NEW ROUTE: REAL-TIME DARAZ SEARCH
// This route is what your "Find Gifts" button will call
router.get("/external-search/:keyword", async (req, res, next) => {
    try {
        const keyword = req.params.keyword;
        const darazItems = await searchDaraz(keyword);
        
        res.json({
            success: true,
            message: `Found gifts on Daraz for: ${keyword}`,
            data: darazItems
        });
    } catch (err) {
        next(createError("Failed to fetch from Daraz", 500));
    }
});

export default router;