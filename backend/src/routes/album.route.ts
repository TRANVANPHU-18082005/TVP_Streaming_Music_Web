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

// Get List (Có validate query params)
router.get("/", validate(getAlbumsSchema), albumController.getAlbums);

// Get Detail
// 🔥 Cần optionalAuth để biết ai đang xem (check quyền Private Album)
router.get("/:id", optionalAuth, albumController.getAlbumDetail);

// ==========================================
// 🔴 PROTECTED ROUTES (Artist & Admin)
// ==========================================
router.use(protect);

// Create Album
router.post(
  "/",
  authorize("artist", "admin"), // Chỉ Artist hoặc Admin
  uploadImages.single("coverImage"),
  validate(createAlbumSchema), // Validate Body sau khi Multer xử lý xong
  albumController.createAlbum
);

// Update Album
router.patch(
  "/:id",
  authorize("artist", "admin"),
  uploadImages.single("coverImage"),
  validate(updateAlbumSchema),
  albumController.updateAlbum
);

// Delete Album
router.delete(
  "/:id",
  authorize("artist", "admin"),
  albumController.deleteAlbum
);

export default router;
