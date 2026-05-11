import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import genreService from "../services/genre.service";
import {
  GenreAdminFilterInput,
  GenreUserFilterInput,
  getGenreTracksSchema,
} from "../validations/genre.validation";
import { IUser } from "../models/User";
import { console } from "inspector";

// 1. GET LIST
export const getGenresByUser = catchAsync(
  async (req: Request, res: Response) => {
    // TypeScript sẽ tự infer từ Schema Validation ở Route, nhưng cast tay cho chắc chắn
    const query = req.query as unknown as GenreUserFilterInput;
    const currentUser = req.user as IUser | undefined;

    const result = await genreService.getGenresByUser(query, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);
// 2. GET LIST (Admin - Có thêm filter theo trạng thái Active/Inactive)
export const getGenresByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    // TypeScript sẽ tự infer từ Schema Validation ở Route, nhưng cast tay cho chắc chắn
    const query = req.query as unknown as GenreAdminFilterInput;
    const currentUser = req.user as IUser | undefined;

    const result = await genreService.getGenresByAdmin(query, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
    });
  },
);
// 3. CREATE GENRE (Admin)
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
  const id = req.params.id as string;
  const result = await genreService.updateGenre(
    id,
    req.body,
    req.file,
  );
  console.log(id, req.body, req.file);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật thể loại thành công",
    data: result,
  });
});
// 4. TOGGLE STATUS (Admin - Ẩn/Hiện)
export const toggleGenreStatus = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await genreService.toggleStatus(id);

    res.status(httpStatus.OK).json({
      success: true,
      message: result.isActive
        ? "Đã Bật hiển thị trạng thái thể loại"
        : "Đã tắt hiển thị trạng thái thể loại",
      data: result,
    });
  },
);
// 5. DELETE GENRE (Admin - Xóa vĩnh viễn)
export const deleteGenre = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await genreService.deleteGenre(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa thể loại vĩnh viễn",
  });
});
// Restore Genre (Admin)
export const restoreGenre = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await genreService.restoreGenre(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã khôi phục thể loại",
  });
});
// 7. GET GENRE DETAIL
export const getGenreDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user as IUser | undefined;
    const slug = req.params.slug as string;
    console.log(req.params, slug);
    const genreDetailResult = await genreService.getGenreDetail(
      slug,
      currentUser,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: genreDetailResult,
    });
  },
);
// 8. GET GENRE TREE (Dành cho cả User & Admin - Không cần phân biệt)
export const getTree = catchAsync(async (req, res) => {
  const result = await genreService.getGenreTree();
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
// 9. GET GENRE TRACKS
export const getGenreTracks = catchAsync(async (req, res) => {
  // 1. Parse query - Đảm bảo dữ liệu sạch
  const { query } = getGenreTracksSchema.parse({ query: req.query });
  const currentUser = req.user as IUser | undefined;

  const result = await genreService.getGenreTracks(
    req.params.id,
    query,
    currentUser,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
