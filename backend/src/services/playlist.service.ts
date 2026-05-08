// services/playlist.service.ts

import mongoose, { Types } from "mongoose";
import httpStatus from "http-status";
import Playlist, { IPlaylist } from "../models/Playlist";
import Track from "../models/Track";
import { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { generateUniqueSlug, generatePlaylistSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseTags } from "../utils/helper";
import {
  CreatePlaylistInput,
  PlaylistUserFilterInput,
  PlaylistAdminFilterInput,
  UpdatePlaylistInput,
} from "../validations/playlist.validation";
import escapeStringRegexp from "escape-string-regexp";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidatePlaylistCache,
  invalidateUserPlaylistCache,
} from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";
import themeColorService from "./themeColor.service";
import { APP_CONFIG } from "../config/constants";
import { da, is, vi } from "zod/v4/locales";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VIBRANT_COLORS = [
  "#1db954",
  "#2196f3",
  "#ff5722",
  "#9c27b0",
  "#e91e63",
  "#ffc107",
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function randomVibrantColor(): string {
  return VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];
}

/**
 * Sync stats sau write ops — fire-and-forget, không block response.
 */
async function syncPlaylistStats(playlistId: string): Promise<void> {
  try {
    await Playlist.calculateStats(playlistId);
  } catch (err) {
    console.error(
      "[PlaylistService] calculateStats error (non-critical):",
      err,
    );
  }
}

/**
 * Helper phân quyền chỉnh sửa — dùng ở nhiều method.
 */
