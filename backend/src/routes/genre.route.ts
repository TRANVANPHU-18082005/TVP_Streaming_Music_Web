import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate"; // Middleware Validation
import * as genreController from "../controllers/genre.controller";
import {
  createGenreSchema,
  getGenresSchema,
  updateGenreSchema,
} from "../validations/genre.validation";
import { uploadImages } from "../config/upload";

// Import Schema Validation (Giả sử bạn đã tạo file này tương tự các module khác)
// Nội dung schema nên check: name (bắt buộc), color (hex code), description...

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================

// Lấy danh sách (Validate query params như page, limit...)
router.get("/", validate(getGenresSchema), genreController.getGenres);
// GET /api/genres/:slug
router.get("/tree", genreController.getTree);
router.get("/:slug", genreController.getGenreDetail);
// ==========================================
// 🔴 ADMIN ONLY ROUTES
// ==========================================
router.use(protect);
router.use(authorize("admin")); // Chặn toàn bộ bên dưới chỉ cho Admin

// Create Genre
// Lưu ý thứ tự: Upload ảnh trước -> Rồi mới Validate Body
router.post(
  "/",
  uploadImages.single("image"),
  validate(createGenreSchema),
  genreController.createGenre,
);

// Toggle Status (Active/Inactive)
router.patch("/:id/toggle", genreController.toggleGenreStatus);

// Update & Delete
router
  .route("/:id")
  .patch(
    // Đổi PUT -> PATCH cho đúng chuẩn update 1 phần
    uploadImages.single("image"),
    validate(updateGenreSchema),
    genreController.updateGenre,
  )
  .delete(genreController.deleteGenre);

export default router;
