import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import { uploadTrackFiles } from "../config/upload";
import * as trackController from "../controllers/track.controller";

// Import Schemas
import {
  createTrackSchema,
  updateTrackSchema,
  getTracksSchema,
  changeStatusSchema,
  bulkUpdateTracksSchema, // 🔥 IMPORT MỚI
} from "../validations/track.validation";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================
router.get(
  "/",
  optionalAuth,
  validate(getTracksSchema),
  trackController.getTracks
);
router.get("/charts/realtime", trackController.getTopChart); // 🔥 Route này
router.get("/:id", optionalAuth, trackController.getTrackDetail);

// ==========================================
// 🟠 PROTECTED ROUTES (Artist & Admin)
// ==========================================
router.use(protect);

// 1. UPLOAD
router.post(
  "/",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(createTrackSchema),
  trackController.uploadTrack
);

// 2. BULK OPERATIONS (🔥 NEW SECTION)
// Đặt trước route /:id để tránh xung đột
router.patch(
  "/bulk/update",
  authorize("admin"), // Thường chỉ Admin mới được làm Bulk Update để an toàn
  validate(bulkUpdateTracksSchema), // Validate input chặt chẽ
  trackController.bulkUpdateTracks
);

// 3. SINGLE UPDATE & ACTIONS
router.patch(
  "/change-status/:id",
  authorize("artist", "admin"),
  validate(changeStatusSchema),
  trackController.changeTrackStatus
);

router.post("/:id/retry", authorize("admin"), trackController.retryTranscode);

// Update chi tiết bài hát (File, Metadata)
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(updateTrackSchema),
  trackController.updateTrack
);

// 4. DELETE
router.delete(
  "/:id",
  authorize("artist", "admin"),
  trackController.deleteTrack
);

export default router;