function assertCanEdit(
  playlist: any,
  currentUser: IUser,
  allowCollaborators = true,
): void {
  const isOwner = playlist.user.toString() === currentUser._id.toString();
  const isAdmin = currentUser.role === "admin";
  const isCollaborator =
    allowCollaborators &&
    playlist.collaborators?.some(
      (id: any) => id.toString() === currentUser._id.toString(),
    );
  const isSystemAdmin = playlist.isSystem && isAdmin;

  if (!isOwner && !isAdmin && !isCollaborator && !isSystemAdmin) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Bạn không có quyền chỉnh sửa Playlist này",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class PlaylistService {
  // ── 1. CREATE PLAYLIST ─────────────────────────────────────────────────────

  async createPlaylistByAdmin(
    currentUser: IUser,
    data: CreatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const isSystemRequest = String(data.isSystem) === "true";

    // 1. Phân quyền chặt chẽ
    if (isSystemRequest && currentUser.role !== "admin") {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Chỉ Admin mới có thể tạo System Playlist",
      );
    }

    // 2. Xác định Owner
    let targetUserId = currentUser._id;
    if (data.userId && Types.ObjectId.isValid(data.userId)) {
      targetUserId = new Types.ObjectId(data.userId);
    }

    // 3. I/O nặng (Ngoài Transaction)
    const coverPath = file?.path ?? "";
    let themeColor = "#1db954";
    if (coverPath) {
      try {
        themeColor = await themeColorService.extractThemeColor(coverPath);
      } catch (err) {
        console.error("[AdminPlaylistService] Color extraction failed", err);
      }
    }
    const slug = generatePlaylistSlug(data.title);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 4. Xử lý Collaborators an toàn
      const collaboratorIds = data.collaborators
        ? parseTags(data.collaborators)
          .filter((id) => Types.ObjectId.isValid(id)) // Bảo vệ định dạng ID
          .map((id) => new Types.ObjectId(id))
        : [];

      const [newPlaylist] = await Playlist.create(
        [
          {
            ...data, // Chứa title, description, visibility...
            slug,
            user: targetUserId,
            isSystem: isSystemRequest,
            coverImage: coverPath,
            themeColor,
            publishAt: data.publishAt ? new Date(data.publishAt) : new Date(),
            tags: data.tags ? parseTags(data.tags) : [],
            collaborators: collaboratorIds,
            tracks: [], // Mặc định trống khi tạo mới
            totalTracks: 0,
            totalDuration: 0,
            playCount: 0,
          },
        ],
        { session },
      );

      // 5. Cập nhật Counter cho User (Trừ khi đó là System Playlist của Admin)
      if (!isSystemRequest) {
        await mongoose
          .model("User")
          .findByIdAndUpdate(
            targetUserId,
            { $inc: { totalPlaylists: 1 } },
            { session },
          );
      }

      await session.commitTransaction();

      // 6. Hậu kỳ (Async)
      Promise.allSettled([
        invalidatePlaylistCache(newPlaylist._id.toString()),
        isSystemRequest
          ? cacheRedis.del("playlists:system:all")
          : Promise.resolve(),
      ]).catch(console.error);

      return newPlaylist;
    } catch (error) {
      await session.abortTransaction();
      if (coverPath)
        deleteFileFromCloud(coverPath, "image").catch(console.error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 1B. QUICK CREATE ───────────────────────────────────────────────────────
  async createQuickPlaylist(
    currentUser: IUser,
    payload?: { title?: string; visibility?: string },
  ) {
    let finalTitle = payload?.title?.trim();

    // 1. Logic đặt tên thông minh
    if (!finalTitle) {
      const count = await Playlist.countDocuments({
        user: currentUser._id,
        isSystem: false,
      });
      finalTitle = `Danh sách phát của tôi #${count + 1}`;
    } else {
      // Cắt bớt nếu tiêu đề quá dài
      finalTitle = finalTitle.substring(0, 100);
    }

    const finalVisibility = (payload?.visibility ?? "public") as
      | "public"
      | "private"
      | "unlisted";
    const uniqueSlug = generatePlaylistSlug(finalTitle);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Tạo Playlist
      const [newPlaylist] = await Playlist.create(
        [
          {
            title: finalTitle,
            slug: uniqueSlug,
            user: currentUser._id,
            description: "",
            coverImage: "",
            themeColor: randomVibrantColor(), // Tạo điểm nhấn cho UI
            visibility: finalVisibility,
            isSystem: false,
            tracks: [],
            totalTracks: 0,
            totalDuration: 0,
            playCount: 0,
          },
        ],
        { session },
      );

      // 3. Đồng bộ counter ở User (Quan trọng để Profile khớp số liệu)
      await mongoose
        .model("User")
        .findByIdAndUpdate(
          currentUser._id,
          { $inc: { totalPlaylists: 1 } },
          { session },
        );

      await session.commitTransaction();

      // 4. Hậu kỳ (Async)
      invalidateUserPlaylistCache(
        newPlaylist._id.toString(),
        currentUser._id.toString(),
      ).catch(console.error);

      return newPlaylist;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  // ── 2. UPDATE PLAYLIST ─────────────────────────────────────────────────────

  async updatePlaylistByAdmin(
    id: string,
    currentUser: IUser,
    data: UpdatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const playlist = await Playlist.findById(id);
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    // Admin luôn có quyền, hoặc Owner có quyền
    assertCanEdit(playlist, currentUser);

    const oldCoverImage = playlist.coverImage;
    const oldUserId = playlist.user.toString();
    let isImageUpdated = false;
    let newThemeColor = data.themeColor;

    // 1. Tiền xử lý I/O (Ngoài Transaction)
    if (file) {
      isImageUpdated = true;
      try {
        newThemeColor = await themeColorService.extractThemeColor(file.path);
      } catch (err) {
        console.error("[AdminPlaylist] Color extraction failed", err);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Logic Tráo đổi Owner (Chỉ Admin mới làm được)
      if (
        currentUser.role === "admin" &&
        data.userId &&
        data.userId !== oldUserId
      ) {
        if (!Types.ObjectId.isValid(data.userId)) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "ID người sở hữu mới không hợp lệ",
          );
        }

        // Sync counter cho cả 2 người
        await Promise.all([
          mongoose
            .model("User")
            .findByIdAndUpdate(
              oldUserId,
              { $inc: { totalPlaylists: -1 } },
              { session },
            ),
          mongoose
            .model("User")
            .findByIdAndUpdate(
              data.userId,
              { $inc: { totalPlaylists: 1 } },
              { session },
            ),
        ]);
        playlist.user = new Types.ObjectId(data.userId);
      }

      // 3. Metadata
      if (data.title) playlist.title = data.title;
      if (data.description !== undefined)
        playlist.description = data.description;
      if (data.type) playlist.type = data.type;
      if (data.visibility) playlist.visibility = data.visibility;
      if (data.tags) playlist.tags = parseTags(data.tags);

      if (data.collaborators) {
        playlist.collaborators = parseTags(data.collaborators)
          .filter((cid) => Types.ObjectId.isValid(cid))
          .map((cid) => new Types.ObjectId(cid));
      }

      if (data.publishAt) playlist.publishAt = new Date(data.publishAt);
      if (currentUser.role === "admin" && data.isSystem !== undefined) {
        playlist.isSystem = String(data.isSystem) === "true";
      }

      // 4. Image & Color
      if (file) {
        playlist.coverImage = file.path;
        if (newThemeColor) playlist.themeColor = newThemeColor;
      } else if (data.themeColor) {
        playlist.themeColor = data.themeColor;
      }

      await playlist.save({ session });
      await session.commitTransaction();

      // 5. Hậu kỳ (Async)
      Promise.allSettled([
        syncPlaylistStats(id), // Đảm bảo stats luôn chính xác sau update
        invalidatePlaylistCache(id),
        invalidateUserPlaylistCache(id, oldUserId),
        data.userId
          ? invalidateUserPlaylistCache(id, data.userId)
          : Promise.resolve(),
        isImageUpdated && oldCoverImage && !oldCoverImage.includes("default")
          ? deleteFileFromCloud(oldCoverImage, "image")
          : Promise.resolve(),
        // Nếu là playlist hệ thống, xóa thêm cache danh sách public
        playlist.isSystem
          ? cacheRedis.del("playlists:system:all")
          : Promise.resolve(),
      ]).catch(console.error);

      return playlist;
    } catch (error) {
      await session.abortTransaction();
      if (file) deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  // ── 2B. QUICK EDIT ───────────────────────────────────────────────────────

  async editQuickPlaylist(
    id: string,
    currentUser: IUser,
    payload: { title?: string; visibility?: string },
  ) {
    // 1. Tìm và kiểm tra quyền sở hữu nhanh
    const playlist = await Playlist.findById(id).select(
      "user title visibility slug",
    );

    if (!playlist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy danh sách phát");
    }

    // Chỉ chủ sở hữu hoặc Admin mới có quyền edit nhanh
    const isOwner = playlist.user.toString() === currentUser._id.toString();
    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền chỉnh sửa danh sách phát này",
      );
    }

    // 2. Chuẩn bị dữ liệu cập nhật
    const updateData: any = {};

    if (payload.title !== undefined) {
      const newTitle = payload.title.trim().substring(0, 100);
      if (newTitle && newTitle !== playlist.title) {
        updateData.title = newTitle;
        // Cập nhật lại slug dựa trên title mới (dùng NanoID để nhanh)
        updateData.slug = generatePlaylistSlug(newTitle);
      }
    }

    if (payload.visibility) {
      updateData.visibility = payload.visibility;
    }

    // 3. Thực hiện cập nhật Atomic
    if (Object.keys(updateData).length === 0) return playlist;

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, lean: true },
    );

    // 4. Invalidate Cache (Fire-and-forget)
    Promise.allSettled([
      syncPlaylistStats(id), // Đảm bảo stats luôn chính xác sau update
      invalidatePlaylistCache(id),
      invalidateUserPlaylistCache(id, playlist.user.toString()),
      Promise.resolve(),
    ]).catch(console.error);

    return updatedPlaylist;
  }
  // ── 3. DELETE PLAYLIST ─────────────────────────────────────────────────────

  async deletePlaylist(id: string, currentUser: IUser) {
    const playlist = await Playlist.findById(id);
    if (!playlist || playlist.isDeleted)
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Playlist không tồn tại hoặc đã bị xóa",
      );

    // 1. Phân quyền
    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xóa Playlist này",
      );

    if (playlist.isSystem && !isAdmin)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Chỉ Admin mới được xóa Playlist hệ thống",
      );

    const ownerId = playlist.user.toString();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Thực hiện xóa mềm
      await Playlist.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          visibility: "private", // Ẩn ngay lập tức
          deletedAt: new Date(),
        },
        { session },
      );

      // 3. Giảm counter cho User (Trừ khi là System Playlist)
      if (!playlist.isSystem) {
        await mongoose
          .model("User")
          .findByIdAndUpdate(
            ownerId,
            { $inc: { totalPlaylists: -1 } },
            { session },
          );
      }

      await session.commitTransaction();

      // 4. Hậu kỳ (Async)
      Promise.allSettled([
        invalidatePlaylistCache(id),
        invalidateUserPlaylistCache(id, ownerId),

        // Lưu ý: Xóa mềm thì KHÔNG xóa ảnh trên Cloud để có thể restore
        playlist.isSystem
          ? cacheRedis.del("playlists:system:all")
          : Promise.resolve(),
      ]).catch(console.error);

      return { message: "Xóa playlist thành công", _id: id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 4. ADD TRACKS ─────────────────────────────────────────────────────────
  async addTracks(playlistId: string, trackIds: string[], currentUser: IUser) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    // 1. Giới hạn số lượng bài hát (Ví dụ: 1000 bài)
    const MAX_TRACKS = 1000;
    if (playlist.tracks.length >= MAX_TRACKS) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Danh sách phát đã đạt giới hạn ${MAX_TRACKS} bài hát`,
      );
    }

    // 2. Validate tracks (Chỉ lấy bài hát public/ready và chưa bị xóa)
    const validTracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
      isPublic: true,
      isDeleted: false,
    })
      .select("_id")
      .lean();

    if (!validTracks.length)
      return { message: "Không tìm thấy bài hát hợp lệ để thêm", count: 0 };

    // 3. Lọc trùng lặp
    const existingSet = new Set(playlist.tracks.map((id) => id.toString()));
    const newIds = validTracks
      .filter((t) => !existingSet.has(t._id.toString()))
      .map((t) => t._id)
      .slice(0, MAX_TRACKS - playlist.tracks.length); // Đảm bảo không vượt quá giới hạn sau khi thêm

    if (!newIds.length)
      return { message: "Tất cả bài hát đã có trong playlist", count: 0 };

    // 4. Atomic push và cập nhật stats ngay lập tức
    await Playlist.updateOne(
      { _id: playlistId },
      {
        $push: { tracks: { $each: newIds } },
        // Có thể increment totalTracks ở đây luôn nếu không muốn đợi syncPlaylistStats
        // $inc: { totalTracks: newIds.length }
      },
    );

    // 5. Hậu kỳ (Async)
    const ownerId = playlist.user.toString();
    Promise.allSettled([
      syncPlaylistStats(playlistId),
      this.refreshSmartCover(
        playlistId,
        newIds.length + playlist.tracks.length === 0,
      ), // Cập nhật cover thông minh nếu cần
      invalidatePlaylistCache(playlistId),
      // Xóa cache cho cả chủ sở hữu và người đang thực hiện (nếu là collaborator)
      invalidateUserPlaylistCache(playlistId, ownerId),
      ownerId !== currentUser._id.toString()
        ? invalidateUserPlaylistCache(playlistId, currentUser._id.toString())
        : Promise.resolve(),
    ]).catch(console.error);

    return {
      message: `Đã thêm ${newIds.length} bài hát thành công`,
      count: newIds.length,
      addedTrackIds: newIds,
    };
  }

  // ── 5. REMOVE TRACKS ──────────────────────────────────────────────────────
  async removeTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    // 1. Lọc ra các ID thực sự có trong playlist để xóa
    const currentSet = new Set(playlist.tracks.map((id) => id.toString()));
    const toRemoveIds = trackIds.filter((id) => currentSet.has(id));

    if (!toRemoveIds.length)
      return {
        message: "Không có bài hát nào trong danh sách cần xóa",
        removedCount: 0,
      };

    // 2. Chuyển đổi sang ObjectId để MongoDB $pullAll hoạt động chính xác
    const objectIds = toRemoveIds.map((id) => new Types.ObjectId(id));

    // 3. Thực hiện xóa hàng loạt (Atomic)
    await Playlist.updateOne(
      { _id: playlistId },
      { $pullAll: { tracks: objectIds } },
    );

    // 4. Hậu kỳ (Async)
    const ownerId = playlist.user.toString();
    const currentUserId = currentUser._id.toString();

    Promise.allSettled([
      syncPlaylistStats(playlistId),
      this.refreshSmartCover(
        playlistId,
        playlist.tracks.length - toRemoveIds.length === 0,
      ), // Cập nhật cover thông minh nếu cần
      invalidatePlaylistCache(playlistId),
      // Invalidate cho chủ sở hữu
      invalidateUserPlaylistCache(playlistId, ownerId),
      // Nếu người xóa là cộng tác viên, xóa luôn cache của họ
      ownerId !== currentUserId
        ? invalidateUserPlaylistCache(playlistId, currentUserId)
        : Promise.resolve(),
    ]).catch(console.error);

    return {
      message: `Đã xóa ${toRemoveIds.length} bài hát thành công`,
      removedCount: toRemoveIds.length,
      removedTrackIds: toRemoveIds,
    };
  }

  // ── 6. REORDER TRACKS ─────────────────────────────────────────────────────
  async reorderTracks(
    playlistId: string,
    newTrackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    // 1. Kiểm tra số lượng
    if (newTrackIds.length !== playlist.tracks.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Số lượng bài hát không khớp: yêu cầu ${playlist.tracks.length}, nhận được ${newTrackIds.length}`,
      );
    }

    // 2. Kiểm tra tính toàn vẹn (Sử dụng Set để tối ưu tốc độ kiểm tra chéo)
    const currentIdsStr = playlist.tracks.map((id) => id.toString());
    const currentSet = new Set(currentIdsStr);

    // Check xem có ID nào lạ lẫm không
    const isValid = newTrackIds.every((id) => currentSet.has(id));
    if (!isValid) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Danh sách bài hát mới chứa ID không thuộc playlist này",
      );
    }

    // 3. Thực hiện cập nhật
    const objectIds = newTrackIds.map((id) => new Types.ObjectId(id));
    await Playlist.updateOne(
      { _id: playlistId },
      { $set: { tracks: objectIds } },
    );

    // 4. Hậu kỳ (Async)
    const ownerId = playlist.user.toString();
    Promise.allSettled([
      invalidatePlaylistCache(playlistId),
      invalidateUserPlaylistCache(playlistId, ownerId),
      // Nếu người reorder là collaborator, xóa luôn cache của họ
      ownerId !== currentUser._id.toString()
        ? invalidateUserPlaylistCache(playlistId, currentUser._id.toString())
        : Promise.resolve(),
    ]).catch(console.error);

    return { message: "Đã cập nhật thứ tự bài hát thành công" };
  }

  // ── 9. REFRESH SMART COVER ────────────────────────────────────────────────

  /**
   * FIX: Query Track collection trực tiếp thay vì populate tracks field.
   * Playlist.tracks là mảng ObjectId — populate trực tiếp không hoạt động
   * trong context này (không phải virtual relationship).
   */
  async refreshSmartCover(
    playlistId: string,
    forceReset = false,
  ): Promise<void> {
    const playlist = await Playlist.findById(playlistId)
      .select("coverImage tracks")
      .lean();

    if (!playlist) return;

    // Reset cover nếu playlist trống
    if (forceReset || !playlist.tracks.length) {
      if (playlist.coverImage) {
        await Playlist.updateOne({ _id: playlistId }, { coverImage: "" });
      }
      return;
    }

    // Chỉ auto-set nếu chưa có cover
    if (playlist.coverImage) return;

    // FIX: Query Track collection trực tiếp
    const firstTrack = await Track.findOne({
      _id: { $in: playlist.tracks },
      status: "ready",
    })
      .select("coverImage")
      .lean();

    if (firstTrack?.coverImage) {
      await Playlist.updateOne(
        { _id: playlistId },
        { coverImage: firstTrack.coverImage },
      );
    }
  }

  // ── 10. TOGGLE VISIBILITY ─────────────────────────────────────────────────

  async toggleVisibility(playlistId: string, currentUser: IUser) {
    // 1. Kiểm tra quyền (Cho phép cả Admin nếu cần, hoặc chỉ Owner)
    const playlist = await Playlist.findById(playlistId).select(
      "user isSystem visibility",
    );

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    // Dùng hàm assert chung để đồng bộ logic phân quyền
    assertCanEdit(playlist, currentUser);

    // 2. Atomic Toggle bằng Pipeline
    const updated = await Playlist.findByIdAndUpdate(
      playlistId,
      [
        {
          $set: {
            visibility: {
              $cond: [{ $eq: ["$visibility", "public"] }, "private", "public"],
            },
          },
        },
      ],
      { new: true, select: "_id visibility user isSystem" },
    ).lean();

    // 3. Hậu kỳ (Async)
    const ownerId = updated!.user.toString();

    Promise.allSettled([
      invalidatePlaylistCache(playlistId),
      invalidateUserPlaylistCache(playlistId, ownerId),
      Promise.resolve(),
    ]).catch(console.error);

    return updated;
  }

  // ── 11. GET MY PLAYLISTS ──────────────────────────────────────────────────

  async getMyAllPlaylists(
    userId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 20);
    const skip = (page - 1) * limit;

    // 1. Tạo Cache Key dựa trên User và Phân trang
    const cacheKey = `playlist:list:owner:${userId}:page:${page}:limit:${limit}`;

    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Query thông minh: Chỉ lấy các trường cần cho UI (Thumbnail, Title, Stats)
    const playlists = await Playlist.find({
      user: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    // 3. Đếm tổng để FE làm Pagination
    const total = await Playlist.countDocuments({
      user: userId,
      isDeleted: false,
    });

    const result = {
      data: playlists,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // 4. Lưu Cache (Thời gian ngắn vì danh sách cá nhân hay thay đổi)
    await cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 300); // 5 phút

    return result;
  }

  // ── 12.A GET LIST BY ADMIN ──────────────────────────────────────────────────────────

  async getPlaylistsByAdmin(
    filter: PlaylistAdminFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";
    if (!isAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Admin mới được truy cập");
    }
    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      userId,
      type,
      visibility,
      sort,
      tag,
      isSystem,
      isDeleted,
    } = filter;

    const skip = (Number(page) - 1) * Number(limit);
    const query: Record<string, any> = {};

    // ── Privacy layer ──────────────────────────────────────────────────────

    // ── Search — consistent với album/track/artist ─────────────────────────
    let sortOption: Record<string, any>;
    let useTextScore = false;
    if (visibility) query.visibility = visibility;
    if (isDeleted !== undefined) query.isDeleted = isDeleted;
    if (keyword) {
      if (!sort) {
        query.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        const safe = escapeStringRegexp(keyword.substring(0, 100));
        query.title = { $regex: `^${safe}`, $options: "i" };
      }
    }

    if (userId && !query.$or) query.user = userId;
    if (type) query.type = type;
    if (isSystem !== undefined) query.isSystem = isSystem;
    if (tag) query.tags = tag;

    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, _id: 1 },
        trending: { playCount: -1, createdAt: -1, _id: 1 },
        newest: { createdAt: -1, _id: 1 },
        oldest: { createdAt: 1, _id: 1 },
        name: { title: 1, _id: 1 },
        duration: { totalDuration: -1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    let baseQuery = Playlist.find(query)
      .populate("user", "fullName avatar slug")
      .populate("collaborators", "fullName avatar slug")
      .select("-tracks") // Không bao giờ lấy mảng tracks ở list view
      .sort(sortOption!)
      .skip(skip)
      .limit(limit)
      .lean<IPlaylist & { score?: number }>();

    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }

    const [playlists, total] = await Promise.all([
      baseQuery.lean(),
      Playlist.countDocuments(query),
    ]);

    const result = {
      data: playlists,
      meta: {
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: Number(page) * Number(limit) < Number(total),
      },
    };

    return result;
  }
  // ── 12.B GET LIST BY USER ──────────────────────────────────────────────────────────

  async getPlaylistsByUser(
    filter: PlaylistUserFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const currentUserId = currentUser?._id?.toString();

    const cacheKey = buildCacheKey("playlist:list", userRole, filter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const { page = 1, limit = 12, keyword, type, sort, tag } = filter;

    const skip = (page - 1) * limit;
    const now = new Date();
    const query: Record<string, any> = {
      isDeleted: false,
      isSystem: true,
      visibility: "public",
      // 🔥 Bổ sung logic Hẹn giờ phát hành
      $or: [
        { publishAt: { $exists: false } },
        { publishAt: null },
        { publishAt: { $lte: now } },
      ],
    };

    // ── Search — consistent với album/track/artist ─────────────────────────
    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      if (!sort) {
        query.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        const safe = escapeStringRegexp(keyword.substring(0, 100));
        query.title = { $regex: `^${safe}`, $options: "i" };
      }
    }

    if (type) query.type = type;
    if (tag) query.tags = tag;

    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, _id: 1 },
        trending: { playCount: -1, createdAt: -1, _id: 1 },
        newest: { createdAt: -1, _id: 1 },
        name: { title: 1, _id: 1 },
        duration: { totalDuration: -1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    let baseQuery = Playlist.find(query)
      .populate("user", "fullName avatar slug")
      .populate("collaborators", "fullName avatar slug")
      .select("-tracks") // Không bao giờ lấy mảng tracks ở list view
      .sort(sortOption!)
      .skip(skip)
      .limit(limit)
      .lean<IPlaylist & { score?: number }>();

    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }

    const [playlists, total] = await Promise.all([
      baseQuery.lean(),
      Playlist.countDocuments(query),
    ]);

    const result = {
      data: playlists,
      meta: {
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: Number(page) * Number(limit) < Number(total),
      },
    };

    const isSensitive = currentUserId;
    const ttl = isSensitive ? 30 : 600 + Math.floor(Math.random() * 120);

    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }

  // ── 13. GET DETAIL ────────────────────────────────────────────────────────

  async getPlaylistDetail(id: string, currentUser?: IUser) {
    const userRole = currentUser?.role || "guest";
    const currentUserId = currentUser?._id?.toString();
    const cacheKey = buildCacheKey(`playlist:detail:${id}`, userRole, {
      currentUserId,
    });

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const query = { _id: id, isDeleted: false } as Record<string, any>;

    const playlist = await Playlist.findOne(query)
      .populate("user", "fullName avatar slug isVerified")
      .populate("collaborators", "fullName avatar slug")
      .lean();

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    // 3. Logic Quyền Truy Cập (Giữ nguyên logic của Phú)
    const isAdmin = userRole === "admin";
    const isOwner =
      currentUserId && (playlist.user as any)?._id.toString() === currentUserId;
    const isCollaborator =
      currentUserId &&
      playlist.collaborators.some(
        (c: any) => c._id?.toString() === currentUserId,
      );

    const hasAccess = isAdmin || isOwner || isCollaborator;

    if (!hasAccess) {
      if (playlist.visibility === "private")
        throw new ApiError(httpStatus.FORBIDDEN, "Đây là Playlist riêng tư");
      if (new Date(playlist.publishAt) > new Date())
        throw new ApiError(
          httpStatus.NOT_FOUND,
          "Playlist chưa được công khai",
        );
    }

    const { tracks, ...metadata } = playlist;
    const validTracks = await Track.find({
      _id: { $in: tracks },
      status: "ready",
      isPublic: true,
      isDeleted: false,
    })
      .select("_id")
      .lean();
    const result = {
      ...metadata,
      trackIds: validTracks.map((t) => t._id) || [],
    };

    // 4. Lưu Cache (TTL 1 giờ)
    await withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    );

    return result;
  }

  // ── 14. GET PLAYLIST TRACKS ───────────────────────────────────────────────

  async getPlaylistTracks(
    playlistId: string,
    filter: any,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const userId = currentUser?._id?.toString();
    const isAdmin = userRole === "admin";
    const currentUserId = currentUser?._id?.toString();

    const playlist = await Playlist.findById(playlistId)
      .select("visibility user collaborators tracks")
      .lean();

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Playlist");

    if (playlist.visibility !== "public" && !isAdmin) {
      const isOwner = userId && playlist.user?.toString() === userId;
      if (!isOwner) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền xem danh sách này",
        );
      }
    }
    if (!playlist.isDeleted && !isAdmin) {
      const isOwner = userId && playlist.user?.toString() === userId;
      if (!isOwner && playlist.visibility !== "public") {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền xem danh sách này",
        );
      }
    }
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Playlist");

    const isOwner =
      currentUserId && (playlist.user as any).toString() === currentUserId;
    const isCollab =
      currentUserId &&
      playlist.collaborators.some((id: any) => id.toString() === currentUserId);

    if (
      !isAdmin &&
      !isOwner &&
      !isCollab &&
      playlist.visibility === "private"
    ) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xem danh sách này",
      );
    }

    const cacheKey = buildCacheKey(
      `playlist:tracks:${playlistId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Cắt mảng ID theo phân trang (giữ nguyên thứ tự)
    const pagedTrackIds = playlist.tracks.slice(skip, skip + limit);

    if (!pagedTrackIds.length) {
      return {
        data: [],
        meta: {
          totalItems: Number(playlist.tracks.length),
          page: Number(page),
          pageSize: Number(limit),
          totalPages: Math.ceil(Number(playlist.tracks.length) / Number(limit)),
          hasNextPage: false,
        },
      };
    }

    const tracks = await Track.find({
      _id: { $in: pagedTrackIds },
      status: "ready",
      isPublic: true,
      isDeleted: false,
    })
      .select(
        "-plainLyrics -fileSize -errorReason -updatedAt -createdAt -isPublic -status -format -description -isrc -diskNumber -copyright -isDeleted -trackNumber -uploader -tags -__v",
      )
      .select(
        "title slug artist album hlsUrl coverImage duration lyricType lyricUrl moodVideo isExplicit",
      )
      .populate("artist", "name avatar slug")
      .populate("featuringArtists", "name slug avatar")
      .populate("album", "title coverImage slug")
      .populate("genres", "name slug")
      .populate({
        path: "moodVideo",
        select: "videoUrl loop",
      })
      .lean();

    // Bảo toàn thứ tự playlist (MongoDB $in không giữ thứ tự)
    const trackMap = new Map(tracks.map((t) => [t._id.toString(), t]));
    const sortedTracks = pagedTrackIds
      .map((id) => trackMap.get(id.toString()))
      .filter(Boolean);

    const result = {
      data: sortedTracks,
      meta: {
        totalItems: playlist.tracks.length,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(playlist.tracks.length / limit),
        hasNextPage: skip + limit < playlist.tracks.length,
      },
    };

    const ttl = 600 + Math.floor(Math.random() * 60);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }
}

export default new PlaylistService();
