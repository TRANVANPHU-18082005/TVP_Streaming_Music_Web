import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import playlistService from "../services/playlist.service"; // Import instance (camelCase)
import { IUser } from "../models/User";
import { PlaylistFilterInput } from "../validations/playlist.validation";

// 1. Create Playlist
export const createPlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.createPlaylist(
      req.user as IUser,
      req.body,
      req.file
    );

    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Tạo playlist thành công",
      data: result,
    });
  }
);

// 2. Get Playlists (Filter / Search)
export const getPlaylists = catchAsync(async (req: Request, res: Response) => {
  // Cast Type chuẩn từ Zod Validation (req.query đã qua validate middleware)
  const filter = req.query as unknown as PlaylistFilterInput;

  // Truyền req.user (có thể undefined nếu guest)
  const result = await playlistService.getPlaylists(
    filter,
    req.user as IUser | undefined
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 3. Get Playlist Detail
export const getPlaylistDetail = catchAsync(
  async (req: Request, res: Response) => {
    // Service đã được nâng cấp để xử lý logic Guest/User/Admin bên trong
    const result = await playlistService.getPlaylistDetail(
      req.params.id,
      req.user as IUser | undefined
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  }
);

// 4. Update Playlist
export const updatePlaylist = catchAsync(
  async (req: Request, res: Response) => {
    const result = await playlistService.updatePlaylist(
      req.params.id,
      req.user as IUser,
      req.body,
      req.file
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Cập nhật playlist thành công",
      data: result,
    });
  }
);

// 5. Delete Playlist
export const deletePlaylist = catchAsync(
  async (req: Request, res: Response) => {
    await playlistService.deletePlaylist(req.params.id, req.user as IUser);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã xóa playlist thành công",
    });
  }
);

// 6. Add Tracks (Batch Support)
export const addTracks = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body;

  const result = await playlistService.addTracks(
    req.params.playlistId,
    // Đảm bảo luôn là mảng (dù client gửi string hay array)
    Array.isArray(trackIds) ? trackIds : [trackIds],
    req.user as IUser
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
    req.user as IUser
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
    req.user as IUser
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã cập nhật thứ tự bài hát",
    data: result,
  });
});
