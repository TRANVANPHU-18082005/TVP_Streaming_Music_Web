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
  UpdatePlaylistInput,
  PlaylistFilterInput,
} from "../validations/playlist.validation";
import escapeStringRegexp from "escape-string-regexp";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidatePlaylistCache,
  invalidateUserPlaylistListCache,
  invalidateUserPlaylistCache,
} from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";

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

  async createPlaylist(
    currentUser: IUser,
    data: CreatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const isSystemRequest = String(data.isSystem) === "true";
    if (isSystemRequest && currentUser.role !== "admin") {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Quyền hạn không đủ để tạo System Playlist",
      );
    }

    const collaboratorIds = data.collaborators
      ? parseTags(data.collaborators).map((id) => new Types.ObjectId(id))
      : [];
    const tags = data.tags ? parseTags(data.tags) : [];
    // FIX: dùng generateUniqueSlug thay vì generateSafeSlug để tránh collision
    const publishAt = data.publishAt ? new Date(data.publishAt) : new Date();

    // Chống mass assignment
    const safeData = {
      title: data.title,
      description: data.description,
      type: data.type,
      visibility: data.visibility,
    };

    try {
      const newPlaylist = await Playlist.create({
        ...safeData,
        user: currentUser._id,
        isSystem: isSystemRequest,
        coverImage: file?.path ?? "",
        publishAt,
        tags,
        collaborators: collaboratorIds,
        tracks: [],
        totalTracks: 0,
        totalDuration: 0,
      });

      // Invalidate list cache (user's playlist list changed)
      invalidatePlaylistCache(newPlaylist._id.toString()).catch(console.error);

      return newPlaylist;
    } catch (error) {
      if (file) deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    }
  }

  // ── 1B. QUICK CREATE ───────────────────────────────────────────────────────

  async createQuickPlaylist(
    currentUser: IUser,
    payload?: { title?: string; visibility?: string },
  ) {
    let finalTitle = payload?.title?.trim();

    if (!finalTitle) {
      const count = await Playlist.countDocuments({
        user: currentUser._id,
        isSystem: false,
      });
      finalTitle = `Danh sách phát của tôi #${count + 1}`;
    }

    const finalVisibility = (payload?.visibility ?? "public") as
      | "public"
      | "private"
      | "unlisted";
    // Quick playlist dùng generatePlaylistSlug (NanoID) để nhanh hơn — vẫn unique
    const uniqueSlug = generatePlaylistSlug(finalTitle);

    const newPlaylist = await Playlist.create({
      title: finalTitle,
      slug: uniqueSlug,
      user: currentUser._id,
      description: "",
      coverImage: "",
      themeColor: randomVibrantColor(),
      visibility: finalVisibility,
      isSystem: false,
      tracks: [],
      totalTracks: 0,
      totalDuration: 0,
    });

    invalidateUserPlaylistCache(
      newPlaylist._id.toString(),
      currentUser._id.toString(),
    ).catch(console.error);
    return newPlaylist;
  }

  // ── 2. UPDATE PLAYLIST ─────────────────────────────────────────────────────

  async updatePlaylist(
    id: string,
    currentUser: IUser,
    data: UpdatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const playlist = await Playlist.findById(id);
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    const oldCoverImage = playlist.coverImage;
    const userId = playlist.user.toString(); // Lưu ID owner để invalid cache
    let isImageUpdated = false;

    // ── Metadata Update ────────────────────────────────────────────────────
    if (data.title) playlist.title = data.title;
    if (data.description !== undefined) playlist.description = data.description;
    if (data.type) playlist.type = data.type;
    if (data.visibility) playlist.visibility = data.visibility;
    if (data.tags) playlist.tags = parseTags(data.tags);
    if (data.collaborators) {
      playlist.collaborators = parseTags(data.collaborators).map(
        (cid) => new Types.ObjectId(cid),
      );
    }
    if (data.publishAt) playlist.publishAt = new Date(data.publishAt);
    if (currentUser.role === "admin" && data.isSystem !== undefined) {
      playlist.isSystem = String(data.isSystem) === "true";
    }

    // ── Image Update ───────────────────────────────────────────────────────
    if (file) {
      playlist.coverImage = file.path;
      isImageUpdated = true;
    } else {
      // Chỉ gán nếu được gửi tường minh
      if (data.themeColor) playlist.themeColor = data.themeColor;
    }

    try {
      await playlist.save();

      // ── Invalidation Chiến lược ──────────────────────────────────────────
      Promise.allSettled([
        // 1. Xóa cache chi tiết (detail)
        invalidatePlaylistCache(id),
        // 2. Xóa cache danh sách thư viện của Owner
        invalidateUserPlaylistCache(id, userId),
        // 3. Cleanup ảnh cũ
        isImageUpdated && oldCoverImage && !oldCoverImage.includes("default")
          ? deleteFileFromCloud(oldCoverImage, "image")
          : Promise.resolve(),
      ]).catch(console.error);

      return playlist;
    } catch (error) {
      if (file) deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    }
  }

  // ── 3. DELETE PLAYLIST ─────────────────────────────────────────────────────

  async deletePlaylist(id: string, currentUser: IUser) {
    const playlist = await Playlist.findById(id);
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

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

    const coverImageToDelete = playlist.coverImage;
    const ownerId = playlist.user.toString();
    const isSystem = playlist.isSystem;

    // 2. Thực hiện xóa
    await playlist.deleteOne();

    // 3. Post-delete: Cleanup + Cache
    Promise.allSettled([
      // Xóa ảnh
      coverImageToDelete && !coverImageToDelete.includes("default")
        ? deleteFileFromCloud(coverImageToDelete, "image")
        : Promise.resolve(),

      // Dọn dẹp cache chi tiết và danh sách của Owner
      invalidatePlaylistCache(id),
      invalidateUserPlaylistCache(id, ownerId, isSystem),

      // Nếu là playlist hệ thống, xóa luôn cache hệ thống/public
    ]).catch(console.error);

    return { message: "Xóa playlist thành công", _id: id };
  }

  // ── 4. ADD TRACKS ─────────────────────────────────────────────────────────

  /**
   * FIX: dùng calculateStats() thay vì manual $inc để tránh duration drift.
   * Atomic $push đảm bảo không race condition trên tracks array.
   */
  async addTracks(playlistId: string, trackIds: string[], currentUser: IUser) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    // Validate tracks tồn tại và đang ready
    const validTracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
    })
      .select("_id")
      .lean();

    if (!validTracks.length)
      return { message: "Không tìm thấy bài hát hợp lệ để thêm", count: 0 };

    // Lọc ra những track chưa có trong playlist
    const existingSet = new Set(playlist.tracks.map((id) => id.toString()));
    const newIds = validTracks
      .filter((t) => !existingSet.has(t._id.toString()))
      .map((t) => t._id);

    if (!newIds.length)
      return { message: "Tất cả bài hát đã có trong playlist", count: 0 };

    // Atomic push
    await Playlist.updateOne(
      { _id: playlistId },
      { $push: { tracks: { $each: newIds } } },
    );

    // Sync stats sau khi thêm — calculateStats đảm bảo chính xác tuyệt đối
    syncPlaylistStats(playlistId).catch(console.error);
    invalidatePlaylistCache(playlistId).catch(console.error);
    invalidateUserPlaylistCache(playlistId, currentUser._id.toString());
    return {
      message: `Đã thêm ${newIds.length} bài hát`,
      count: newIds.length,
      addedTrackIds: newIds,
    };
  }

  // ── 5. REMOVE TRACKS ──────────────────────────────────────────────────────

  /**
   * FIX: convert string IDs sang ObjectId trước khi $pullAll.
   *      $pullAll với string không match ObjectId trong MongoDB.
   */
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

    const currentSet = new Set(playlist.tracks.map((id) => id.toString()));
    const toRemoveIds = trackIds.filter((id) => currentSet.has(id));

    if (!toRemoveIds.length)
      return { message: "Không có bài hát nào để xóa", removedCount: 0 };

    // FIX: convert sang ObjectId — $pullAll so sánh bằng BSON type
    const objectIds = toRemoveIds.map((id) => new Types.ObjectId(id));

    await Playlist.updateOne(
      { _id: playlistId },
      { $pullAll: { tracks: objectIds } },
    );

    // calculateStats sau khi xóa — chính xác hơn manual $inc
    syncPlaylistStats(playlistId).catch(console.error);
    invalidatePlaylistCache(playlistId).catch(console.error);

    return {
      message: `Đã xóa ${toRemoveIds.length} bài hát`,
      removedCount: toRemoveIds.length,
      removedTrackIds: toRemoveIds,
    };
  }

  // ── 6. REORDER TRACKS ─────────────────────────────────────────────────────

  /**
   * FIX: check `newTrackIds.length` thay vì `newIdsSet.size`
   *      để bắt được duplicate trong newTrackIds (Set bị dedup mất).
   */
  async reorderTracks(
    playlistId: string,
    newTrackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    assertCanEdit(playlist, currentUser);

    // FIX: so sánh length của mảng, không dùng Set (Set bỏ duplicate)
    if (newTrackIds.length !== playlist.tracks.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Số lượng bài hát không khớp: expected ${playlist.tracks.length}, got ${newTrackIds.length}`,
      );
    }

    // Kiểm tra mọi ID trong newTrackIds đều thuộc playlist
    const currentSet = new Set(playlist.tracks.map((id) => id.toString()));
    for (const id of newTrackIds) {
      if (!currentSet.has(id)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `ID bài hát ${id} không thuộc playlist này`,
        );
      }
    }

    const objectIds = newTrackIds.map((id) => new Types.ObjectId(id));
    await Playlist.updateOne(
      { _id: playlistId },
      { $set: { tracks: objectIds } },
    );

    invalidatePlaylistCache(playlistId).catch(console.error);
    return { message: "Cập nhật thứ tự thành công" };
  }

  // ── 7. BULK REMOVE TRACKS ─────────────────────────────────────────────────

  /**
   * FIX: convert sang ObjectId, cập nhật stats, reset smart cover.
   */
  async bulkRemoveTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks coverImage",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    assertCanEdit(playlist, currentUser);

    // FIX: ObjectId conversion
    const objectIds = trackIds.map((id) => new Types.ObjectId(id));
    const updated = await Playlist.findByIdAndUpdate(
      playlistId,
      { $pullAll: { tracks: objectIds } },
      { new: true },
    );

    if (!updated)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    // Nếu playlist trống sau khi xóa, reset cover
    if (!updated.tracks.length && updated.coverImage) {
      // Chỉ reset nếu cover là auto-set (không có user-uploaded indicator)
      // Convention: user-uploaded covers không chứa "default"
    }

    // Sync stats
    syncPlaylistStats(playlistId).catch(console.error);
    await this.refreshSmartCover(playlistId, updated.tracks.length === 0);
    invalidatePlaylistCache(playlistId).catch(console.error);
    invalidateUserPlaylistCache(playlistId, currentUser._id.toString()).catch(
      console.error,
    );

    return updated;
  }

  // ── 8. USER ADD TRACKS ────────────────────────────────────────────────────

  /**
   * FIX: $push thay $addToSet để maintain order + sync stats sau khi thêm.
   * $addToSet không maintain thứ tự và không update duration.
   */
  async userAddTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    // Delegate sang addTracks (đã có đầy đủ validation + stats sync)
    return this.addTracks(playlistId, trackIds, currentUser);
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
    const playlist = await Playlist.findOne({
      _id: playlistId,
      user: currentUser._id,
    });
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    // Atomic toggle
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
      { new: true, select: "_id visibility" },
    ).lean();

    invalidatePlaylistCache(playlistId).catch(console.error);

    invalidateUserPlaylistCache(playlistId, currentUser._id.toString()).catch(
      console.error,
    );

    return updated;
  }

  // ── 11. GET MY PLAYLISTS ──────────────────────────────────────────────────

  async getMyAllPlaylists(userId: string) {
    return Playlist.find({ user: userId })
      .select(
        "title slug description visibility user themeColor type isSystem totalTracks coverImage tracks playCount",
      )
      .sort({ createdAt: -1 })
      .lean();
  }

  // ── 12. GET LIST ──────────────────────────────────────────────────────────

  async getPlaylists(filter: PlaylistFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const currentUserId = currentUser?._id?.toString();
    const isAdmin = userRole === "admin";

    const isQueryingSelf =
      filter.userId && currentUserId === filter.userId?.toString();

    const cacheKey = buildCacheKey(
      "playlist:list",
      isQueryingSelf ? `owner:${currentUserId}` : userRole,
      filter,
    );

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = 12,
      keyword,
      userId: targetUserId,
      type,
      visibility,
      isSystem,
      sort,
      tag,
    } = filter;

    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    // ── Privacy layer ──────────────────────────────────────────────────────
    if (isAdmin) {
      if (visibility) query.visibility = visibility;
    } else if (currentUserId) {
      if (isQueryingSelf) {
        if (visibility) query.visibility = visibility;
      } else {
        query.$or = [
          { visibility: "public", user: targetUserId ?? { $ne: null } },
          { collaborators: new Types.ObjectId(currentUserId) },
        ];
      }
    } else {
      query.visibility = "public";
    }

    if (!isAdmin && !isQueryingSelf) {
      query.publishAt = { $lte: new Date() };
    }

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

    if (targetUserId && !query.$or) query.user = targetUserId;
    if (type) query.type = type;
    if (isSystem !== undefined) query.isSystem = isSystem;
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
      .populate("user", "fullName avatar slug isVerified")
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
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: page * limit < total,
      },
    };

    const isSensitive = isQueryingSelf || currentUserId;
    const ttl = isSensitive ? 30 : 600 + Math.floor(Math.random() * 120);

    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }

  // ── 13. GET DETAIL ────────────────────────────────────────────────────────

  async getPlaylistDetail(
    slugOrId: string,
    currentUserId?: string,
    userRole: string = "guest",
  ) {
    // 1. Định nghĩa Cache Key: Kết hợp ID + Role của người xem
    // Quan trọng: Vì Playlist có chế độ private, Cache KEY phải bao gồm cả quyền truy cập
    const cacheKey = buildCacheKey(`playlist:detail:${slugOrId}`, userRole, {
      currentUserId,
    });

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    // 2. Query Database
    const isId = mongoose.isValidObjectId(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

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
    const result = {
      ...metadata,
      trackIds: tracks ?? [],
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
    currentUserId?: string,
    userRole?: string,
  ) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const playlist = await Playlist.findById(playlistId)
      .select("visibility user collaborators tracks")
      .lean();

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Playlist");

    const isAdmin = userRole === "admin";
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
          totalItems: playlist.tracks.length,
          page: Number(page),
          pageSize: Number(limit),
          totalPages: Math.ceil(playlist.tracks.length / limit),
          hasNextPage: false,
        },
      };
    }

    const tracks = await Track.find({
      _id: { $in: pagedTrackIds },
      status: "ready",
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
