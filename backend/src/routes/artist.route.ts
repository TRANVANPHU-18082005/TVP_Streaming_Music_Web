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
const router = express.Router();

// ==========================================
// 🟢 PUBLIC & SPECIAL LIST ROUTES (Static First)
// ==========================================

// 1. Lấy danh sách cho User
router.get(
  "/",
  optionalAuth,
  validate(getArtistsByUserSchema),
  artistController.getArtistsByUser,
);

// 2. Lấy danh sách cho Admin
// Phải đặt TRƯỚC /:slug để tránh "admin" bị coi là slug.
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getArtistsByAdminSchema),
  artistController.getArtistsByAdmin,
);

// ==========================================
// 🔵 ME ROUTES (Profile cá nhân của Nghệ sĩ)
// ==========================================
// Phải đặt TRƯỚC /:slug để tránh "me" bị coi là slug.
router.get(
  "/me/profile", 
  protect, 
  authorize("artist"), 
  artistController.getMyProfile
);

router.patch(
  "/me/profile",
  protect,
  authorize("artist"),
  uploadArtistFiles,
  validate(updateArtistSchema),
  artistController.updateMyProfile,
);

// ==========================================
// 🟡 DYNAMIC GET ROUTES (Tham số :id hoặc :slug)
// ==========================================

// 3. Sub-resource (Tracks của nghệ sĩ)
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getArtistTracksSchema),
  artistController.getArtistTracks,
);

// 4. Catch-all GET (Chi tiết nghệ sĩ)
// Đây là "chốt chặn" cuối cùng của phương thức GET
router.get(
  "/:slug",
  optionalAuth,
  validate(getArtistDetailSchema),
  artistController.getArtistDetail,
);

// ==========================================
// 🔴 ADMIN WRITE ROUTES (Các thao tác quản trị)
// ==========================================
router.use(protect);
router.use(authorize("admin"));

// 5. Tạo nghệ sĩ mới
router.post(
  "/",
  uploadArtistFiles,
  validate(createArtistSchema),
  artistController.createArtist,
);

// 6. Các hành động cụ thể trên ID (Action-based)
// Đặt TRƯỚC /:id để không bị lọt vào route update chung
router.patch(
  "/:id/restore",
  validate(deleteArtistSchema),
  artistController.restoreArtist,
);

router.patch(
  "/:id/toggle",
  validate(toggleArtistStatusSchema),
  artistController.toggleStatus,
);

// 7. Route ID tổng quát (Update & Delete)
router
  .route("/:id")
  .patch(
    uploadArtistFiles,
    validate(updateArtistSchema),
    artistController.updateArtist,
  )
  .delete(
    validate(deleteArtistSchema),
    artistController.deleteArtist,
  );

export default router;