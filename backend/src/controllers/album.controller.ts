import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import albumService from "../services/album.service"; // Import instance camelCase
import { IUser } from "../models/User";
import {
  AlbumFilterInput,
  getAlbumsSchema,
  getAlbumTracksSchema,
} from "../validations/album.validation";

// 1. CREATE ALBUM
export const createAlbum = catchAsync(async (req: Request, res: Response) => {
  const album = await albumService.createAlbum(
    req.user as IUser,
    req.body,
    req.file,
  );

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Tạo Album thành công",
    data: album,
  });
});

// 2. GET LIST (Public)
export const getAlbums = catchAsync(async (req: Request, res: Response) => {
  // Cast Type chuẩn từ Zod (req.query đã được validate & coerce bởi middleware)
  const filter = req.query as unknown as AlbumFilterInput;
  const currentUser = req.user as IUser;
  console.log("Received filter from query:", filter, currentUser); // Debug log
  const result = await albumService.getAlbums(filter, currentUser);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 3. GET DETAIL (Aware of User context)
export const getAlbumDetail = catchAsync(
  async (req: Request, res: Response) => {
    // Nếu có optionalAuth, req.user sẽ có giá trị (hoặc undefined nếu guest)
    const currentUser = req.user as IUser | undefined;

    const currentUserId = currentUser ? currentUser._id.toString() : undefined;
    const userRole = currentUser ? currentUser.role : undefined;

    const albumDetailResult = await albumService.getAlbumDetail(
      req.params.id,
      currentUserId,
      userRole,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: albumDetailResult,
    });
  },
);

// 4. UPDATE ALBUM
export const updateAlbum = catchAsync(async (req: Request, res: Response) => {
  const album = await albumService.updateAlbum(
    req.params.id,
    req.user as IUser,
    req.body,
    req.file,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật Album thành công",
    data: album,
  });
});

// 5. DELETE ALBUM
export const deleteAlbum = catchAsync(async (req: Request, res: Response) => {
  await albumService.deleteAlbum(req.params.id, req.user as IUser);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa Album",
  });
});
// 6. GET ALBUM TRACKS
export const getAlbumTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getAlbumsSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  const result = await albumService.getAlbumTracks(
    req.params.id,
    query,
    currentUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
