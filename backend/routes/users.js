/**
 * routes/users.js
 *
 * All /api/v1/users/* endpoints.
 * Auth logic → middleware/auth.js
 * Business logic → controllers/userController.js
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  register,
  login,
  loginWithGoogle,
  getProfile,
  savePreferences,
  savePersonalInfo,
  addGiftToCart,
  removeGiftFromCart,
  addRecentlyViewed,
} from "../controllers/userController.js";

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/google", loginWithGoogle);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/profile", requireAuth, getProfile);

// ── Preferences ───────────────────────────────────────────────────────────────
router.post("/preferences", requireAuth, savePreferences);

// ── Personal Info ─────────────────────────────────────────────────────────────
router.post("/personal-info", requireAuth, savePersonalInfo);
router.put("/personal-info", requireAuth, savePersonalInfo);

// ── Cart ──────────────────────────────────────────────────────────────────────
router.post("/cart", requireAuth, addGiftToCart);
router.delete("/cart/:id", requireAuth, removeGiftFromCart);

// ── Recently Viewed ───────────────────────────────────────────────────────────
router.post("/recently-viewed", requireAuth, addRecentlyViewed);

// ── Route listing (dev convenience) ──────────────────────────────────────────
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Users API is running",
    routes: {
      "POST /register": "Create a new account",
      "POST /login": "Log in with email + password",
      "POST /google": "Log in with Google credential",
      "GET /profile": "Get authenticated user profile [auth]",
      "POST /preferences": "Save gift preferences [auth]",
      "POST /personal-info": "Save personal info [auth]",
      "PUT /personal-info": "Update personal info [auth]",
      "POST /cart": "Add gift to cart [auth]",
      "DELETE /cart/:id": "Remove gift from cart [auth]",
      "POST /recently-viewed": "Track a viewed gift [auth]",
    },
  });
});

export default router;
