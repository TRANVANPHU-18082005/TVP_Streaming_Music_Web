// services/karaoke.service.ts

import mongoose from "mongoose";
import httpStatus from "http-status";
import KaraokeRecording, { IKaraokeRecording } from "../models/KaraokeRecording";
import KaraokePermission, { IKaraokePermission } from "../models/KaraokePermission";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import type {
  UploadRecordingInput,
  UpdateRecordingInput,
  AdminReviewInput,
  GrantPermissionInput,
  RecordingFilterInput,
  AdminRecordingFilterInput,
  PermissionFilterInput,
} from "../validations/karaoke.validation";
import {
  buildCacheKey,
  invalidateCachePrefixes,
  rememberJson,
} from "../utils/cacheHelper";

function invalidateKaraokePublic(): void {
  invalidateCachePrefixes(["karaoke:public:*"]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const RECORDING_POPULATE = [
  { path: "user", select: "fullName username avatar" },
];

const RECORDING_POPULATE_ADMIN = [
  { path: "user", select: "fullName username avatar email" },
  { path: "reviewedBy", select: "fullName username" },
];

const PERMISSION_POPULATE = [
  { path: "user", select: "fullName username avatar email" },
  { path: "grantedBy", select: "fullName username" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION: Admin quản lý quyền upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cấp hoặc cập nhật quyền upload karaoke cho user.
 * Admin gọi — không cần user trả phí.
 */
const grantPermission = async (
  adminUser: IUser,
  targetUserId: string,
  dto: GrantPermissionInput,
) => {
  // Kiểm tra user tồn tại
  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy user");
  }

  // Upsert: tạo mới hoặc cập nhật nếu đã có
  const permission = await KaraokePermission.findOneAndUpdate(
    { user: targetUserId },
    {
      $set: {
        uploadEnabled: dto.uploadEnabled,
        uploadLimit: dto.uploadLimit,
        maxDuration: dto.maxDuration,
        maxFileSize: dto.maxFileSize,
        note: dto.note || "",
        grantedBy: adminUser._id,
        grantedAt: new Date(),
        revokedAt: dto.uploadEnabled ? null : new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).populate(PERMISSION_POPULATE);

  return permission;
};

/**
 * Thu hồi quyền upload.
 */
const revokePermission = async (adminUser: IUser, targetUserId: string) => {
  const permission = await KaraokePermission.findOne({ user: targetUserId });
  if (!permission) {
    throw new ApiError(httpStatus.NOT_FOUND, "User chưa được cấp quyền karaoke");
  }

  permission.uploadEnabled = false;
  permission.revokedAt = new Date();
  await permission.save();

  return { message: "Đã thu hồi quyền upload karaoke" };
};

/**
 * Lấy danh sách permissions (admin).
 */
const getPermissions = async (filter: PermissionFilterInput) => {
  const { page, limit, uploadEnabled, keyword } = filter;
  const skip = (page - 1) * limit;

  const query: any = {};

  if (uploadEnabled !== undefined) {
    query.uploadEnabled = uploadEnabled;
  }

  // Tìm theo tên/email user nếu có keyword
  if (keyword) {
    const userIds = await User.find({
      $or: [
        { fullName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { username: { $regex: keyword, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    query.user = { $in: userIds.map((u) => u._id) };
  }

  const [data, total] = await Promise.all([
    KaraokePermission.find(query)
      .populate(PERMISSION_POPULATE)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    KaraokePermission.countDocuments(query),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Lấy permission của user hiện tại (user tự check).
 */
const getMyPermission = async (userId: string) => {
  const permission = await KaraokePermission.findOne({ user: userId }).lean();

  if (!permission) {
    return {
      uploadEnabled: false,
      uploadLimit: 0,
      uploadsUsed: 0,
      uploadsRemaining: 0,
      maxDuration: 0,
      maxFileSize: 0,
      hasPermission: false,
    };
  }

  const uploadsRemaining =
    permission.uploadLimit === -1
      ? -1 // unlimited
      : Math.max(0, permission.uploadLimit - permission.uploadsUsed);

  return {
    ...permission,
    uploadsRemaining,
    hasPermission: permission.uploadEnabled && uploadsRemaining !== 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RECORDING: User CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kiểm tra user có quyền upload không + còn quota không.
 * Gọi trước khi upload.
 */
const checkUploadPermission = async (userId: string, fileSize?: number, duration?: number) => {
  const permission = await KaraokePermission.findOne({ user: userId });

  if (!permission || !permission.uploadEnabled) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Bạn chưa được cấp quyền upload karaoke. Vui lòng liên hệ Admin.",
      "KARAOKE_NO_PERMISSION",
    );
  }

  // Check quota
  if (permission.uploadLimit !== -1 && permission.uploadsUsed >= permission.uploadLimit) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Bạn đã sử dụng hết ${permission.uploadLimit} lượt upload. Vui lòng liên hệ Admin để nâng hạn.`,
      "KARAOKE_QUOTA_EXHAUSTED",
    );
  }

  // Check max duration
  if (duration && permission.maxDuration > 0 && duration > permission.maxDuration) {
    const maxMinutes = Math.floor(permission.maxDuration / 60);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Thời lượng recording vượt quá giới hạn cho phép (${maxMinutes} phút).`,
      "KARAOKE_DURATION_EXCEEDED",
    );
  }

  // Check max file size
  if (fileSize && permission.maxFileSize > 0 && fileSize > permission.maxFileSize) {
    const maxMB = Math.floor(permission.maxFileSize / 1024 / 1024);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Kích thước file vượt quá giới hạn cho phép (${maxMB}MB).`,
      "KARAOKE_FILE_SIZE_EXCEEDED",
    );
  }

  return permission;
};

/**
 * Tạo recording mới (user upload audio lên cloud).
 * Chỉ gọi sau khi audio đã upload B2 thành công.
 */
const createRecording = async (
  user: IUser,
  dto: UploadRecordingInput,
  audioUrl: string,
  audioSize: number,
) => {
  // Check permission trước
  await checkUploadPermission(String(user._id), audioSize, dto.audioDuration);

  const recording = await KaraokeRecording.create({
    user: user._id,
    title: dto.title,
    youtubeVideoId: dto.youtubeVideoId,
    youtubeTitle: dto.youtubeTitle,
    youtubeThumbnail: dto.youtubeThumbnail || "",
    audioUrl,
    audioDuration: dto.audioDuration,
    audioSize,
    description: dto.description || "",
    tags: dto.tags || [],
    backingVolume: dto.backingVolume,
    voiceVolume: dto.voiceVolume,
    syncOffsetMs: dto.syncOffsetMs,
    startAtSec: dto.startAtSec,
    status: "uploaded", // Chưa gửi duyệt
    isPublic: false,
  });

  // Tăng counter uploads
  await KaraokePermission.updateOne(
    { user: user._id },
    { $inc: { uploadsUsed: 1 } },
  );

  return recording.populate(RECORDING_POPULATE);
};

/**
 * Lấy recordings của user hiện tại.
 */
const getMyRecordings = async (userId: string, filter: RecordingFilterInput) => {
  const { page, limit, status, keyword, sort } = filter;
  const skip = (page - 1) * limit;

  const query: any = { user: userId };

  if (status) query.status = status;
  if (keyword) {
    query.$text = { $search: keyword };
  }

  const sortMap: Record<string, any> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    popular: { playCount: -1 },
    most_liked: { likeCount: -1 },
  };

  const [data, total] = await Promise.all([
    KaraokeRecording.find(query)
      .populate(RECORDING_POPULATE)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    KaraokeRecording.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Lấy recordings public (cộng đồng).
 */
const getPublicRecordings = async (filter: RecordingFilterInput) => {
  const cacheKey = buildCacheKey(
    "karaoke:public",
    "guest",
    filter as unknown as Record<string, unknown>,
  );
  return rememberJson(cacheKey, 60, () => loadPublicRecordings(filter));
};

const loadPublicRecordings = async (filter: RecordingFilterInput) => {
  const { page, limit, keyword, sort, userId } = filter;
  const skip = (page - 1) * limit;

  const query: any = {
    status: "approved",
    isPublic: true,
  };

  if (userId) query.user = userId;
  if (keyword) {
    query.$text = { $search: keyword };
  }

  const sortMap: Record<string, any> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    popular: { playCount: -1 },
    most_liked: { likeCount: -1 },
  };

  const [data, total] = await Promise.all([
    KaraokeRecording.find(query)
      .populate(RECORDING_POPULATE)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    KaraokeRecording.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Lấy recording detail.
 */
const getRecordingById = async (recordingId: string, requestUserId?: string) => {
  const recording = await KaraokeRecording.findById(recordingId)
    .populate(RECORDING_POPULATE)
    .lean();

  if (!recording) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
  }

  // Nếu chưa approved + public thì chỉ owner hoặc admin được xem
  if (recording.status !== "approved" || !recording.isPublic) {
    if (!requestUserId || recording.user._id.toString() !== requestUserId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
    }
  }

  return recording;
};

/**
 * Cập nhật recording metadata (chỉ khi status = uploaded hoặc rejected).
 */
const updateRecording = async (
  user: IUser,
  recordingId: string,
  dto: UpdateRecordingInput,
) => {
  const recording = await KaraokeRecording.findById(recordingId);
  if (!recording) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
  }

  // Chỉ owner mới được sửa
  if (recording.user.toString() !== String(user._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Bạn không có quyền chỉnh sửa recording này");
  }

  // Chỉ cho sửa khi chưa gửi duyệt hoặc bị rejected
  if (!["uploaded", "rejected"].includes(recording.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Không thể chỉnh sửa recording đang chờ duyệt hoặc đã được duyệt",
    );
  }

  if (dto.title) recording.title = dto.title;
  if (dto.description !== undefined) recording.description = dto.description;
  if (dto.tags) recording.tags = dto.tags;
  if (dto.backingVolume !== undefined) recording.backingVolume = dto.backingVolume;
  if (dto.voiceVolume !== undefined) recording.voiceVolume = dto.voiceVolume;
  if (dto.syncOffsetMs !== undefined) recording.syncOffsetMs = dto.syncOffsetMs;
  if (dto.startAtSec !== undefined) recording.startAtSec = dto.startAtSec;

  // Nếu từ rejected → chuyển lại uploaded để có thể gửi duyệt lại
  if (recording.status === "rejected") {
    recording.status = "uploaded";
    recording.rejectionReason = "";
  }

  await recording.save();
  return recording.populate(RECORDING_POPULATE);
};

/**
 * Gửi yêu cầu duyệt (uploaded → pending_review).
 */
const submitForReview = async (user: IUser, recordingId: string) => {
  const recording = await KaraokeRecording.findById(recordingId);
  if (!recording) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
  }

  if (recording.user.toString() !== String(user._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Bạn không có quyền thao tác recording này");
  }

  if (recording.status !== "uploaded") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Không thể gửi duyệt. Trạng thái hiện tại: ${recording.status}`,
    );
  }

  recording.status = "pending_review";
  recording.isPublic = true; // Đánh dấu muốn public
  await recording.save();

  return recording.populate(RECORDING_POPULATE);
};

/**
 * Xóa recording (owner hoặc admin).
 */
const deleteRecording = async (user: IUser, recordingId: string) => {
  const recording = await KaraokeRecording.findById(recordingId);
  if (!recording) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
  }

  const isOwner = recording.user.toString() === String(user._id);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, "Bạn không có quyền xóa recording này");
  }

  // TODO: Xóa file audio trên B2 (gọi deleteFromB2 utility)

  await recording.deleteOne();
  invalidateKaraokePublic();

  // Giảm counter uploads nếu owner xóa
  if (isOwner) {
    await KaraokePermission.updateOne(
      { user: user._id, uploadsUsed: { $gt: 0 } },
      { $inc: { uploadsUsed: -1 } },
    );
  }

  return { message: "Đã xóa recording thành công" };
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Review recordings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy danh sách recordings cho admin (filter status).
 */
const adminGetRecordings = async (filter: AdminRecordingFilterInput) => {
  const { page, limit, status, keyword, sort } = filter;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (status) query.status = status;
  if (keyword) {
    query.$text = { $search: keyword };
  }

  const sortMap: Record<string, any> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    popular: { playCount: -1 },
    most_liked: { likeCount: -1 },
  };

  const [data, total, pendingCount] = await Promise.all([
    KaraokeRecording.find(query)
      .populate(RECORDING_POPULATE_ADMIN)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    KaraokeRecording.countDocuments(query),
    KaraokeRecording.countDocuments({ status: "pending_review" }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      pendingCount, // Cho admin biết còn bao nhiêu cần duyệt
    },
  };
};

/**
 * Admin duyệt hoặc từ chối recording.
 */
const adminReviewRecording = async (
  admin: IUser,
  recordingId: string,
  dto: AdminReviewInput,
) => {
  const recording = await KaraokeRecording.findById(recordingId);
  if (!recording) {
    throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy recording");
  }

  if (recording.status !== "pending_review") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Recording không ở trạng thái chờ duyệt (hiện tại: ${recording.status})`,
    );
  }

  recording.reviewedBy = admin._id as mongoose.Types.ObjectId;
  recording.reviewedAt = new Date();

  if (dto.action === "approve") {
    recording.status = "approved";
    recording.isPublic = true;
    recording.reviewNote = dto.reviewNote || "";
  } else {
    recording.status = "rejected";
    recording.isPublic = false;
    recording.rejectionReason = dto.rejectionReason || "";
    recording.reviewNote = dto.reviewNote || "";
  }

  await recording.save();
  invalidateKaraokePublic();

  // TODO: Gửi notification cho user qua Socket.IO / Notify model

  return recording.populate(RECORDING_POPULATE_ADMIN);
};

/**
 * Admin: Thống kê tổng quan karaoke.
 */
const adminGetStats = async () => {
  const [
    totalRecordings,
    pendingReview,
    approved,
    rejected,
    totalPermissions,
    activePermissions,
  ] = await Promise.all([
    KaraokeRecording.countDocuments(),
    KaraokeRecording.countDocuments({ status: "pending_review" }),
    KaraokeRecording.countDocuments({ status: "approved" }),
    KaraokeRecording.countDocuments({ status: "rejected" }),
    KaraokePermission.countDocuments(),
    KaraokePermission.countDocuments({ uploadEnabled: true }),
  ]);

  return {
    recordings: {
      total: totalRecordings,
      pendingReview,
      approved,
      rejected,
    },
    permissions: {
      total: totalPermissions,
      active: activePermissions,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LIKE & PLAY COUNTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tăng lượt nghe
 */
const incrementPlayCount = async (recordingId: string) => {
  await KaraokeRecording.findByIdAndUpdate(recordingId, {
    $inc: { playCount: 1 }
  });
};

/**
 * Toggle Like
 */
const toggleLike = async (userId: string, recordingId: string) => {
  const recording = await KaraokeRecording.findById(recordingId);
  if (!recording) throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bản thu");

  const userIdObj = new mongoose.Types.ObjectId(userId);
  const hasLiked = recording.likedBy.includes(userIdObj);

  if (hasLiked) {
    recording.likedBy = recording.likedBy.filter(id => !id.equals(userIdObj));
    recording.likeCount = Math.max(0, recording.likeCount - 1);
  } else {
    recording.likedBy.push(userIdObj);
    recording.likeCount += 1;
  }

  await recording.save();
  invalidateKaraokePublic();
  return { hasLiked: !hasLiked, likeCount: recording.likeCount };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // Permission (Admin)
  grantPermission,
  revokePermission,
  getPermissions,
  getMyPermission,

  // Recording (User)
  checkUploadPermission,
  createRecording,
  getMyRecordings,
  getPublicRecordings,
  getRecordingById,
  updateRecording,
  submitForReview,
  deleteRecording,

  // Admin Review
  adminGetRecordings,
  adminReviewRecording,
  adminGetStats,

  // Community Interactions
  incrementPlayCount,
  toggleLike,
};
