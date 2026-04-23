// ─────────────────────────────────────────────────────────────────────────────
// controllers/track.recommendation.controller.ts
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import recommendationService from "../services/recommendation.service";
import catchAsync from "../utils/catchAsync";

/**
 * GET /tracks/recommendations
 *
 * Trả về danh sách "Bài hát bạn có thể thích" cho người dùng hiện tại.
 *
 * Query params:
 *   limit          – Số lượng bài trả về (default: 20, max: 50)
 *   excludeTrackId – Loại bài đang phát khỏi danh sách
 */
export const getRecommendedTracks = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const currentUser = (req as any).user;
    const userId = currentUser?._id?.toString() ?? null;

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const excludeTrackId = req.query.excludeTrackId as string | undefined;

    const tracks = await recommendationService.getRecommendedTracks(userId, {
      limit,
      excludeTrackId,
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        tracks,
        meta: {
          total: tracks.length,
          userId: userId ?? "guest",
        },
      },
    });
  },
);

/**
 * GET /tracks/:slugOrId/similar
 *
 * Trả về danh sách bài hát liên quan / tương tự – dùng cho autoplay queue.
 *
 * Query params:
 *   limit – Số lượng bài trả về (default: 10, max: 30)
 */
export const getSimilarTracks = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 10, 30);

    const tracks = await recommendationService.getSimilarTracks(id, {
      limit,
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        tracks,
        meta: { total: tracks.length, basedOn: id },
      },
    });
  },
);
