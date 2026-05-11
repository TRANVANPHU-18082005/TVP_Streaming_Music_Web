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
// 🟢 PUBLIC ROUTES (Static First)
// ==========================================

// 1. Route tĩnh hoàn toàn - Đặt lên đầu
router.get("/tree", genreController.getTree);

// 2. Route Admin (vẫn là tĩnh so với các route có tham số)
// Lưu ý: Route này dùng protect/authorize riêng lẻ vì nó nằm trong cụm Public
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getGenresByAdminSchema),
  genreController.getGenresByAdmin,
);

// 3. Route lấy danh sách chung
router.get(
  "/",
  optionalAuth,
  validate(getGenresByUserSchema),
  genreController.getGenresByUser,
);

// ==========================================
// 🟡 DYNAMIC ROUTES (Parameterized)
// ==========================================

// 4. Phải đặt route có hậu tố (/tracks) TRƯỚC route chỉ có slug
// Nếu không, khi gọi /lofi/tracks, Express sẽ hiểu "lofi" là slug và bỏ qua phần /tracks
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getGenreTracksSchema),
  genreController.getGenreTracks,
);

// 5. Route chi tiết (Slug) - Đặt dưới cùng của cụm GET
// Vì :slug có thể khớp với bất kỳ chuỗi nào (kể cả "admin" hay "tree" nếu đặt sai chỗ)
router.get(
  "/:slug",
  optionalAuth,
  validate(getGenreDetailSchema),
  genreController.getGenreDetail,
);

// ==========================================
// 🔴 ADMIN ONLY ROUTES (Write Operations)
// ==========================================
// Sử dụng middleware tập trung cho toàn bộ các route phía dưới
router.use(protect);
router.use(authorize("admin"));

router.post(
  "/",
  uploadImages.single("image"),
  validate(createGenreSchema),
  genreController.createGenre,
);

// Gom các route có cùng cấu trúc :id lại gần nhau
router.patch(
  "/:id/toggle",
  validate(toggleGenreStatusSchema),
  genreController.toggleGenreStatus,
);

router.patch(
  "/:id/restore",
  validate(deleteGenreSchema),
  genreController.restoreGenre,
);

router.patch(
  "/:id",
  uploadImages.single("image"),
  validate(updateGenreSchema),
  genreController.updateGenre,
);

router.delete(
  "/:id", 
  validate(deleteGenreSchema), 
  genreController.deleteGenre
);

export default router;