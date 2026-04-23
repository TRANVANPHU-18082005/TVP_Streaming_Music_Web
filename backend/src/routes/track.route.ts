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
} from "../validations/track.validation";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// 1. Các route TĨNH (Fixed paths) lên trên cùng
router.get(
  "/",
  optionalAuth,
  validate(getTracksSchema),
  trackController.getTracks,
);
router.get("/charts/realtime", trackController.getTopChart);
router.get(
  "/recommendations",
  optionalAuth,
  recommendationController.getRecommendedTracks,
);

// 2. Các route ĐỘNG (Dynamic paths) nằm dưới
// Lưu ý: :slugOrId/similar phải nằm TRƯỚC /:id nếu không muốn bị xung đột
router.get("/:id/similar", recommendationController.getSimilarTracks);
router.get("/:id", optionalAuth, trackController.getTrackDetail);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.use(protect);

// ── Upload ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(createTrackSchema),
  trackController.uploadTrack,
);

// ── Bulk (trước /:id để tránh conflict) ──────────────────────────────────────
router.patch(
  "/bulk/update",
  authorize("admin"),
  validate(bulkUpdateTracksSchema),
  trackController.bulkUpdateTracks,
);

// ── Status ────────────────────────────────────────────────────────────────────
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
router.post("/:id/retry/full", authorize("admin"), trackController.retryFull);
router.post(
  "/:id/retry/transcode",
  authorize("admin"),
  trackController.retryTranscode,
);
router.post(
  "/:id/retry/lyrics",
  authorize("admin"),
  trackController.retryLyrics,
);
router.post(
  "/:id/retry/karaoke",
  authorize("admin"),
  trackController.retryKaraoke,
);
router.post(
  "/:id/retry/mood",
  authorize("admin"),
  trackController.retryMoodCanvas,
);

// ── Update ────────────────────────────────────────────────────────────────────
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadTrackFiles,
  validate(updateTrackSchema),
  trackController.updateTrack,
);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("artist", "admin"),
  trackController.deleteTrack,
);

export default router;
