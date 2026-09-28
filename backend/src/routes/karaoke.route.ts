// routes/karaoke.route.ts

import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import slugify from "slugify";
import { protect, optionalAuth, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as karaokeController from "../controllers/karaoke.controller";
import * as karaokeValidation from "../validations/karaoke.validation";
import { s3 } from "../config/storage";
import config from "../config/env";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// MULTER: Upload audio karaoke trực tiếp lên B2
// ─────────────────────────────────────────────────────────────────────────────

const karaokeAudioUpload = multer({
  storage: multerS3({
    s3: s3,
    bucket: config.b2.bucketName as string,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: "public-read",
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname, uploadType: "karaoke" });
    },
    key: (req: any, file, cb) => {
      const userId = req.user?._id || "unknown";
      const ext = path.extname(file.originalname).toLowerCase() || ".webm";
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);

      // Cấu trúc: karaoke/recordings/<userId>/<timestamp>-<random>.webm
      const finalPath = `karaoke/recordings/${userId}/${timestamp}-${randomSuffix}${ext}`;
      cb(null, finalPath);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB hard limit (soft limit checked by permission)
  },
  fileFilter: (req, file, cb) => {
    // Chỉ chấp nhận audio files
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "video/webm" // Browser recorder thường tạo video/webm
    ) {
      cb(null, true);
    } else {
      cb(new ApiError(httpStatus.BAD_REQUEST, "Chỉ chấp nhận file audio (webm, mp3, wav, ogg)"));
    }
  },
}).single("audio"); // Field name: "audio"

// ─────────────────────────────────────────────────────────────────────────────
// USER ROUTES: Recordings
// ─────────────────────────────────────────────────────────────────────────────

/** Tìm kiếm Youtube Karaoke */
router.get(
  "/search-youtube",
  optionalAuth,
  karaokeController.searchYoutube,
);

/** Check quyền upload karaoke của user hiện tại */
router.get(
  "/my-permission",
  protect,
  karaokeController.getMyPermission,
);

/** Recordings của user hiện tại */
router.get(
  "/my-recordings",
  protect,
  validate(karaokeValidation.getRecordingsSchema),
  karaokeController.getMyRecordings,
);

/** Danh sách recordings public (feed cộng đồng) */
router.get(
  "/recordings",
  optionalAuth,
  validate(karaokeValidation.getRecordingsSchema),
  karaokeController.getPublicRecordings,
);

/** Chi tiết recording */
router.get(
  "/recordings/:id",
  optionalAuth,
  validate(karaokeValidation.getRecordingDetailSchema),
  karaokeController.getRecordingById,
);

/** Upload recording mới (audio file + metadata) */
router.post(
  "/recordings",
  protect,
  karaokeAudioUpload,
  validate(karaokeValidation.uploadRecordingSchema),
  karaokeController.uploadRecording,
);

/** Cập nhật metadata recording */
router.patch(
  "/recordings/:id",
  protect,
  validate(karaokeValidation.updateRecordingSchema),
  karaokeController.updateRecording,
);

/** Gửi yêu cầu duyệt recording */
router.post(
  "/recordings/:id/submit",
  protect,
  validate(karaokeValidation.submitForReviewSchema),
  karaokeController.submitForReview,
);

/** Xóa recording */
router.delete(
  "/recordings/:id",
  protect,
  validate(karaokeValidation.deleteRecordingSchema),
  karaokeController.deleteRecording,
);

/** Toggle Like bản thu */
router.post(
  "/recordings/:id/like",
  protect,
  karaokeController.toggleLike,
);

/** Tăng lượt nghe */
router.post(
  "/recordings/:id/play",
  karaokeController.incrementPlayCount,
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES: Permission Management
// ─────────────────────────────────────────────────────────────────────────────

/** Danh sách permissions */
router.get(
  "/admin/permissions",
  protect,
  authorize("admin"),
  validate(karaokeValidation.getPermissionsSchema),
  karaokeController.getPermissions,
);

/** Cấp/cập nhật quyền upload cho user */
router.post(
  "/admin/permissions/:userId",
  protect,
  authorize("admin"),
  validate(karaokeValidation.grantPermissionSchema),
  karaokeController.grantPermission,
);

/** Thu hồi quyền upload */
router.delete(
  "/admin/permissions/:userId",
  protect,
  authorize("admin"),
  validate(karaokeValidation.revokePermissionSchema),
  karaokeController.revokePermission,
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES: Recording Review
// ─────────────────────────────────────────────────────────────────────────────

/** Danh sách recordings cho admin */
router.get(
  "/admin/recordings",
  protect,
  authorize("admin"),
  validate(karaokeValidation.adminGetRecordingsSchema),
  karaokeController.adminGetRecordings,
);

/** Duyệt/từ chối recording */
router.patch(
  "/admin/recordings/:id/review",
  protect,
  authorize("admin"),
  validate(karaokeValidation.adminReviewSchema),
  karaokeController.adminReviewRecording,
);

/** Thống kê tổng quan karaoke */
router.get(
  "/admin/stats",
  protect,
  authorize("admin"),
  karaokeController.adminGetStats,
);

export default router;
