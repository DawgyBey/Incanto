import express from "express";

import userRoutes from "./users.js";
import giftRoutes from "./gifts.js";

const router = express.Router();

// mount feature routes
router.use("/users", userRoutes);
router.use("/gifts", giftRoutes);

// optional root check
router.get("/", (req, res) => {
    res.json({ success: true, message: "API v1 root" });
});

export default router;