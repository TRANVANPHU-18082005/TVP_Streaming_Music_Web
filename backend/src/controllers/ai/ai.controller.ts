import { Request, Response } from "express";
import aiService from "../../services/ai/ai.service";
import catchAsync from "../../utils/catchAsync";

export const generatePlaylist = catchAsync(async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      success: false,
      message: "Prompt không hợp lệ",
    });
  }

  const result = await aiService.generatePlaylist(prompt);

  return res.status(200).json({
    success: true,
    message: "Tạo playlist bằng AI thành công",
    data: result.data,
  });
});

export const generateAutoMix = catchAsync(async (req: Request, res: Response) => {
  const { recentTracks } = req.body;

  if (!Array.isArray(recentTracks)) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu recentTracks không hợp lệ",
    });
  }

  const result = await aiService.generateAutoMix(recentTracks);

  return res.status(200).json({
    success: true,
    message: "Phân tích Auto-Mix thành công",
    data: result.data,
  });
});

export const analyzeTrack = catchAsync(async (req: Request, res: Response) => {
  const { trackId } = req.body;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({
      success: false,
      message: "trackId không hợp lệ",
    });
  }

  const result = await aiService.analyzeTrack(trackId);

  return res.status(200).json({
    success: true,
    message: "Phân tích bài hát thành công",
    data: result.data,
  });
});
