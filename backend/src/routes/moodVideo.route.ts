import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as moodVideoController from "../controllers/moodVideo.controller";
import {
  createMoodVideoSchema,
  updateMoodVideoSchema,
  getMoodVideosSchema,
} from "../validations/moodVideo.validation";
import { uploadImages, uploadVideoCanvas } from "../config/upload"; // Ta sẽ tạo thêm uploadVideo bên dưới

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================
router.get(
  "/",
  validate(getMoodVideosSchema),
  moodVideoController.getMoodVideos,
);

// ==========================================
// 🔴 PROTECTED ROUTES (Admin Only)
// ==========================================
router.use(protect);
router.use(authorize("admin")); // Thường chỉ Admin quản lý thư viện Mood chung

router.post("/", uploadVideoCanvas, moodVideoController.createMoodVideo);

router.patch(
  "/:id",
  uploadVideoCanvas,
  validate(updateMoodVideoSchema),
  moodVideoController.updateMoodVideo,
);

router.delete("/:id", moodVideoController.deleteMoodVideo);

export default router;
