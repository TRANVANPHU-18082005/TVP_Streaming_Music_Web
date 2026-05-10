import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import playlistService from "../services/playlist.service"; // Import instance (camelCase)
import { IUser } from "../models/User";
import {
  getPlaylistTracksSchema,
  PlaylistAdminFilterInput,
  PlaylistUserFilterInput,
} from "../validations/playlist.validation";

// 1. Create Playlist
export const createPlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.createPlaylistByAdmin(
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

// 2.A Get Playlists by User (Filter / Search)
export const getPlaylistsByUser = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type chuẩn từ Zod Validation (req.query đã qua validate middleware)
    const filter = req.query as unknown as PlaylistUserFilterInput;
    const currentUser = req.user as IUser | undefined;
    // Truyền req.user (có thể undefined nếu guest)
    const result = await playlistService.getPlaylistsByUser(
      filter,
      currentUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);
// 2.B Get Playlists by Admin (Filter / Search)
export const getPlaylistsByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type chuẩn từ Zod Validation (req.query đã qua validate middleware)
    const filter = req.query as unknown as PlaylistAdminFilterInput;
    const currentUser = req.user as IUser | undefined;
    // Truyền req.user (có thể undefined nếu guest)
    const result = await playlistService.getPlaylistsByAdmin(
      filter,
      currentUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);

// 3. Get Playlist Detail
export const getPlaylistDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user as IUser | undefined;

    const playlistDetailResult = await playlistService.getPlaylistDetail(
      req.params.id as string,
      currentUser,
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
    const id = req.params.id as string;
    const result = await playlistService.updatePlaylistByAdmin(
      id,
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
    const id = req.params.id as string;
    await playlistService.deletePlaylist(id, req.user as IUser);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã xóa playlist thành công",
    });
  },
);

// Restore Playlist (Admin)
export const restorePlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await playlistService.restorePlaylist(id, req.user as IUser);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã khôi phục playlist thành công",
    });
  },
);

// 6. Add Tracks (Batch Support)
export const addTracks = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body;

  const result = await playlistService.addTracks(
    req.params.id as string,
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
    req.params.id as string,
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
  const idString = id as string;
  const { trackIds } = req.body; // Mảng ID đã sắp xếp từ Client gửi xuống

  const result = await playlistService.reorderTracks(
    idString,
    trackIds,
    req.user as IUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã cập nhật thứ tự bài hát",
    data: result,
  });
});
// 9.A User create playlist nhanh
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
// 9.B User edit playlist nhanh
export const editMyPlaylist = catchAsync(
  async (req: Request, res: Response) => {
    // Sử dụng service tạo nhanh: Không bắt buộc gửi Title/Visibility
    const result = await playlistService.editQuickPlaylist(
      req.params.id as string,
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
// 10. Toggle Playlist Visibility (Public/Private)
export const togglePlaylistPrivacy = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await playlistService.toggleVisibility(
      id,
      req.user as IUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: `Đã chuyển chế độ `,
      data: { visibility: result?.visibility },
    });
  },
);
// 11. Get My Playlists (Dành cho user xem nhanh playlist của chính mình, có thể dùng cache riêng nếu cần)
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
//  12. Get Tracks of a Playlist (Có phân trang, filter, và quyền truy cập)
export const getPlaylistTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getPlaylistTracksSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  console.log("Params" + req.params.id);
  const id = req.params.id as string;
  const result = await playlistService.getPlaylistTracks(
    id,
    query,
    currentUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
