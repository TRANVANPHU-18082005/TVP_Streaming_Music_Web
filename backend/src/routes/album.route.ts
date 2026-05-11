import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as albumController from "../controllers/album.controller";

import { uploadImages } from "../config/upload";

import {
  createAlbumSchema,
  deleteAlbumSchema,
  getAlbumByAdminSchema,
  getAlbumDetailSchema,
  getAlbumsByUserSchema,
  getAlbumTracksSchema,
  toggleAlbumPublicSchema,
  updateAlbumSchema,
} from "../validations/album.validation";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC & READ ROUTES (Static & List)
// ==========================================

// 1. Get Albums List (Dành cho User)
router.get(
  "/",
  optionalAuth,
  validate(getAlbumsByUserSchema),
  albumController.getAlbumsByUser,
);

// 2. Get Albums List (Dành cho Admin)
// Phải nằm TRƯỚC /:slug để tránh "admin" bị coi là một slug.
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getAlbumByAdminSchema),
  albumController.getAlbumsByAdmin,
);

// ==========================================
// 🟡 DYNAMIC ROUTES (Parameterized)
// ==========================================

// 3. Sub-resource route (Phức tạp hơn)
// Luôn đặt các route có hậu tố như /tracks lên trước route đơn lẻ /:slug
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getAlbumTracksSchema),
  albumController.getAlbumTracks,
);

// 4. Resource Detail (Đơn lẻ - Catch-all cho GET)
// Đây là "phễu" cuối cùng của phương thức GET.
router.get(
  "/:slug",
  optionalAuth,
  validate(getAlbumDetailSchema),
  albumController.getAlbumDetail,
);

// ==========================================
// 🔴 PROTECTED ACTIONS (Cần Token)
// ==========================================

router.use(protect); // Middleware chặn mọi request không có Token từ đây trở xuống

// 5. Create Album (POST /)
router.post(
  "/",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(createAlbumSchema),
  albumController.createAlbum,
);

// 6. Restore Album (Admin - Cụ thể hơn nên đặt trên)
router.patch(
  "/:id/restore",
  authorize("admin"),
  validate(deleteAlbumSchema),
  albumController.restoreAlbum,
);

// 7. Toggle Public Status (Action cụ thể)
router.patch(
  "/:id/toggle-public",
  authorize("artist", "admin"),
  validate(toggleAlbumPublicSchema),
  albumController.toggleAlbumPublic,
);

// 8. Update Album (Tổng quát cho PATCH)
// Đặt dưới các PATCH có hậu tố cụ thể để tránh xung đột
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(updateAlbumSchema),
  albumController.updateAlbum,
);

// 9. Delete Album
router.delete(
  "/:id",
  authorize("artist", "admin"),
  validate(deleteAlbumSchema),
  albumController.deleteAlbum,
);

export default router;