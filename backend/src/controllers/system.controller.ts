import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import systemService from "../services/system.service";
import httpStatus from "http-status";

export const syncSystemStats = catchAsync(
  async (req: Request, res: Response) => {
    // Chạy tác vụ nặng
    const result = await systemService.syncAll();

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đồng bộ dữ liệu hệ thống thành công",
      data: result,
    });
  }
);
