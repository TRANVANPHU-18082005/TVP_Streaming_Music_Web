// controllers/karaoke.controller.ts

import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import karaokeService from "../services/karaoke.service";
import youtubeService from "../services/youtube.service";
import { IUser } from "../models/User";
// multer-s3 streams directly to B2, no local file handling needed

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Permission Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/karaoke/admin/permissions/:userId
 * Admin cấp/cập nhật quyền upload karaoke cho user.
 */
export const grantPermission = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const permission = await karaokeService.grantPermission(
    req.user as IUser,
    userId,
    req.body,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã cập nhật quyền upload karaoke",
    data: permission,
  });
});

/**
 * DELETE /api/karaoke/admin/permissions/:userId
 * Admin thu hồi quyền upload.
 */
export const revokePermission = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const result = await karaokeService.revokePermission(
    req.user as IUser,
    userId,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});

/**
 * GET /api/karaoke/admin/permissions
 * Admin xem danh sách permissions.
 */
export const getPermissions = catchAsync(async (req: Request, res: Response) => {
  const result = await karaokeService.getPermissions(req.query as any);
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Recording Review
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/karaoke/admin/recordings
 * Danh sách recordings cho admin (filter status).
 */
export const adminGetRecordings = catchAsync(async (req: Request, res: Response) => {
  const result = await karaokeService.adminGetRecordings(req.query as any);
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /api/karaoke/admin/recordings/:id/review
 * Admin duyệt/từ chối recording.
 */
export const adminReviewRecording = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  const recording = await karaokeService.adminReviewRecording(
    req.user as IUser,
    recordingId,
    req.body,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: req.body.action === "approve" ? "Đã duyệt recording" : "Đã từ chối recording",
    data: recording,
  });
});

/**
 * GET /api/karaoke/admin/stats
 * Thống kê tổng quan karaoke.
 */
export const adminGetStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await karaokeService.adminGetStats();
  res.status(httpStatus.OK).json({
    success: true,
    data: stats,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// USER: Permission Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/karaoke/my-permission
 * User xem quyền upload của mình.
 */
export const getMyPermission = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const permission = await karaokeService.getMyPermission(String(user._id));
  res.status(httpStatus.OK).json({
    success: true,
    data: permission,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// USER: Recording CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/karaoke/recordings
 * Upload recording (audio file + metadata).
 * File audio được upload qua multer → B2.
 */
export const uploadRecording = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;

  // File audio đã được multer-s3 stream trực tiếp lên B2
  const file = req.file as Express.Multer.File & { key?: string; location?: string };
  if (!file || !file.key) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "Vui lòng gửi file audio",
    });
  }

  // Check permission trước
  await karaokeService.checkUploadPermission(
    String(user._id),
    file.size,
    req.body.audioDuration ? Number(req.body.audioDuration) : undefined,
  );

  // Tạo URL từ CDN domain hoặc B2 location
  const cdnDomain = process.env.CLOUDFLARE_DOMAIN;
  const audioUrl = cdnDomain
    ? `https://${cdnDomain}/${file.key}`
    : file.location || file.key;

  // Tạo recording record
  const recording = await karaokeService.createRecording(
    user,
    req.body,
    audioUrl,
    file.size,
  );

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Upload recording thành công",
    data: recording,
  });
});

/**
 * GET /api/karaoke/my-recordings
 * Recordings của user hiện tại.
 */
export const getMyRecordings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const result = await karaokeService.getMyRecordings(String(user._id), req.query as any);
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/karaoke/recordings
 * Recordings public (cộng đồng feed).
 */
export const getPublicRecordings = catchAsync(async (req: Request, res: Response) => {
  const result = await karaokeService.getPublicRecordings(req.query as any);
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/karaoke/recordings/:id
 * Chi tiết recording.
 */
export const getRecordingById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser | undefined;
  const recordingId = req.params.id as string;
  const recording = await karaokeService.getRecordingById(
    recordingId,
    user ? String(user._id) : undefined,
  );
  res.status(httpStatus.OK).json({
    success: true,
    data: recording,
  });
});

/**
 * PATCH /api/karaoke/recordings/:id
 * Cập nhật metadata recording.
 */
export const updateRecording = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  const recording = await karaokeService.updateRecording(
    req.user as IUser,
    recordingId,
    req.body,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã cập nhật recording",
    data: recording,
  });
});

/**
 * POST /api/karaoke/recordings/:id/submit
 * Gửi yêu cầu duyệt.
 */
export const submitForReview = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  const recording = await karaokeService.submitForReview(
    req.user as IUser,
    recordingId,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã gửi yêu cầu duyệt. Admin sẽ xem xét sớm nhất.",
    data: recording,
  });
});

/**
 * DELETE /api/karaoke/recordings/:id
 * Xóa recording.
 */
export const deleteRecording = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  const result = await karaokeService.deleteRecording(req.user as IUser, recordingId);
  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});

/**
 * GET /api/karaoke/search-youtube?q=...
 * Tìm kiếm video Youtube (public)
 */
export const searchYoutube = catchAsync(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  
  const results = await youtubeService.searchYoutube(query, limit);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: results,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  const user = req.user as IUser;
  
  const result = await karaokeService.toggleLike(String(user._id), recordingId);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

export const incrementPlayCount = catchAsync(async (req: Request, res: Response) => {
  const recordingId = req.params.id as string;
  
  await karaokeService.incrementPlayCount(recordingId);
  
  res.status(httpStatus.OK).json({
    success: true,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // Admin
  grantPermission,
  revokePermission,
  getPermissions,
  adminGetRecordings,
  adminReviewRecording,
  adminGetStats,

  // User
  getMyPermission,
  uploadRecording,
  updateRecording,
  submitForReview,
  deleteRecording,
  getMyRecordings,
  
  // Public
  getPublicRecordings,
  getRecordingById,
  
  // Youtube
  searchYoutube,

  // Community
  toggleLike,
  incrementPlayCount,
};
