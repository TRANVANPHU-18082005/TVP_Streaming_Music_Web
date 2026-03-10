import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import artistService from "../services/artist.service"; // Instance service
import Artist from "../models/Artist";
import ApiError from "../utils/ApiError";
import { IUser } from "../models/User";
import { ArtistFilterInput } from "../validations/artist.validation";

// 1. PUBLIC: GET LIST
export const getArtists = catchAsync(async (req: Request, res: Response) => {
  // Cast Type từ Zod Schema (Query params đã được validate)
  const query = req.query as unknown as ArtistFilterInput;

  const result = await artistService.getArtists(query);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 2. PUBLIC: GET DETAIL
export const getArtistDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUserId = req.user
      ? (req.user as IUser)._id.toString()
      : undefined;

    const result = await artistService.getArtistDetail(
      req.params.id,
      currentUserId
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  }
);

// 3. ARTIST: GET MY PROFILE
export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const artist = await Artist.findOne({ user: req.user!._id })
    .populate("genres", "name slug")
    .lean();

  if (!artist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Bạn chưa có hồ sơ Nghệ sĩ");
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: artist,
  });
});

// 4. ARTIST: UPDATE SELF
export const updateMyProfile = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Multer Fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const result = await artistService.updateMyProfile(
      req.user!._id.toString(),
      req.body,
      files
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      data: result,
    });
  }
);

// 5. ADMIN: CREATE
export const createArtist = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const result = await artistService.createArtistByAdmin(req.body, files);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Tạo nghệ sĩ thành công",
    data: result,
  });
});

// 6. ADMIN: UPDATE
export const updateArtist = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const result = await artistService.updateArtistByAdmin(
    req.params.id,
    req.body,
    files
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật nghệ sĩ thành công",
    data: result,
  });
});

// 7. ADMIN: TOGGLE STATUS
export const toggleStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await artistService.toggleStatus(req.params.id);

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isActive
      ? "Đã kích hoạt nghệ sĩ"
      : "Đã vô hiệu hóa nghệ sĩ",
    data: result,
  });
});

// 8. ADMIN: DELETE
export const deleteArtist = catchAsync(async (req: Request, res: Response) => {
  await artistService.deleteArtist(req.params.id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa nghệ sĩ vĩnh viễn",
  });
});
