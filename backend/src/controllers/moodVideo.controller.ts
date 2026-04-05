import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import { MoodVideoFilterInput } from "../validations/moodVideo.validation";
import MoodVideoService from "../services/MoodVideo.service";

export const createMoodVideo = catchAsync(
  async (req: Request, res: Response) => {
    // Video file lấy từ req.file (multer)
    const video = await MoodVideoService.createMoodVideo(req.body, req.file);

    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Tạo Mood Video thành công",
      data: video,
    });
  },
);

export const getMoodVideos = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as MoodVideoFilterInput;
  const result = await MoodVideoService.getMoodVideos(filter);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

export const updateMoodVideo = catchAsync(
  async (req: Request, res: Response) => {
    const video = await MoodVideoService.updateMoodVideo(
      req.params.id,
      req.body,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Cập nhật thành công",
      data: video,
    });
  },
);

export const deleteMoodVideo = catchAsync(
  async (req: Request, res: Response) => {
    await MoodVideoService.deleteMoodVideo(req.params.id);
    res.status(httpStatus.OK).json({
      success: true,
      message: "Đã xóa Mood Video",
    });
  },
);
