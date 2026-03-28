import { Request, Response } from "express";
import interactionService from "../services/interaction.service";
import catchAsync from "../utils/catchAsync";
import httpStatus from "http-status";
import { IUser } from "../models/User";

/**
 * 🚀 1. TOGGLE LIKE
 */
export const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  // Controller chỉ bóc tách dữ liệu và chuyển tiếp
  const result = await interactionService.toggleLike(
    user._id.toString(),
    req.body.targetId,
    req.body.targetType,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isLiked ? "Đã thêm vào yêu thích" : "Đã xóa khỏi yêu thích",
    data: result,
  });
});

/**
 * 👥 2. TOGGLE FOLLOW
 */
export const toggleFollow = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const result = await interactionService.toggleFollowArtist(
    user._id.toString(),
    req.params.artistId,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isFollowed
      ? "Đã theo dõi nghệ sĩ"
      : "Đã hủy theo dõi nghệ sĩ",
    data: result,
  });
});

/**
 * ⚡ 3. BATCH CHECK
 */
export const batchCheck = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  // Service chịu trách nhiệm validate mảng ids và targetType bên trong
  const result = await interactionService.checkInteractions(
    user._id.toString(),
    req.body.ids,
    req.body.type,
    req.body.targetType,
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});
