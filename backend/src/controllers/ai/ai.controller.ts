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
