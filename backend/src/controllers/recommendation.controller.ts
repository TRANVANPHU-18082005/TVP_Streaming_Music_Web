// ─────────────────────────────────────────────────────────────────────────────
// controllers/track.recommendation.controller.ts
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import recommendationService from "../services/recommendation.service";
import catchAsync from "../utils/catchAsync";

function parseExcludeIds(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
    .slice(0, 80);
}

function parseMix(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const mix = Number(value);
  if (!Number.isFinite(mix)) return undefined;
  return Math.min(1, Math.max(0, mix));
}

function parseForMeMood(value: unknown): "focus" | "sad" | "energy" | undefined {
  if (value === "focus" || value === "sad" || value === "energy") return value;
  return undefined;
}

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
    const session = req.query.session === "1";
    const excludeIds = parseExcludeIds(req.query.excludeIds);
    const genreIds = parseExcludeIds(req.query.genreIds).slice(0, 5);
    const mood = parseForMeMood(req.query.mood);
    const mix = parseMix(req.query.mix);
    const useContinuation = session || excludeIds.length > 0 || genreIds.length > 0 || Boolean(mood) || mix !== undefined;

    const continuation = useContinuation
      ? await recommendationService.getForMeContinuation(userId, {
          limit,
          session,
          excludeIds,
          genreIds,
          mix,
          mood,
        })
      : null;
    const tracks = continuation
      ? continuation.tracks
      : await recommendationService.getRecommendedTracks(userId, {
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
          needsTaste: continuation?.needsTaste ?? false,
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
    const limit = Math.min(Number(req.query.limit) || 10, 30);

    const id = req.params.id as string;
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
export const getTopHotTracksToday = catchAsync(
  async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await recommendationService.getTopHotTracksToday(filters);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getTopFavouriteTracks = catchAsync(
  async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await recommendationService.getTopFavouriteTracks(filters);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getRecommendedAlbums = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    const userId = currentUser?._id?.toString() ?? null;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const result = await recommendationService.getRecommendedAlbums(userId, limit);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getRecommendedPlaylists = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    const userId = currentUser?._id?.toString() ?? null;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const result = await recommendationService.getRecommendedPlaylists(userId, limit);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getTrendingAlbums = catchAsync(
  async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const result = await recommendationService.getTrendingAlbums(limit);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getTrendingPlaylists = catchAsync(
  async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const result = await recommendationService.getTrendingPlaylists(limit);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const refreshForMe = catchAsync(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const userId = currentUser?._id?.toString();
  if (userId) await recommendationService.resetForMeSession(userId);
  res.status(httpStatus.OK).json({ success: true, data: { reset: Boolean(userId) } });
});

export const recordForMeFeedback = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    const userId = currentUser?._id?.toString();
    if (!userId) {
      res.status(httpStatus.OK).json({ success: true, data: { saved: false } });
      return;
    }
    const saved = await recommendationService.recordForMeFeedback(
      userId,
      req.body.trackId,
    );
    res.status(httpStatus.OK).json({ success: true, data: { saved } });
  },
);

export const getForYouFeed = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = (req as any).user;
    const userId = currentUser?._id?.toString() ?? null;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const feed = await recommendationService.getForYouFeed(userId, limit);
    res.status(httpStatus.OK).json({
      success: true,
      data: {
        feed,
        meta: {
          total: feed.length,
          userId: userId ?? "guest",
        },
      },
    });
  },
);
