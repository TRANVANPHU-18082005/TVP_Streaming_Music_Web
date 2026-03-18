// src/routes/analytics.route.ts
import { Router } from "express";
import analyticsController from "../controllers/analytics.controller";
import { authorize, protect } from "../middlewares/auth.middleware";

const router = Router();

// Route cho Admin Dashboard
router.get(
  "/realtime",
  protect,
  authorize("admin"),
  analyticsController.getRealtimeStats,
);
router.post(
  "/sync-now",
  protect,
  authorize("admin"),
  analyticsController.forceSyncViews,
);
router.get("/my-profile", protect, analyticsController.getFullUserProfile);
// Route cho Client (User thường) - Cực kỳ quan trọng để đếm Online
router.post("/heartbeat", protect, analyticsController.userHeartbeat);

export default router;
