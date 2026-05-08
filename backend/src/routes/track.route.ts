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
  bulkRetryTracksSchema,
  getTrackDetailSchema,
  processTrackSchema,
  deleteTrackSchema,
  processTrackBulkSchema,
} from "../validations/track.validation";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// 1. GET /tracks → Danh sách bài hát với filter, search, pagination
router.get("/", protect, validate(getTracksSchema), trackController.getTracks);
// 2. GET /tracks/charts/realtime → Top 100 realtime chart (không cần auth)
router.get("/charts/realtime", trackController.getTopChart);
// 3. GET /tracks/recommendations → Gợi ý bài hát cho người dùng (có/không auth đều được)
router.get(
  "/recommendations",
  optionalAuth,
  recommendationController.getRecommendedTracks,
);

// 4. GET /tracks/:id/similar → Bài hát tương tự (dựa trên nghệ sĩ, thể loại, mood...)
router.get("/:id/similar", recommendationController.getSimilarTracks);
// 5. GET /tracks/:id → Chi tiết bài hát (slug hoặc id, có thể trả về 404 nếu bài hát chưa public hoặc không ready)
router.get(
  "/:id",
  optionalAuth,
  validate(getTrackDetailSchema),
  trackController.getTrackDetail,
);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.use(protect);

// 1. POST /tracks → Upload bài hát mới (artist, admin)
router.post(
  "/",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(createTrackSchema),
  trackController.uploadTrack,
);

// 2. PATCH /tracks/:id → Cập nhật thông tin bài hát (artist chỉ được chỉnh bài của mình, admin được chỉnh tất cả)
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(updateTrackSchema),
  trackController.updateTrack,
);
// 3. PATCH /tracks/bulk/update → Cập nhật thông tin nhiều bài hát cùng lúc (admin)
router.patch(
  "/bulk/update",
  authorize("admin"),
  validate(bulkUpdateTracksSchema),
  trackController.bulkUpdateTracks,
);

// 4. POST /tracks/bulk/retry → Queue lại các job xử lý cho nhiều track cùng lúc (admin)
router.post(
  "/bulk/retry/transcode",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryTranscode,
);
// 5. POST /tracks/bulk/retry/lyrics → Queue lại job xử lý lyrics cho nhiều track cùng lúc (admin)
router.post(
  "/bulk/retry/lyrics",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryLyrics,
);
// 6. POST /tracks/bulk/retry/karaoke → Queue lại job xử lý karaoke cho nhiều track cùng lúc (admin)
router.post(
  "/bulk/retry/karaoke",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryKaraoke,
);
// 7. POST /tracks/bulk/retry/mood → Queue lại job xử lý mood canvas cho nhiều track cùng lúc (admin)
router.post(
  "/bulk/retry/mood",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryMood,
);
// 8. POST /tracks/bulk/retry/full → Queue lại job xử lý full (xoá HLS + lyrics) cho nhiều track cùng lúc (admin)
router.post(
  "/bulk/retry/full",
  authorize("admin"),
  validate(processTrackBulkSchema),
  trackController.bulkRetryFull,
);
// 9. PATCH /tracks/change-status/:id → Thay đổi trạng thái bài hát (ready, failed) và lưu lý do nếu failed (admin)
router.patch(
  "/change-status/:id",
  authorize("artist", "admin"),
  validate(changeStatusSchema),
  trackController.changeTrackStatus,
);

// ── Retry operations (admin only) ─────────────────────────────────────────────
//
//  POST /:id/retry/full       → xoá HLS + lyrics → full re-process
//  POST /:id/retry/transcode  → chỉ HLS, giữ lyrics & mood
//  POST /:id/retry/lyrics     → chỉ LRCLIB + karaoke fallback
//  POST /:id/retry/karaoke    → chỉ forced alignment (cần plainLyrics trong DB)
//  POST /:id/retry/mood       → chỉ mood canvas (không download audio)
//

// 10. BULK RETRY ENDPOINTS (Admin) - Queue lại các job xử lý cho nhiều track cùng lúc
router.post(
  "/:id/retry/full",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryFull,
);
// 11. POST /:id/retry/transcode → Queue lại job transcode cho 1 track
router.post(
  "/:id/retry/transcode",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryTranscode,
);
// 12. POST /:id/retry/lyrics → Queue lại job xử lý lyrics cho 1 track
router.post(
  "/:id/retry/lyrics",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryLyrics,
);
// 13. POST /:id/retry/karaoke → Queue lại job xử lý karaoke cho 1 track (cần plainLyrics trong DB)
router.post(
  "/:id/retry/karaoke",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryKaraoke,
);
// 14. POST /:id/retry/mood → Queue lại job xử lý mood canvas cho 1 track
router.post(
  "/:id/retry/mood",
  authorize("admin"),
  validate(processTrackSchema),
  trackController.retryMoodCanvas,
);
// 15. POST /:id/retry/full → Queue lại job xử lý full (xoá HLS + lyrics) cho 1 track
router.delete(
  "/:id",
  authorize("artist", "admin"),
  validate(deleteTrackSchema),
  trackController.deleteTrack,
);

export default router;
