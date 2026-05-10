import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import verificationService from "../services/verification.service";
import { IUser } from "../models/User";

/**
 * 1. Submit Verification Request
 * User gửi form + ảnh CCCD
 */
export const submitRequest = catchAsync(async (req: Request, res: Response) => {
  // Vì dùng uploadImages.array(), file sẽ nằm trong req.files (dạng mảng)
  const files = req.files as Express.Multer.File[];

  const result = await verificationService.submitRequest(
    req.user as IUser,
    req.body,
    files
  );

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Gửi yêu cầu xác thực thành công. Vui lòng chờ phản hồi.",
    data: result,
  });
});

/**
 * 2. Get Requests List (Admin)
 * Lọc theo status, phân trang
 */
export const getRequests = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;

  // Mặc định lấy danh sách 'pending'
  const result = await verificationService.getRequests(
    (status as "pending" | "approved" | "rejected") || "pending",
    Number(page) || 1,
    Number(limit) || 10
  );

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * 3. Review Request (Admin)
 * Duyệt hoặc Từ chối
 */
export const reviewRequest = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, rejectReason } = req.body;

  const result = await verificationService.reviewRequest(
    id as string,
    status, // "approved" | "rejected"
    rejectReason
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});
