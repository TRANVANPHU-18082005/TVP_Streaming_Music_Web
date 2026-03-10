import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync"; // Import wrapper
import * as dashboardService from "../services/dashboard.service";
import { GetAnalyticsQuery } from "../validations/dashboard.validation";

export const getAnalytics = catchAsync(
  async (req: Request<{}, {}, {}, GetAnalyticsQuery>, res: Response) => {
    // Không cần try-catch nữa, nếu lỗi catchAsync tự lo
    const { range } = req.query;

    const data = await dashboardService.getDashboardData(range);

    res.status(httpStatus.OK).json({
      status: "success",
      data,
    });
  }
);
