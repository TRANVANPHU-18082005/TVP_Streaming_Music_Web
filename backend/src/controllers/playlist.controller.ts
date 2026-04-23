import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import playlistService from "../services/playlist.service"; // Import instance (camelCase)
import { IUser } from "../models/User";
import {
  getPlaylistTracksSchema,
  PlaylistFilterInput,
} from "../validations/playlist.validation";

// 1. Create Playlist
export const createPlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.createPlaylist(
      req.user as IUser,
      req.body,
      req.file,
    );

    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Tạo playlist thành công",
      data: result,
    });
  },
);

// 2. Get Playlists (Filter / Search)
export const getPlaylists = catchAsync(async (req: Request, res: Response) => {
  // Cast Type chuẩn từ Zod Validation (req.query đã qua validate middleware)
  const filter = req.query as unknown as PlaylistFilterInput;
  const currentUser = req.user as IUser | undefined;
  // Truyền req.user (có thể undefined nếu guest)
  const result = await playlistService.getPlaylists(filter, currentUser);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 3. Get Playlist Detail
export const getPlaylistDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user as IUser | undefined;

    const currentUserId = currentUser ? currentUser._id.toString() : undefined;
    const userRole = currentUser ? currentUser.role : undefined;

    const playlistDetailResult = await playlistService.getPlaylistDetail(
      req.params.id,
      currentUserId,
      userRole,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: playlistDetailResult,
    });
  },
);

// 4. Update Playlist
export const updatePlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.updatePlaylist(
      req.params.id,
      req.user as IUser,
      req.body,
      req.file,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Cập nhật playlist thành công",
      data: result,
    });
  },
);

// 5. Delete Playlist
export const deletePlaylist = catchAsync(
  async (req: Request, res: Response) => {
    await playlistService.deletePlaylist(req.params.id, req.user as IUser);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã xóa playlist thành công",
    });
  },
);

// 6. Add Tracks (Batch Support)
export const addTracks = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body;

  const result = await playlistService.addTracks(
    req.params.playlistId,
    // Đảm bảo luôn là mảng (dù client gửi string hay array)
    Array.isArray(trackIds) ? trackIds : [trackIds],
    req.user as IUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
    data: { addedCount: result.count }, // Service trả về count hoặc addedCount, check lại service
  });
});

// 7. Remove Tracks (Batch Support)
export const removeTracks = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body;

  const result = await playlistService.removeTracks(
    req.params.playlistId,
    Array.isArray(trackIds) ? trackIds : [trackIds],
    req.user as IUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
    data: { removedCount: result.removedCount },
  });
});
// 8. Reorder Tracks
export const reorderTracks = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { trackIds } = req.body; // Mảng ID đã sắp xếp từ Client gửi xuống

  const result = await playlistService.reorderTracks(
    id,
    trackIds,
    req.user as IUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã cập nhật thứ tự bài hát",
    data: result,
  });
});
// ==========================================
// 👤 USER SPECIFIC METHODS
// ==========================================

/**
 * 🚀 Quick Create (Dành cho User - Luồng Spotify)
 * URL: POST /api/playlists/me
 */
export const createMyPlaylist = catchAsync(
  async (req: Request, res: Response) => {
    // Sử dụng service tạo nhanh: Không bắt buộc gửi Title/Visibility
    const result = await playlistService.createQuickPlaylist(
      req.user as IUser,
      req.body, // title và visibility (nếu có)
    );

    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Đã tạo danh sách phát mới",
      data: result,
    });
  },
);

/**
 * ➕ User Add Tracks + Smart Cover
 */
export const userAddTracks = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body;
  const { playlistId } = req.params;

  const result = await playlistService.userAddTracks(
    playlistId,
    Array.isArray(trackIds) ? trackIds : [trackIds],
    req.user as IUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã thêm bài hát vào danh sách",
    data: result,
  });
});

/**
 * 🗑️ User Bulk Remove Tracks
 */
export const userRemoveTracks = catchAsync(
  async (req: Request, res: Response) => {
    const { trackIds } = req.body; // Mảng IDs bài hát cần xóa
    const { playlistId } = req.params;

    const result = await playlistService.bulkRemoveTracks(
      playlistId,
      Array.isArray(trackIds) ? trackIds : [trackIds],
      req.user as IUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã xóa bài hát khỏi danh sách",
      data: result,
    });
  },
);

/**
 * 🔒 Toggle Privacy (Public/Private nhanh)
 */
export const togglePlaylistPrivacy = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.toggleVisibility(
      req.params.id,
      req.user as IUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: `Đã chuyển chế độ `,
      data: { visibility: result?.visibility },
    });
  },
);
// Lấy tất cả playlist của tôi
export const getMyPlaylists = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!._id; // Lấy ID từ token đã protect
    console.log("Fetching playlists for user ID:", userId);
    const playlists = await playlistService.getMyAllPlaylists(
      userId.toString(),
    );

    res.status(httpStatus.OK).json({
      success: true,
      count: playlists.length,
      data: playlists,
    });
  },
);
//  GET PLAYLIST TRACKS
export const getPlaylistTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getPlaylistTracksSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  const currentUserId = currentUser ? currentUser._id.toString() : undefined;
  const userRole = currentUser ? currentUser.role : undefined;
  console.log("Params" + req.params.id);
  const result = await playlistService.getPlaylistTracks(
    req.params.id,
    query,
    currentUserId,
    userRole,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
