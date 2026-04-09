import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as albumController from "../controllers/album.controller";

// Import Schemas
import {
  createAlbumSchema,
  updateAlbumSchema,
  getAlbumsSchema,
} from "../validations/album.validation";
import { uploadImages } from "../config/upload";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC / OPTIONAL AUTH ROUTES
// ==========================================

// (Get) api/albums?isPublic=?&page=?&type=?&genreId=?&artistId=?&year=? (Lấy danh sách album với phân trang, lọc, sắp xếp)
router.get(
  "/",
  optionalAuth,
  validate(getAlbumsSchema),
  albumController.getAlbums,
);

// (Get Detail Album) api/albums/:id
router.get("/:id", optionalAuth, albumController.getAlbumDetail);
// (Get Album Tracks) api/albums/:id/tracks?page=?&limit=?
router.get("/:id/tracks", optionalAuth, albumController.getAlbumTracks);

// ==========================================
// 🔴 PROTECTED ROUTES (Artist & Admin)
// ==========================================

router.use(protect);

// (Post) api/albums
router.post(
  "/",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(createAlbumSchema),
  albumController.createAlbum,
);

// (Patch) api/albums/:id
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(updateAlbumSchema),
  albumController.updateAlbum,
);

// (Delete) api/albums/:id
router.delete(
  "/:id",
  authorize("artist", "admin"),
  albumController.deleteAlbum,
);

export default router;
