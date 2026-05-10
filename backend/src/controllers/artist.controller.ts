import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import artistService from "../services/artist.service"; // Instance service
import Artist from "../models/Artist";
import ApiError from "../utils/ApiError";
import { IUser } from "../models/User";
import {
  ArtistAdminFilterInput,
  ArtistUserFilterInput,
  getArtistTracksSchema,
} from "../validations/artist.validation";

// 1. PUBLIC: GET LIST THEO USER
export const getArtistsByUser = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type từ Zod Schema (Query params đã được validate)
    const query = req.query as unknown as ArtistUserFilterInput;
    const currentUser = req.user as IUser | undefined;
    const result = await artistService.getArtistsByUser(query, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);
// 2. PUBLIC: GET LIST BY ADMIN
export const getArtistsByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Type từ Zod Schema (Query params đã được validate)
    const query = req.query as unknown as ArtistAdminFilterInput;
    const currentUser = req.user as IUser | undefined;
    const result = await artistService.getArtistsByAdmin(query, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);

// 3. PUBLIC: GET DETAIL
export const getArtistDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user as IUser | undefined;
    const slug = req.params.slug as string;
    const albumDetailResult = await artistService.getArtistDetail(
      slug,
      currentUser,
    );
    res.status(httpStatus.OK).json({
      success: true,
      data: albumDetailResult,
    });
  },
);

// 4. ARTIST: GET MY PROFILE
export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const artist = await Artist.findOne({ user: req.user!._id }).lean();

  if (!artist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Bạn chưa có hồ sơ Nghệ sĩ");
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: artist,
  });
});

// 5. ARTIST: UPDATE SELF
export const updateMyProfile = catchAsync(
  async (req: Request, res: Response) => {
    // Cast Multer Fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const result = await artistService.updateMyProfile(
      req.user!._id.toString(),
      req.body,
      files,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      data: result,
    });
  },
);

// 6. ADMIN: CREATE
export const createArtist = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const result = await artistService.createArtistByAdmin(req.body, files);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Tạo nghệ sĩ thành công",
    data: result,
  });
});

// 7. ADMIN: UPDATE
export const updateArtist = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const id = req.params.id as string;
  const result = await artistService.updateArtistByAdmin(
    id,
    req.body,
    files,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật nghệ sĩ thành công",
    data: result,
  });
});

// 8. ADMIN: TOGGLE STATUS
export const toggleStatus = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await artistService.toggleStatus(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isActive
      ? "Đã kích hoạt nghệ sĩ"
      : "Đã vô hiệu hóa nghệ sĩ",
    data: result,
  });
});

// 9. ADMIN: DELETE
export const deleteArtist = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await artistService.deleteArtist(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa nghệ sĩ vĩnh viễn",
  });
});
// 11. ADMIN: RESTORE ARTIST
export const restoreArtist = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await artistService.restoreArtist(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã khôi phục nghệ sĩ",
    data: result,
  });
});
// 10. GET ARTIST TRACKS
export const getArtistTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getArtistTracksSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  const result = await artistService.getArtistTracks(
    req.params.id as string,
    query,
    currentUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
