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
// 🟢 STATIC ROUTES (Phải để trên đầu)
// ==========================================

// 1. Get My Playlists (Sidebar/Profile) - Cần protect
router.get(
  "/me",
  protect,
  validate(getMyPlaylistsSchema),
  playlistController.getMyPlaylists,
);

// 2. Quick Create Playlist (Spotify Style)
router.post(
  "/me",
  protect,
  validate(createQuickPlaylistSchema),
  playlistController.createMyPlaylist,
);

// 3. Admin Get All Playlists (Filter/Search)
router.get(
  "/admin",
  protect,
  authorize("admin"),
  validate(getPlaylistsByAdminSchema),
  playlistController.getPlaylistsByAdmin,
);

// 4. Public Get Playlists (Filter/Search)
router.get(
  "/",
  optionalAuth,
  validate(getPlaylistsByUserSchema),
  playlistController.getPlaylistsByUser,
);

// 5. Create System Playlist (Admin)
router.post(
  "/",
  protect,
  authorize("admin"),
  uploadImages.single("coverImage"),
  validate(createPlaylistSchema),
  playlistController.createPlaylist,
);

// ==========================================
// 🔵 DYNAMIC ROUTES (Các route chứa tham số :id)
// ==========================================

// 6. Get Detail (Public/Optional Auth)
router.get(
  "/:id",
  optionalAuth,
  validate(getPlaylistDetailSchema),
  playlistController.getPlaylistDetail,
);

// 7. Get Tracks (Phân trang/Filter)
router.get(
  "/:id/tracks",
  optionalAuth,
  validate(getPlaylistTracksSchema),
  playlistController.getPlaylistTracks,
);

// --- Các thao tác thay đổi dữ liệu bên dưới cần Protect ---
router.use(protect);

// 8. Edit Quick Playlist (Chỉ đổi title/visibility)
router.put(
  "/me/:id",
  validate(updateQuickPlaylistSchema),
  playlistController.editMyPlaylist,
);

// 9. Add Tracks
router.post(
  "/:id/tracks",
  validate(addTracksToPlaylistSchema),
  playlistController.addTracks,
);

// 10. Remove Tracks
router.delete(
  "/:id/tracks",
  validate(removeTracksFromPlaylistSchema),
  playlistController.removeTracks,
);

// 11. Reorder Tracks
router.put(
  "/:id/tracks",
  validate(reorderPlaylistTracksSchema),
  playlistController.reorderTracks,
);

// 12. Toggle Privacy
router.patch(
  "/:id/toggle-visibility",
  validate(togglePlaylistVisibilitySchema),
  playlistController.togglePlaylistPrivacy,
);

// 13. Admin/Owner Update (Full Update với file)
router.patch(
  "/:id",
  uploadImages.single("coverImage"),
  validate(updatePlaylistSchema),
  playlistController.updatePlaylist,
);

// 14. Delete Playlist
router.delete(
  "/:id",
  validate(deletePlaylistSchema),
  playlistController.deletePlaylist,
);

export default router;
