import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import genreService from "../services/genre.service";
import {
  GenreFilterInput,
  getGenreTracksSchema,
} from "../validations/genre.validation";
import { IUser } from "../models/User";

// 1. GET LIST
export const getGenres = catchAsync(async (req: Request, res: Response) => {
  // TypeScript sẽ tự infer từ Schema Validation ở Route, nhưng cast tay cho chắc chắn
  const query = req.query as unknown as GenreFilterInput;
  const currentUser = req.user as IUser | undefined;

  const result = await genreService.getAllGenres(query, currentUser);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// Các method Create/Update/Delete giữ nguyên logic gọi Service
// ... (createGenre, updateGenre, deleteGenre, toggleGenreStatus)
// 2. CREATE GENRE (Admin)
export const createGenre = catchAsync(async (req: Request, res: Response) => {
  // req.file do Multer xử lý
  const result = await genreService.createGenre(req.body, req.file);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Tạo thể loại mới thành công",
    data: result,
  });
});

// 3. UPDATE GENRE (Admin)
export const updateGenre = catchAsync(async (req: Request, res: Response) => {
  const result = await genreService.updateGenre(
    req.params.id,
    req.body,
    req.file,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật thể loại thành công",
    data: result,
  });
});

// 4. TOGGLE STATUS (Admin - Ẩn/Hiện)
export const toggleGenreStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await genreService.toggleStatus(req.params.id);

    res.status(httpStatus.OK).json({
      success: true,
      message: result.isActive ? "Đã kích hoạt thể loại" : "Đã ẩn thể loại",
      data: result,
    });
  },
);

// 5. DELETE GENRE (Admin - Xóa vĩnh viễn)
export const deleteGenre = catchAsync(async (req: Request, res: Response) => {
  await genreService.deleteGenre(req.params.id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa thể loại vĩnh viễn",
  });
});
export const getGenreDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user as IUser | undefined;

    const userRole = currentUser ? currentUser.role : undefined;

    const genreDetailResult = await genreService.getGenreBySlug(
      req.params.id,
      userRole,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: genreDetailResult,
    });
  },
);
// genre.controller.ts
export const getTree = catchAsync(async (req, res) => {
  const result = await genreService.getGenreTree();
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 6. GET ALBUM TRACKS
export const getGenreTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getGenreTracksSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  const userRole = currentUser ? currentUser.role : undefined;
  console.log("id" + req.params.id);
  const result = await genreService.getGenreTracks(
    req.params.id,
    query,
    userRole,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
