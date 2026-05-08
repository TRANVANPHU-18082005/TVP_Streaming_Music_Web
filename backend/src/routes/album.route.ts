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
// 🟢 STATIC ROUTES (Phải đặt TRƯỚC các route có tham số :id)
// ==========================================

// 1. Get Albums (Public & Optional Auth)
router.get(
  "/",
  optionalAuth,
  validate(getAlbumsByUserSchema),
  albumController.getAlbumsByUser,
);

// 2. Get Albums (Admin) - Đặt TRƯỚC /:id để không bị nhầm admin là một slug/id
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getAlbumByAdminSchema),
  albumController.getAlbumsByAdmin,
);

// ==========================================
// 🔵 DYNAMIC ROUTES (Các route chứa tham số :id)
// ==========================================
// 4. Get Album Tracks
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getAlbumTracksSchema),
  albumController.getAlbumTracks,
);
// 3. Get Album Detail
router.get(
  "/:slug",
  optionalAuth,
  validate(getAlbumDetailSchema),
  albumController.getAlbumDetail,
);

// ==========================================
// 🔴 PROTECTED ACTIONS (Cần đăng nhập)
// ==========================================

router.use(protect); // Từ đây trở xuống tất cả đều cần Token

// 5. Create Album
router.post(
  "/",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(createAlbumSchema),
  albumController.createAlbum,
);

// 6. Update Album
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(updateAlbumSchema),
  albumController.updateAlbum,
);

// 7. Toggle Public Status (Nên đặt trước Delete để đồng nhất)
router.patch(
  "/:id/toggle-public",
  authorize("artist", "admin"),
  validate(toggleAlbumPublicSchema),
  albumController.toggleAlbumPublic,
);

// 8. Delete Album
router.delete(
  "/:id",
  authorize("artist", "admin"),
  validate(deleteAlbumSchema),
  albumController.deleteAlbum,
);

export default router;
