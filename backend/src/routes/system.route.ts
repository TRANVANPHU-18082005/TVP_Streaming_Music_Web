// Not registered in routes/index.ts.
// cron/maintenance.ts calls systemService.syncAll() at 03:00 Asia/Ho_Chi_Minh.
// Mount this router only if a task explicitly adds a second trigger for that sync.
import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import { syncSystemStats } from "../controllers/system.controller";

const router = express.Router();

router.use(protect);
router.use(authorize("admin")); // Chỉ Admin tối cao mới được chạy

// Route Sync Stats
router.post("/system/sync-stats", syncSystemStats);

export default router;
