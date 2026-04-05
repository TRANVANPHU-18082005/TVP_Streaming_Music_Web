import express from "express";
import {
  protect,
  optionalAuth,
  authorize,
} from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as playlistController from "../controllers/playlist.controller";

import {
  createPlaylistSchema,
  updatePlaylistSchema,
  addTracksToPlaylistSchema,
  getPlaylistsSchema,
  removeTracksToPlaylistSchema,
  updatePlaylistTracksSchema,
  // removeTrackSchema, // Nhớ tạo thêm schema này nếu cần check :trackId
} from "../validations/playlist.validation";
import { uploadImages } from "../config/upload";

const router = express.Router();

// ─────────────────────────────────────────────────────
// 👤 USER ROUTES (Dành cho chính người dùng đang login)
// ─────────────────────────────────────────────────────

// 1. Tạo playlist nhanh (Spotify Style)
router.post("/me", protect, playlistController.createMyPlaylist);
// 2. Lấy tất cả playlist của tôi (Sidebar/Profile)
// Route này phải nằm dưới middleware protect
router.get("/me", protect, playlistController.getMyPlaylists);

// 3. Quản lý tracks (Có Smart Cover)
router.post(
  "/me/:playlistId/tracks",
  protect,
  validate(addTracksToPlaylistSchema),
  playlistController.userAddTracks,
);
router.delete(
  "/me/:playlistId/tracks",
  protect,
  playlistController.userRemoveTracks,
);

// 4. Chuyển trạng thái nhanh
router.patch(
  "/me/:id/toggle-visibility",
  protect,
  playlistController.togglePlaylistPrivacy,
);

router.post(
  "/",
  protect,
  uploadImages.single("coverImage"),
  validate(createPlaylistSchema),
  playlistController.createPlaylist,
);

router.get(
  "/",
  optionalAuth,
  validate(getPlaylistsSchema),
  playlistController.getPlaylists,
);

// 2. TRACK MANAGEMENT

// Add Tracks (Batch)
router.post(
  "/:playlistId/tracks",
  protect,
  validate(addTracksToPlaylistSchema),
  playlistController.addTracks,
);

// 🔥 Remove Single Track (Fix cho khớp với Hook Frontend cũ)
// URL: DELETE /api/playlists/:playlistId/tracks/:trackId
router.delete(
  "/:playlistId/tracks/:trackId",
  protect,
  validate(removeTracksToPlaylistSchema),
  playlistController.removeTracks, // Controller xử lý xóa 1 bài
);

// Remove Tracks (Batch - Optional nếu bạn muốn làm tính năng xóa nhiều bài cùng lúc)
router.delete(
  "/:playlistId/tracks",
  protect,
  validate(addTracksToPlaylistSchema),
  playlistController.removeTracks,
);

// 3. DYNAMIC ROUTES
router.get("/:id", optionalAuth, playlistController.getPlaylistDetail);

router.patch(
  "/:id",
  protect,
  uploadImages.single("coverImage"),
  validate(updatePlaylistSchema),
  playlistController.updatePlaylist,
);

router.delete("/:id", protect, playlistController.deletePlaylist);
router.put(
  "/:id/tracks",
  protect,
  authorize("admin"), // Chỉ admin mới được reorder system playlist (hoặc chủ sở hữu)
  validate(updatePlaylistTracksSchema),
  playlistController.reorderTracks,
);
export default router;
