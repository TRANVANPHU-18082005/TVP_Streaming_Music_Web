import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import { syncSystemStats } from "../controllers/system.controller";

const router = express.Router();

router.use(protect);
router.use(authorize("admin")); // Chỉ Admin tối cao mới được chạy

// Route Sync Stats
router.post("/system/sync-stats", syncSystemStats);

export default router;
