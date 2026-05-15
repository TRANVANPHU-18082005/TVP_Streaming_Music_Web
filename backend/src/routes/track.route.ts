// ─────────────────────────────────────────────────────────────────────────────
// routes/track.routes.ts
// ─────────────────────────────────────────────────────────────────────────────
import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import { uploadTrackFiles } from "../config/upload";
import * as trackController from "../controllers/track.controller";
import * as recommendationController from "../controllers/recommendation.controller";

import {
  createTrackSchema,
  updateTrackSchema,
  getTracksSchema,
  changeStatusSchema,
  bulkUpdateTracksSchema,
  getTopTracksSchema,
  getTrackDetailSchema,
  processTrackSchema,
  deleteTrackSchema,
  processTrackBulkSchema,
} from "../validations/track.validation";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES (Static First)
// ==========================================

// 1. Static Paths - Phải đặt trên cùng
router.get("/charts/realtime", trackController.getTopChart);
router.get(
  "/top/hot-today",
  optionalAuth,
  validate(getTopTracksSchema),
  trackController.getTopHotTracksToday,
);

router.get(
  "/top/favourite",
  optionalAuth,
  validate(getTopTracksSchema),
  trackController.getTopFavouriteTracks,
);

// 2. Recommendations - Đặt trước /:id
router.get(
  "/recommendations",
  optionalAuth,
  recommendationController.getRecommendedTracks,
);

// 3. List Tracks
// Lưu ý: Nếu bạn muốn User chưa login vẫn xem được list thì dùng optionalAuth
router.get(
  "/",
  optionalAuth,
  validate(getTracksSchema),
  trackController.getTracks,
);

// ==========================================
// 🔵 DYNAMIC GET ROUTES (Tham số :id)
// ==========================================

// 4. Sub-resource (Similar)
router.get("/:id/similar", recommendationController.getSimilarTracks);

// 5. Detail (Catch-all cho GET)
router.get(
  "/:id",
  optionalAuth,
  validate(getTrackDetailSchema),
  trackController.getTrackDetail,
);

// ==========================================
// 🔴 PROTECTED ROUTES (Admin & Artist)
// ==========================================

router.use(protect);

// --- 1. BULK OPERATIONS (Phải đặt TRƯỚC các route có :id) ---
// Nếu đặt sau, Express sẽ hiểu "bulk" là một cái :id

router.patch(
  "/bulk/update",
  authorize("admin"),
  validate(bulkUpdateTracksSchema),
  trackController.bulkUpdateTracks,
);

// Group các route retry bulk cho gọn
router.post(
  "/bulk/retry/transcode",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryTranscode,
);
router.post(
  "/bulk/retry/lyrics",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryLyrics,
);
router.post(
  "/bulk/retry/karaoke",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryKaraoke,
);
router.post(
  "/bulk/retry/mood",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryMood,
);
router.post(
  "/bulk/retry/full",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryFull,
);

// --- 2. SINGLE RESOURCE ACTIONS ---

// Create Track (POST /)
router.post(
  "/",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(createTrackSchema),
  trackController.uploadTrack,
);

// Change Status (Có prefix riêng nên an toàn, nhưng nên gom nhóm)
router.patch(
  "/change-status/:id",
  authorize("artist", "admin"),
  validate(changeStatusSchema),
  trackController.changeTrackStatus,
);

// --- 3. RETRY OPERATIONS (Single ID) ---

router.post(
  "/:id/retry/full",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryFull,
);
router.post(
  "/:id/retry/transcode",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryTranscode,
);
router.post(
  "/:id/retry/lyrics",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryLyrics,
);
router.post(
  "/:id/retry/karaoke",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryKaraoke,
);
router.post(
  "/:id/retry/mood",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryMoodCanvas,
);

// --- 4. UPDATE & DELETE (Generic ID) ---

router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(updateTrackSchema),
  trackController.updateTrack,
);

router.delete(
  "/:id",
  authorize("artist", "admin"),
  validate(deleteTrackSchema),
  trackController.deleteTrack,
);

export default router;
