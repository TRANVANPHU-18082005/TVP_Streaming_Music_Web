import express from "express";
import {
  protect,
  optionalAuth,
  authorize,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as playlistController from "../controllers/playlist.controller";

import { uploadImages } from "../config/upload";
import {
  addTracksToPlaylistSchema,
  createPlaylistSchema,
  createQuickPlaylistSchema,
  deletePlaylistSchema,
  getMyPlaylistsSchema,
  getPlaylistDetailSchema,
  getPlaylistsByAdminSchema,
  getPlaylistsByUserSchema,
  getPlaylistTracksSchema,
  removeTracksFromPlaylistSchema,
  reorderPlaylistTracksSchema,
  togglePlaylistVisibilitySchema,
  updatePlaylistSchema,
  updateQuickPlaylistSchema,
} from "../validations/playlist.validation";

const router = express.Router();

// ==========================================
// 🟢 STATIC GET ROUTES (Phải ưu tiên tuyệt đối)
// ==========================================

// 1. Get My Playlists (Siderbar)
// Đặt trên cùng để "me" không bị nhầm là :id
router.get(
  "/me",
  protect,
  validate(getMyPlaylistsSchema),
  playlistController.getMyPlaylists,
);

// 2. Admin Get All
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getPlaylistsByAdminSchema),
  playlistController.getPlaylistsByAdmin,
);

// 3. Public Get List
router.get(
  "/",
  optionalAuth,
  validate(getPlaylistsByUserSchema),
  playlistController.getPlaylistsByUser,
);

// ==========================================
// 🔵 DYNAMIC GET ROUTES (Tham số :id)
// ==========================================

// 4. Get Tracks (Sub-resource)
// Nên để các route có hậu tố /tracks lên trước route detail đơn lẻ
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getPlaylistTracksSchema),
  playlistController.getPlaylistTracks,
);

// 5. Get Detail (Generic Resource)
router.get(
  "/:id",
  optionalAuth,
  validate(getPlaylistDetailSchema),
  playlistController.getPlaylistDetail,
);

// ==========================================
// 🔴 MUTATION ROUTES (Cần Protect)
// ==========================================
router.use(protect);

// --- Cụm route "ME" (Thao tác nhanh của User) ---

// 6. Quick Create
router.post(
  "/me",
  validate(createQuickPlaylistSchema),
  playlistController.createMyPlaylist,
);

// 7. Edit Quick Playlist
router.put(
  "/me/:id",
  validate(updateQuickPlaylistSchema),
  playlistController.editMyPlaylist,
);

// --- Cụm route "RESOURCE" (Thao tác chi tiết) ---

// 8. Create System Playlist (Admin)
router.post(
  "/",
  authorize("admin"),
  uploadImages.single("coverImage"),
  validate(createPlaylistSchema),
  playlistController.createPlaylist,
);

// 9. Track Management (POST/PUT/DELETE trên sub-resource)
router.post("/:id/tracks", validate(addTracksToPlaylistSchema), playlistController.addTracks);
router.put("/:id/tracks", validate(reorderPlaylistTracksSchema), playlistController.reorderTracks);
router.delete("/:id/tracks", validate(removeTracksFromPlaylistSchema), playlistController.removeTracks);

// --- Cụm PATCH (Quan trọng: Action-specific đặt TRƯỚC Generic) ---

// 10. Restore (Admin) - Phải đặt TRƯỚC PATCH /:id
router.patch(
  "/:id/restore",
  authorize("admin"),
  validate(deletePlaylistSchema),
  playlistController.restorePlaylist,
);

// 11. Toggle Privacy - Phải đặt TRƯỚC PATCH /:id
router.patch(
  "/:id/toggle-visibility",
  validate(togglePlaylistVisibilitySchema),
  playlistController.togglePlaylistPrivacy,
);

// 12. Generic Update (Full update) - Đặt CUỐI CÙNG của PATCH
router.patch(
  "/:id",
  uploadImages.single("coverImage"),
  validate(updatePlaylistSchema),
  playlistController.updatePlaylist,
);

// 13. Delete
router.delete(
  "/:id",
  validate(deletePlaylistSchema),
  playlistController.deletePlaylist,
);

export default router;