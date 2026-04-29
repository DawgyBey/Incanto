/**
 * routes/gifts.js
 *
 * All /api/v1/gifts/* endpoints.
 */

import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { recommendations } from "../controllers/giftController.js";

const router = Router();

// GET /api/v1/gifts/recommendations
// Auth is optional — if present, saved preferences are used as defaults.
router.get("/recommendations", optionalAuth, recommendations);

export default router;
