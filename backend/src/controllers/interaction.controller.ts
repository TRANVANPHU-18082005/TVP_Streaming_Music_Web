// src/controllers/interaction.controller.ts
import { Request, Response, NextFunction } from "express";
import interactionService from "../services/interaction.service";
import catchAsync from "../utils/catchAsync"; // Nên có wrapper này để bớt try-catch
import httpStatus from "http-status";

class InteractionController {
  // TOGGLE LIKE
  toggleLike = catchAsync(async (req: Request, res: Response) => {
    const { trackId } = req.params;
    const userId = (req as any).user._id;

    const result = await interactionService.toggleLikeTrack(userId, trackId);

    res.status(httpStatus.OK).json({
      success: true,
      message: result.isLiked
        ? "Đã thêm vào danh sách yêu thích"
        : "Đã xóa khỏi danh sách yêu thích",
      data: result,
    });
  });

  // TOGGLE FOLLOW
  toggleFollow = catchAsync(async (req: Request, res: Response) => {
    const { artistId } = req.params;
    const userId = (req as any).user._id;

    const result = await interactionService.toggleFollowArtist(
      userId,
      artistId,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: result.isFollowed
        ? "Đã theo dõi nghệ sĩ"
        : "Đã hủy theo dõi nghệ sĩ",
      data: result,
    });
  });

  // BATCH CHECK (Đồng bộ với hàm checkInteractions mới của Service)
  batchCheck = catchAsync(async (req: Request, res: Response) => {
    const { ids, type } = req.body; // ids: string[], type: 'like' | 'follow'
    const userId = (req as any).user._id;

    // Validate type đơn giản
    const interactionType = type === "follow" ? "follow" : "like";

    const interactedIds = await interactionService.checkInteractions(
      userId,
      ids,
      interactionType,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: interactedIds,
    });
  });
}

export default new InteractionController();
