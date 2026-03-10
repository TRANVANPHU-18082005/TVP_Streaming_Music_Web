import { Router } from "express";
import analyticsController from "../controllers/analytics.controller";
// Giả sử bạn có middleware check admin
import { authorize, protect } from "../middlewares/auth.middleware";

const router = Router();

// Route: /api/analytics/realtime
// Chỉ Admin mới được xem số liệu này
router.get(
  "/realtime",
  protect,
  authorize("admin"),
  analyticsController.getRealtimeStats
);

// (Optional) Trigger sync thủ công
router.post(
  "/sync-now",
  protect,
  authorize("admin"),
  analyticsController.forceSyncViews
);

export default router;
