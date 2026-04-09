import express from "express";
import {
  protect,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as artistController from "../controllers/artist.controller";

// Import Schemas
import {
  createArtistSchema,
  updateArtistSchema,
  getArtistsSchema,
} from "../validations/artist.validation";
import { uploadArtistFiles } from "../config/upload";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================

// Lấy danh sách (Có validate filter)
router.get(
  "/",
  optionalAuth,
  validate(getArtistsSchema),
  artistController.getArtists,
);

// Xem chi tiết (Optional Auth để check Follow status)
router.get("/:id", optionalAuth, artistController.getArtistDetail);
// (Get Tracks) api/artists/:id/tracks?page=?&limit=?
router.get("/:id/tracks", optionalAuth, artistController.getArtistTracks);

// ==========================================
// 🟠 PROTECTED ROUTES
// ==========================================
router.use(protect);

// --- 1. ARTIST SELF-MANAGEMENT (/me) ---
// Route tĩnh phải đặt TRƯỚC route động /:id

router.get("/me/profile", authorize("artist"), artistController.getMyProfile);

router.patch(
  "/me/profile",
  authorize("artist"),
  uploadArtistFiles, // Dùng config fields mới
  validate(updateArtistSchema), // Tái sử dụng schema update
  artistController.updateMyProfile,
);

// --- 2. ADMIN MANAGEMENT ---

// Create
router.post(
  "/",
  authorize("admin"),
  uploadArtistFiles, // Upload ảnh trước -> Validate Body sau
  validate(createArtistSchema),
  artistController.createArtist,
);

// Toggle Status
router.patch("/:id/toggle", authorize("admin"), artistController.toggleStatus);

// Update & Delete by ID
router
  .route("/:id")
  .patch(
    authorize("admin"),
    uploadArtistFiles,
    validate(updateArtistSchema),
    artistController.updateArtist,
  )
  .delete(authorize("admin"), artistController.deleteArtist);

export default router;
