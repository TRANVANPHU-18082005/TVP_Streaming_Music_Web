import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import albumService from "../services/album.service"; // Import instance camelCase
import { IUser } from "../models/User";
import {
  AlbumAdminFilterInput,
  AlbumUserFilterInput,
  getAlbumsByUserSchema,
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
export const getAlbumsByUser = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type chuẩn từ Zod (req.query đã được validate & coerce bởi middleware)
    const filter = req.query as unknown as AlbumUserFilterInput;
    const currentUser = req.user as IUser;
    console.log("Received filter from query:", filter, currentUser); // Debug log
    const result = await albumService.getAlbumsByUser(filter, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);
// 3. GET LIST  BY ADMIN (Có thể xem tất cả album, bao gồm private/draft của tất cả user)

export const getAlbumsByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type chuẩn từ Zod (req.query đã được validate & coerce bởi middleware)
    const filter = req.query as unknown as AlbumAdminFilterInput;
    const currentUser = req.user as IUser;
    console.log("Received filter from query:", filter, currentUser); // Debug log
    const result = await albumService.getAlbumsByAdmin(filter, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);

// 4. GET DETAIL (Aware of User context)
export const getAlbumDetail = catchAsync(
  async (req: Request, res: Response) => {
    // Nếu có optionalAuth, req.user sẽ có giá trị (hoặc undefined nếu guest)
    const currentUser = req.user as IUser | undefined;

    const albumDetailResult = await albumService.getAlbumDetail(
      req.params.slug,
      currentUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: albumDetailResult,
    });
  },
);

// 5. UPDATE ALBUM
export const updateAlbum = catchAsync(async (req: Request, res: Response) => {
  const currentUser = req.user as IUser;
  const id = req.params.id;
  const album = await albumService.updateAlbum(
    id,
    currentUser,
    req.body,
    req.file,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật Album thành công",
    data: album,
  });
});

// 6. DELETE ALBUM
export const deleteAlbum = catchAsync(async (req: Request, res: Response) => {
  await albumService.deleteAlbum(req.params.id, req.user as IUser);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa Album",
  });
});
// 7. GET ALBUM TRACKS
export const getAlbumTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getAlbumsByUserSchema.parse({ query: req.query });
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
// 8. TOGGLE PUBLIC/PRIVATE
export const toggleAlbumPublic = catchAsync(async (req, res) => {
  const currentUser = req.user as IUser;
  const album = await albumService.toggleAlbumPublicity(
    req.params.id,
    currentUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: `Album đã được chuyển sang ${album.isPublic ? "công khai" : "riêng tư"}`,
    data: album,
  });
});
