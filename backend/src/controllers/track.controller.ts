// ─────────────────────────────────────────────────────────────────────────────
// controllers/track.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import trackService from "../services/track.service";
import { IUser } from "../models/User";
import {
  CreateTrackInput,
  UpdateTrackInput,
  TrackFilterInput,
  BulkUpdateTrackInput,
  BulkRetryInput,
  ChangeStatusInput,
} from "../validations/track.validation";

import { getRealtimeChart } from "../services/chart.service";

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPLOAD TRACK
// ─────────────────────────────────────────────────────────────────────────────
export const uploadTrack = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const body = req.body as CreateTrackInput;

  const track = await trackService.createTrack(req.user as IUser, body, files);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Upload bài hát thành công, đang xử lý (Transcoding)...",
    data: track,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE TRACK
// ─────────────────────────────────────────────────────────────────────────────
export const updateTrack = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const body = req.body as UpdateTrackInput;

  const track = await trackService.updateTrack(
    req.params.id as string,
    req.user as IUser,
    body,
    files,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật bài hát thành công",
    data: track,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE TRACK
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTrack = catchAsync(async (req: Request, res: Response) => {
  await trackService.deleteTrack(req.params.id as string, req.user as IUser);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa bài hát (soft delete — sẽ dọn file sau 30 ngày)",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET LIST
// ─────────────────────────────────────────────────────────────────────────────
export const getTracks = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query as unknown as TrackFilterInput;
  const currentUser = req.user ? (req.user as IUser) : undefined;
  const result = await trackService.getTracks(filters, currentUser);

  res.status(httpStatus.OK).json({ success: true, data: result });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET DETAIL
// ─────────────────────────────────────────────────────────────────────────────
export const getTrackDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user ? (req.user as IUser) : undefined;
    const track = await trackService.getTrackDetail(
      req.params.id as string,
      currentUser,
    );

    res.status(httpStatus.OK).json({ success: true, data: track });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. CHANGE STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const changeTrackStatus = catchAsync(
  async (req: Request, res: Response) => {
    const track = await trackService.changeTrackStatus(
      req.params.id as string,
      req.body,
    );
    res.status(httpStatus.OK).json({ success: true, data: track });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. BULK UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export const bulkUpdateTracks = catchAsync(
  async (req: Request, res: Response) => {
    const { trackIds, updates } = req.body as BulkUpdateTrackInput;
    const result = await trackService.bulkUpdateTracks(
      req.user as IUser,
      trackIds,
      updates,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: `Đã cập nhật thành công ${result.modifiedCount} bài hát.`,
      data: { modified: result.modifiedCount },
    });
  },
);

// 8. BULK RETRY (Transcode, Lyrics, Karaoke, Mood Canvas) - Queue lại các job xử lý cho nhiều track cùng lúc
export const bulkRetryTranscode = catchAsync(
  async (req: Request, res: Response) => {
    const { trackIds } = req.body as BulkRetryInput;
    const result = await trackService.bulkRetryTranscode(
      req.user as IUser,
      trackIds,
    );
    res.status(httpStatus.ACCEPTED).json({
      success: true,
      message: `Queued transcode for ${result.queued}/${result.requested} tracks`,
      data: result,
    });
  },
);

export const bulkRetryLyrics = catchAsync(
  async (req: Request, res: Response) => {
    const { trackIds } = req.body as BulkRetryInput;
    const result = await trackService.bulkRetryLyrics(
      req.user as IUser,
      trackIds,
    );
    res.status(httpStatus.ACCEPTED).json({
      success: true,
      message: `Queued lyrics jobs for ${result.queued}/${result.requested} tracks`,
      data: result,
    });
  },
);

export const bulkRetryKaraoke = catchAsync(
  async (req: Request, res: Response) => {
    const { trackIds } = req.body as BulkRetryInput;
    const result = await trackService.bulkRetryKaraoke(
      req.user as IUser,
      trackIds,
    );
    res.status(httpStatus.ACCEPTED).json({
      success: true,
      message: `Queued karaoke for ${result.queued}/${result.requested} tracks`,
      data: result,
    });
  },
);

export const bulkRetryMood = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body as BulkRetryInput;
  const result = await trackService.bulkRetryMood(req.user as IUser, trackIds);
  res.status(httpStatus.ACCEPTED).json({
    success: true,
    message: `Queued mood canvas jobs for ${result.queued}/${result.requested} tracks`,
    data: result,
  });
});

export const bulkRetryFull = catchAsync(async (req: Request, res: Response) => {
  const { trackIds } = req.body as BulkRetryInput;
  const result = await trackService.bulkRetryFull(req.user as IUser, trackIds);
  res.status(httpStatus.ACCEPTED).json({
    success: true,
    message: `Queued full pipeline for ${result.queued}/${result.requested} tracks`,
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. RETRY OPERATIONS
//    Mỗi retry là 1 endpoint riêng — rõ ràng, dễ gọi từ dashboard
// ─────────────────────────────────────────────────────────────────────────────

/** Retry toàn bộ pipeline (xoá HLS + lyrics → full re-process) */
export const retryFull = catchAsync(async (req: Request, res: Response) => {
  const track = await trackService.retryFull(req.params.id as string);
  res.status(httpStatus.ACCEPTED).json({
    success: true,
    message: "Full pipeline đã được queue lại.",
    data: { trackId: track._id, status: track.status },
  });
});

/** Retry chỉ HLS transcode — lyrics và mood giữ nguyên */
export const retryTranscode = catchAsync(
  async (req: Request, res: Response) => {
    const track = await trackService.retryTranscode(req.params.id as string);
    res.status(httpStatus.ACCEPTED).json({
      success: true,
      message: "Transcode job đã được queue lại.",
      data: { trackId: track._id, status: track.status },
    });
  },
);

/** Retry lyrics từ đầu (LRCLIB + karaoke fallback chain) */
export const retryLyrics = catchAsync(async (req: Request, res: Response) => {
  const track = await trackService.retryLyrics(req.params.id as string);
  res.status(httpStatus.ACCEPTED).json({
    success: true,
    message: "Lyrics job đã được queue lại.",
    data: {
      trackId: track._id,
      status: track.status,
      lyricType: track.lyricType,
    },
  });
});

/** Retry chỉ forced alignment (karaoke) — cần plainLyrics trong DB */
export const retryKaraoke = catchAsync(async (req: Request, res: Response) => {
  const track = await trackService.retryKaraoke(req.params.id as string);
  res.status(httpStatus.ACCEPTED).json({
    success: true,
    message: "Karaoke alignment job đã được queue lại.",
    data: { trackId: track._id, status: track.status },
  });
});

/** Retry mood canvas matching (tags thay đổi) */
export const retryMoodCanvas = catchAsync(
  async (req: Request, res: Response) => {
    const track = await trackService.retryMoodCanvas(req.params.id as string);
    res.status(httpStatus.ACCEPTED).json({
      success: true,
      message: "Mood canvas job đã được queue lại.",
      data: { trackId: track._id, status: track.status },
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. CHART
// ─────────────────────────────────────────────────────────────────────────────
export const getTopChart = catchAsync(async (req: Request, res: Response) => {
  const data = await getRealtimeChart();
  res.status(httpStatus.OK).json({ success: true, data });
});

export const getTopHotTracksToday = catchAsync(
  async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await trackService.getTopHotTracksToday(filters);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);

export const getTopFavouriteTracks = catchAsync(
  async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await trackService.getTopFavouriteTracks(filters);
    res.status(httpStatus.OK).json({ success: true, data: result });
  },
);
