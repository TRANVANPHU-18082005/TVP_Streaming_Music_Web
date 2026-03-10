import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import { uploadImages } from "../config/upload";
import * as controller from "../controllers/verification.controller"; // Bạn tự viết controller gọi service nhé

const router = express.Router();

// User gửi yêu cầu
router.post(
  "/submit",
  protect,
  uploadImages.array("idCardImages", 2), // Upload 2 ảnh CCCD
  // validate(submitVerificationSchema), // Nhớ thêm middleware validate
  controller.submitRequest
);

// Admin xem danh sách (status = pending/approved/rejected)
router.get("/", protect, authorize("admin"), controller.getRequests);

// Admin duyệt/từ chối
router.post(
  "/:id/review",
  protect,
  authorize("admin"),
  // validate(reviewVerificationSchema),
  controller.reviewRequest
);

export default router;
