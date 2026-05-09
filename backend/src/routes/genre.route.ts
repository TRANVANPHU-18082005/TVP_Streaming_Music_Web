import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as genreController from "../controllers/genre.controller";
import {
  createGenreSchema,
  getGenresByUserSchema,
  updateGenreSchema,
  getGenreDetailSchema,
  getGenreTracksSchema,
  getGenresByAdminSchema,
  toggleGenreStatusSchema,
  deleteGenreSchema,
} from "../validations/genre.validation";
import { uploadImages } from "../config/upload";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================

// 1. GET /api/genres (Lấy danh sách thể loại cho người dùng)
router.get(
  "/",
  optionalAuth,
  validate(getGenresByUserSchema),
  genreController.getGenresByUser,
);
// 1. GET /api/genres (Lấy danh sách thể loại cho Admin)
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getGenresByAdminSchema),
  genreController.getGenresByAdmin,
);
// 2. GET /api/genres/tree (Lấy cây thể loại - Dành cho cả User & Admin)
router.get("/tree", genreController.getTree);
// 3. GET /api/genres/:id/tracks (Lấy danh sách bài hát theo thể loại)
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getGenreTracksSchema),
  genreController.getGenreTracks,
);

// 4. GET /api/genres/:id (Lấy chi tiết thể loại)
router.get(
  "/:slug",
  optionalAuth,
  validate(getGenreDetailSchema),
  genreController.getGenreDetail,
);

// ==========================================
// 🔴 ADMIN ONLY ROUTES
// ==========================================
router.use(protect);
router.use(authorize("admin")); // Chặn toàn bộ bên dưới chỉ cho Admin

// 2. POST /api/genres (Tạo thể loại mới)
router.post(
  "/",
  uploadImages.single("image"),
  validate(createGenreSchema),
  genreController.createGenre,
);

// 3. PATCH /api/genres/:id/toggle (Bật/Tắt hiển thị thể loại)
router.patch(
  "/:id/toggle",
  validate(toggleGenreStatusSchema),
  genreController.toggleGenreStatus,
);

// 4. PATCH /api/genres/:id (Cập nhật thể loại)
router.patch(
  "/:id",
  uploadImages.single("image"),
  validate(updateGenreSchema),
  genreController.updateGenre,
);
// 5. DELETE /api/genres/:id (Xóa thể loại)
router.delete("/:id", validate(deleteGenreSchema), genreController.deleteGenre);
// 6. RESTORE /api/genres/:id/restore (Khôi phục soft-deleted genre)
router.patch(
  "/:id/restore",
  validate(deleteGenreSchema),
  genreController.restoreGenre,
);

export default router;
