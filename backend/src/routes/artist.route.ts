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
  deleteArtistSchema,
  getArtistDetailSchema,
  getArtistsByAdminSchema,
  getArtistsByUserSchema,
  getArtistTracksSchema,
  toggleArtistStatusSchema,
  updateArtistSchema,
} from "../validations/artist.validation";
import { uploadArtistFiles } from "../config/upload";
import { get } from "http";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================

// 1. Lấy danh sách bởi user (Có validate filter)
router.get(
  "/",
  optionalAuth,
  validate(getArtistsByUserSchema),
  artistController.getArtistsByUser,
);
// 2. Lấy danh sách bởi admin (Có thêm filter isActive, isVerified)
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getArtistsByAdminSchema),
  artistController.getArtistsByAdmin,
);
// 4. Lấy danh sách track của nghệ sĩ
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getArtistTracksSchema),
  artistController.getArtistTracks,
);

// 3. Lấy chi tiết nghệ sĩ
router.get(
  "/:slug",
  optionalAuth,
  validate(getArtistDetailSchema),
  artistController.getArtistDetail,
);

// ==========================================
// 🟠 PROTECTED ROUTES
// ==========================================
router.use(protect);

// 5 . Lấy profile của chính nghệ sĩ đang đăng nhập
router.get("/me/profile", authorize("artist"), artistController.getMyProfile);
// 6. Cập nhật profile của chính nghệ sĩ đang đăng nhập
router.patch(
  "/me/profile",
  authorize("artist"),
  uploadArtistFiles, // Dùng config fields mới
  validate(updateArtistSchema), // Tái sử dụng schema update
  artistController.updateMyProfile,
);

// 7. Tao nghệ sĩ mới (Admin)
router.post(
  "/",
  authorize("admin"),
  uploadArtistFiles, // Upload ảnh trước -> Validate Body sau
  validate(createArtistSchema),
  artistController.createArtist,
);

// 8. Cập nhật nghệ sĩ (Admin)
router
  .route("/:id")
  .patch(
    authorize("admin"),
    uploadArtistFiles,
    validate(updateArtistSchema),
    artistController.updateArtist,
  )
  .delete(
    authorize("admin"),
    validate(deleteArtistSchema),
    artistController.deleteArtist,
  );
// 9. Toggle Artist Status (Admin)
router.patch(
  "/:id/toggle",
  authorize("admin"),
  validate(toggleArtistStatusSchema),
  artistController.toggleStatus,
);

export default router;
