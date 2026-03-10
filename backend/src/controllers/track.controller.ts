import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import trackService from "../services/track.service";
import { IUser } from "../models/User";
import {
  CreateTrackInput,
  UpdateTrackInput,
  TrackFilterInput,
  ChangeStatusInput,
  BulkUpdateTrackInput,
} from "../validations/track.validation";
import { trackIdsSchema } from "../validations/common.validate";
import { getRealtimeChart } from "../services/chart.service";

// 1. UPLOAD TRACK
export const uploadTrack = catchAsync(async (req: Request, res: Response) => {
  // Cast Type Multer Files
  // Lưu ý: TrackService sẽ tự cast sang MulterS3File để lấy .location
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  // Cast Type Body từ Zod Schema (An toàn tuyệt đối nhờ middleware validate)
  const body = req.body as CreateTrackInput;

  const track = await trackService.createTrack(req.user as IUser, body, files);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Upload bài hát thành công, đang xử lý (Transcoding)...",
    data: track,
  });
});

// 2. UPDATE TRACK
export const updateTrack = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const body = req.body as UpdateTrackInput;

  const track = await trackService.updateTrack(
    req.params.id,
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

// 3. DELETE TRACK
export const deleteTrack = catchAsync(async (req: Request, res: Response) => {
  await trackService.deleteTrack(req.params.id, req.user as IUser);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa bài hát và dọn dẹp file trên hệ thống",
  });
});

// 4. GET LIST (Filter & Search)
export const getTracks = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query as unknown as TrackFilterInput;
  const currentUser = req.user ? (req.user as IUser) : undefined;

  const result = await trackService.getTracks(filters, currentUser);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 5. GET DETAIL
export const getTrackDetail = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser = req.user ? (req.user as IUser) : undefined;
    const track = await trackService.getTrackById(req.params.id, currentUser);

    res.status(httpStatus.OK).json({
      success: true,
      data: track,
    });
  },
);
export const changeTrackStatus = catchAsync(
  async (req: Request, res: Response) => {
    const trackId = req.params.id;
    const track = await trackService.changeTrackStatus(trackId, req.body);
    res.status(httpStatus.OK).json({
      success: true,
      data: track,
    });
  },
);
// 6. Retry Transcode (Tính năng bạn vừa thêm)
export const retryTranscode = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = req.user ? (req.user as IUser) : undefined;
    // Gọi Service logic
    const track = await trackService.retryTranscode(id);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã gửi lệnh xử lý lại (Re-Transcode) thành công!",
      data: {
        trackId: track._id,
        status: track.status,
      },
    });
  },
);
export const bulkUpdateTracks = catchAsync(
  async (req: Request, res: Response) => {
    // 1. Lấy dữ liệu đã được validate từ Body
    const { trackIds, updates } = req.body as BulkUpdateTrackInput;

    // 2. Gọi Service xử lý logic phức tạp (Counter, DB Update)
    const result = await trackService.bulkUpdateTracks(
      req.user as IUser,
      trackIds,
      updates,
    );

    // 3. Trả về kết quả
    res.status(httpStatus.OK).json({
      success: true,
      message: `Đã cập nhật thành công ${result.modifiedCount} bài hát.`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  },
);
export const getTopChart = async (req: Request, res: Response) => {
  try {
    const data = await getRealtimeChart();
    res.status(200).json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get Chart Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
