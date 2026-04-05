// src/controllers/profile.controller.ts
import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import { IUser } from "../models/User";
import profileService from "../services/profile.service";

export const getAnalytics = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const analyticsData = await profileService.getListeningAnalytics(
    user._id.toString(),
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: analyticsData,
  });
});
export const getLibrary = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const libraryData = await profileService.getLibrary(user._id.toString());

  res.status(httpStatus.OK).json({
    success: true,
    data: libraryData,
  });
});
export const getRecentlyPlayedTracks = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const recentlyPlayed = await profileService.getRecentlyPlayed(
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: recentlyPlayed,
    });
  },
);
export const getProfileDashboard = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const dashboardData = await profileService.getFullProfileDashboard(
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: dashboardData,
    });
  },
);

export const getLikedContent = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as IUser;
    // Các biến này đã được Zod transform sang Number ở tầng Validation
    const { type, page, limit } = req.query as any;

    const result = await profileService.getLikedContent(
      user._id.toString(),
      type,
      page,
      limit,
    );

    res.status(httpStatus.OK).json({
      success: true,
      ...result,
    });
  },
);

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const updatedUser = await profileService.updateUserProfile(
    user._id.toString(),
    req.body,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật hồ sơ thành công",
    data: updatedUser,
  });
});
