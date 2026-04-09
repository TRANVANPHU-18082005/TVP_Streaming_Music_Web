import mongoose, { Types } from "mongoose";
import httpStatus from "http-status";
import Playlist from "../models/Playlist";
import Track from "../models/Track";
import { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { generatePlaylistSlug, generateSafeSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseTags } from "../utils/helper";
import {
  CreatePlaylistInput,
  UpdatePlaylistInput,
  PlaylistFilterInput,
} from "../validations/playlist.validation";
import escapeStringRegexp from "escape-string-regexp";
import { buildCacheKey, withCacheTimeout } from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";

class PlaylistService {
  // ==========================================
  // 🔴 WRITE METHODS (CREATE, UPDATE, DELETE)
  // ==========================================

  /**
   * 1. CREATE PLAYLIST
   */
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

    // Tách riêng hàm parse mảng ID (Dùng parseTags chung cho mảng ID/chuỗi)
    const collaboratorIds = data.collaborators
      ? parseTags(data.collaborators).map((id) => new Types.ObjectId(id))
      : [];
    const tags = data.tags ? parseTags(data.tags) : [];
    const slug = await generateSafeSlug(Playlist, data.title);
    const publishAt = data.publishAt ? new Date(data.publishAt) : new Date();

    // 🔥 CHỐNG MASS ASSIGNMENT: Chỉ lấy đúng các field an toàn
    const safeData = {
      title: data.title,
      description: data.description,
      type: data.type,
      visibility: data.visibility,
      themeColor: data.themeColor,
    };

    try {
      const newPlaylist = await Playlist.create({
        ...safeData,
        slug,
        user: currentUser._id,
        isSystem: isSystemRequest,
        coverImage: file ? file.path : "",
        publishAt,
        tags,
        collaborators: collaboratorIds,

        // Khởi tạo các mảng/bộ đếm mặc định (ngăn user tự ý truyền data ảo)
        tracks: [],
        totalTracks: 0,
        totalDuration: 0,
        followersCount: 0,
        playCount: 0,
      });

      return newPlaylist;
    } catch (error) {
      // 🔥 XÓA RÁC CLOUDINARY NẾU LƯU DB LỖI
      if (file) {
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      }
      throw error;
    }
  }

  /**
   * 2. UPDATE PLAYLIST
   */
  async updatePlaylist(
    id: string,
    currentUser: IUser,
    data: UpdatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");
    }

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";
    const isCollaborator = playlist.collaborators.some(
      (collabId) => collabId.toString() === currentUser._id.toString(),
    );

    if (!isOwner && !isAdmin && !isCollaborator) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền sửa thông tin Playlist này",
      );
    }

    const oldCoverImage = playlist.coverImage;
    let isImageUpdated = false;

    // Cập nhật dữ liệu
    if (data.title && data.title !== playlist.title) {
      playlist.title = data.title;
      // Tự động cập nhật Slug nếu đổi tên
      playlist.slug = await generateSafeSlug(Playlist, data.title);
    }

    if (data.description !== undefined) playlist.description = data.description;
    if (data.type) playlist.type = data.type;
    if (data.visibility) playlist.visibility = data.visibility;
    if (data.themeColor) playlist.themeColor = data.themeColor;
    if (data.tags) playlist.tags = parseTags(data.tags);
    if (data.collaborators)
      playlist.collaborators = parseTags(data.collaborators).map(
        (id) => new Types.ObjectId(id),
      );
    if (data.publishAt) playlist.publishAt = new Date(data.publishAt);
    if (isAdmin && data.isSystem !== undefined)
      playlist.isSystem = String(data.isSystem) === "true";

    if (file) {
      playlist.coverImage = file.path;
      isImageUpdated = true;
    }

    try {
      await playlist.save();

      // 🔥 CHỈ XÓA ẢNH CŨ KHI ĐÃ SAVE DB THÀNH CÔNG 100%
      if (
        isImageUpdated &&
        oldCoverImage &&
        !oldCoverImage.includes("default")
      ) {
        deleteFileFromCloud(oldCoverImage, "image").catch(console.error);
      }

      return playlist;
    } catch (error) {
      // 🔥 NẾU SAVE DB LỖI, XÓA NGAY ẢNH MỚI VỪA UP LÊN TRONG REQUEST NÀY
      if (file) {
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      }
      throw error;
    }
  }

  /**
   * 3. DELETE PLAYLIST
   */
  async deletePlaylist(id: string, currentUser: IUser) {
    const playlist = await Playlist.findById(id);
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xóa Playlist này",
      );
    }
    if (playlist.isSystem && !isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Chỉ Admin mới được xóa Playlist hệ thống",
      );
    }

    const coverImageToDelete = playlist.coverImage;

    // 🔥 Xóa DB trước, nếu DB xóa thành công thì mới xóa file Cloudinary
    await playlist.deleteOne();

    if (coverImageToDelete && !coverImageToDelete.includes("default")) {
      deleteFileFromCloud(coverImageToDelete, "image").catch((err) =>
        console.error("⚠️ Failed to delete playlist cover:", err),
      );
    }

    return { message: "Xóa playlist thành công", _id: id };
  }

  // ==========================================
  // 🟡 TRACK MANAGEMENT (ATOMIC UPDATES)
  // ==========================================

  /**
   * 4. ADD TRACKS
   */
  async addTracks(playlistId: string, trackIds: string[], currentUser: IUser) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );
    const canEdit =
      isOwner ||
      isCollaborator ||
      (playlist.isSystem && currentUser.role === "admin");

    if (!canEdit)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền thêm bài vào Playlist này",
      );

    const validTracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
    })
      .select("duration")
      .lean();

    if (validTracks.length === 0)
      return { message: "Không tìm thấy bài hát hợp lệ để thêm", count: 0 };

    const existingIds = new Set(playlist.tracks.map((id) => id.toString()));
    const newTracks = validTracks.filter(
      (t) => !existingIds.has(t._id.toString()),
    );

    if (newTracks.length === 0)
      return { message: "Tất cả bài hát đã có trong playlist", count: 0 };

    const addedDuration = newTracks.reduce(
      (sum, t) => sum + (t.duration || 0),
      0,
    );
    const newTrackIds = newTracks.map((t) => t._id);

    // 🔥 Dùng Atomic Update để chống Race Condition
    await Playlist.updateOne(
      { _id: playlistId },
      {
        $push: { tracks: { $each: newTrackIds } },
        $inc: { totalTracks: newTracks.length, totalDuration: addedDuration },
      },
    );

    return {
      message: `Đã thêm ${newTracks.length} bài hát`,
      count: newTracks.length,
      addedTrackIds: newTrackIds,
    };
  }

  /**
   * 5. REMOVE TRACKS
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

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );
    const canEdit =
      isOwner ||
      isCollaborator ||
      (playlist.isSystem && currentUser.role === "admin");

    if (!canEdit)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xóa bài khỏi Playlist này",
      );

    const currentTrackIdsSet = new Set(
      playlist.tracks.map((id) => id.toString()),
    );
    const validTrackIdsToRemove = trackIds.filter((id) =>
      currentTrackIdsSet.has(id),
    );

    if (validTrackIdsToRemove.length === 0)
      return { message: "Không có bài hát nào để xóa", removedCount: 0 };

    const tracksToRemoveData = await Track.find({
      _id: { $in: validTrackIdsToRemove },
    })
      .select("duration")
      .lean();
    const removedDuration = tracksToRemoveData.reduce(
      (sum, t) => sum + (t.duration || 0),
      0,
    );

    // 🔥 Atomic Pull và Decrement
    await Playlist.updateOne(
      { _id: playlistId },
      {
        $pullAll: { tracks: validTrackIdsToRemove },
        $inc: {
          totalTracks: -validTrackIdsToRemove.length,
          totalDuration: -removedDuration,
        },
      },
    );

    return {
      message: `Đã xóa ${validTrackIdsToRemove.length} bài hát`,
      removedCount: validTrackIdsToRemove.length,
      removedTrackIds: validTrackIdsToRemove,
    };
  }

  /**
   * 6. REORDER TRACKS
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

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );

    if (!isOwner && !isAdmin && !isCollaborator) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Không có quyền sắp xếp playlist này",
      );
    }

    // 🔥 Khóa chặt mảng, chỉ cho phép đảo vị trí, không cho thêm bớt
    const currentIdsSet = new Set(playlist.tracks.map((id) => id.toString()));
    const newIdsSet = new Set(newTrackIds);

    if (currentIdsSet.size !== newIdsSet.size) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Độ dài mảng bài hát không khớp dữ liệu gốc.",
      );
    }

    for (const id of newTrackIds) {
      if (!currentIdsSet.has(id)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `ID bài hát ${id} không thuộc playlist này.`,
        );
      }
    }

    const mappedObjectIds = newTrackIds.map((id) => new Types.ObjectId(id));
    await Playlist.updateOne(
      { _id: playlistId },
      { $set: { tracks: mappedObjectIds } },
    );

    return { message: "Cập nhật thứ tự thành công" };
  }

  // ==========================================
  // 🟢 READ METHODS (GET LIST & DETAIL)
  // ==========================================

  /**
   * 7. GET LIST PLAYLISTS
   */
  async getPlaylists(filter: PlaylistFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const currentUserId = currentUser?._id?.toString();
    const isAdmin = userRole === "admin";

    // 1. STABLE CACHE KEY - Phân đoạn theo quyền truy cập
    // Nếu query theo userId cụ thể, cache key phải gắn với người đang xem
    // vì kết quả trả về có thể chứa playlist Private/Shared của họ.
    const isQueryingSelf =
      filter.userId && currentUserId === filter.userId.toString();
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
      tag, // Thêm lọc theo 1 tag cụ thể
    } = filter;

    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    // --- 2. SECURITY & PRIVACY LAYER (Phức tạp & Thực tế) ---

    if (isAdmin) {
      // Admin: Full access, lọc theo bất kỳ trạng thái nào
      if (visibility) query.visibility = visibility;
    } else if (currentUserId) {
      // User đã đăng nhập:
      if (isQueryingSelf) {
        // Xem danh sách của chính mình: Thấy hết (Public, Private, Unlisted)
        if (visibility) query.visibility = visibility;
      } else {
        // Xem danh sách của người khác:
        // Chỉ lấy Public HOẶC những playlist mà mình là Collaborator (Đồng sở hữu)
        query.$or = [
          { visibility: "public", user: targetUserId || { $ne: null } },
          { collaborators: currentUserId }, // 🔥 TÍNH NĂNG COLLAB: Thấy playlist bạn bè cho phép sửa
        ];
        // Nếu filter yêu cầu cụ thể Unlisted (phải có link mới thấy), thường không hiện ở List
        // ngoại trừ trường hợp đặc biệt. Ở đây ta mặc định ẩn Unlisted khỏi Discovery.
      }
    } else {
      // Khách (Guest): Chỉ thấy Public
      query.visibility = "public";
    }

    // Luôn lọc theo ngày phát hành để hỗ trợ tính năng Schedule
    if (!isAdmin && !isQueryingSelf) {
      query.publishAt = { $lte: new Date() };
    }

    // --- 3. FILTERING LOGIC ---
    if (keyword) {
      const safeKeyword = escapeStringRegexp(keyword.substring(0, 100));
      // Sử dụng Text Index đã định nghĩa trong Schema ({ title: "text", tags: "text" })
      // Nếu có keyword, MongoDB sẽ dùng trọng số (Score) để trả về kết quả liên quan nhất
      query.$text = { $search: safeKeyword };
    }

    if (targetUserId && !query.$or) query.user = targetUserId;
    if (type) query.type = type;
    if (isSystem !== undefined) query.isSystem = isSystem;
    if (tag) query.tags = tag; // Lọc theo mảng tags

    // --- 4. ADVANCED SORTING ---
    const SORT_MAP: Record<string, any> = {
      popular: { playCount: -1, followersCount: -1 },
      followers: { followersCount: -1 },
      trending: { playCount: -1, createdAt: -1 }, // Mới và nhiều lượt nghe
      newest: { createdAt: -1 },
      name: { title: 1 },
      duration: { totalDuration: -1 }, // Playlist dài nhất
    };

    // Nếu dùng Text Search, mặc định sort theo độ liên quan (textScore)
    let sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    const projection = keyword ? { score: { $meta: "textScore" } } : {};
    if (keyword && !sort) sortOption = { score: { $meta: "textScore" } };

    // --- 5. EXECUTION ---
    const [playlists, total] = await Promise.all([
      Playlist.find(query, projection)
        .populate("user", "fullName avatar slug isVerified")
        .populate("collaborators", "fullName avatar slug") // Lấy thông tin bạn bè cùng edit
        .select("-tracks") // TUYỆT ĐỐI KHÔNG lấy mảng tracks ở bản list
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
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

    // --- 6. INTELLIGENT CACHING ---
    // Không cache quá lâu cho Owner/Collab để họ thấy thay đổi nhanh
    const isSensitive =
      isQueryingSelf ||
      (currentUserId &&
        playlists.some((p) =>
          p.collaborators?.some((c) => c.toString() === currentUserId),
        ));
    const ttl = isSensitive ? 30 : 600 + Math.floor(Math.random() * 120);

    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Playlist List SET error:", err));

    return result;
  }
  /**
   * 8. GET PLAYLIST DETAIL
   */
  async getPlaylistDetail(
    slugOrId: string,
    currentUserId?: string,
    userRole?: string,
  ) {
    const isId = mongoose.isValidObjectId(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    // 1. Lấy toàn bộ Playlist.
    // Lưu ý: Ta KHÔNG .populate("tracks") vì ta chỉ cần mảng ID để làm Virtual Scroll
    const playlist = await Playlist.findOne(query)
      .populate("user", "fullName avatar slug isVerified")
      .populate("collaborators", "fullName avatar slug")
      .lean();

    if (!playlist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");
    }

    // 2. Kiểm tra quyền truy cập (Giữ nguyên logic bảo mật của Phú)
    const isAdmin = userRole === "admin";
    const isOwner =
      currentUserId && playlist.user._id.toString() === currentUserId;
    const isCollaborator =
      currentUserId &&
      playlist.collaborators.some(
        (c: any) => c._id.toString() === currentUserId,
      );

    const hasAccess = isAdmin || isOwner || isCollaborator;

    if (!hasAccess) {
      if (playlist.visibility === "private") {
        throw new ApiError(httpStatus.FORBIDDEN, "Đây là Playlist riêng tư");
      }
      if (new Date(playlist.publishAt) > new Date()) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          "Playlist chưa được công khai",
        );
      }
    }

    // 3. XỬ LÝ TRẢ VỀ
    // Vì trong Schema 'tracks' là mảng ID, nên playlist.tracks chính là trackIds
    const trackIds = playlist.tracks || [];

    // Để an toàn và sạch data, ta có thể xóa field tracks gốc hoặc rename nó
    const { tracks, ...metadata } = playlist;

    return {
      ...metadata,
      trackIds, // Mảng ID "nhẹ hều" để FE làm Skeleton
    };
  }
  /**
   * 9. GET PLAYLIST TRACKS (Infinite Loading)
   * Tải chi tiết bài hát theo từng trang (Page/Limit)
   */
  async getPlaylistTracks(
    playlistId: string,
    filter: any, // { page, limit }
    currentUserId?: string,
    userRole?: string,
  ) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    // 1. Check quyền truy cập nhanh (chỉ lấy field cần thiết)
    const playlist = await Playlist.findById(playlistId)
      .select("visibility user collaborators tracks")
      .lean();

    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Playlist");

    const isAdmin = userRole === "admin";
    const isOwner = currentUserId && playlist.user.toString() === currentUserId;
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

    // 2. Xử lý CACHE (Playlist hay thay đổi hơn Album nên TTL thấp hơn tí)
    const cacheKey = buildCacheKey(
      `playlist:tracks:${playlistId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 3. Lấy sub-set ID bài hát theo phân trang từ mảng playlist.tracks
    // Vì Playlist lưu thứ tự bài hát trong mảng, nên ta cắt mảng ID trước
    const pagedTrackIds = playlist.tracks.slice(skip, skip + limit);

    // 4. Query chi tiết các bài hát trong trang hiện tại
    const tracks = await Track.find({
      _id: { $in: pagedTrackIds },
      status: "ready",
    })
      .populate("artist", "name slug")
      .populate("album", "title slug coverImage")
      .select(
        "title slug duration playCount coverImage isPublic isExplicit hlsUrl",
      )
      .lean();

    // Sắp xếp lại kết quả trả về đúng thứ tự trong mảng ID (vì $in không bảo toàn thứ tự)
    const sortedTracks = pagedTrackIds
      .map((id) => tracks.find((t) => t._id.toString() === id.toString()))
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

    // 5. Lưu Cache 5-10 phút
    const ttl = 600 + Math.floor(Math.random() * 60);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Set Album Tracks Error:", err));
    return result;
  }
  /**
   * 🚀 1. CREATE QUICK PLAYLIST (Luồng Spotify)
   * User nhấn "Tạo mới" -> Backend tạo "Danh sách phát của tôi #N" -> Trả về kết quả ngay.
   */
  async createQuickPlaylist(
    currentUser: IUser,
    payload?: { title?: string; visibility?: string },
  ) {
    // 1. Xử lý Title: Ưu tiên payload, nếu rỗng thì đếm số để đặt tên tự động
    let finalTitle = payload?.title?.trim();

    if (!finalTitle) {
      const userPlaylistCount = await Playlist.countDocuments({
        user: currentUser._id,
        isSystem: false,
      });
      finalTitle = `Danh sách phát của tôi #${userPlaylistCount + 1}`;
    }

    // 2. Xử lý Visibility: Ưu tiên payload, nếu rỗng mặc định 'public'
    const finalVisibility = payload?.visibility || "public";

    // 3. Generate Unique Slug (Luôn duy nhất nhờ NanoID bên trong hàm)
    const uniqueSlug = generatePlaylistSlug(finalTitle);

    // 4. Tạo bản ghi
    const newPlaylist = await Playlist.create({
      title: finalTitle,
      slug: uniqueSlug,
      user: currentUser._id,
      description: "",
      coverImage: "",
      themeColor: this.generateRandomVibrantColor(), // Thêm chút màu sắc ngẫu nhiên cho đẹp
      visibility: finalVisibility,
      isSystem: false,
      tracks: [],
      totalTracks: 0,
      totalDuration: 0,
    });

    return newPlaylist;
  }

  /**
   * Helper để mỗi playlist tạo nhanh có một màu nền UI riêng biệt (Vibe Spotify)
   */
  private generateRandomVibrantColor() {
    const vibrantColors = [
      "#1db954",
      "#2196f3",
      "#ff5722",
      "#9c27b0",
      "#e91e63",
      "#ffc107",
    ];
    return vibrantColors[Math.floor(Math.random() * vibrantColors.length)];
  }

  /**
   * 🔄 2. UPDATE SMART COVER (Ảnh bìa thông minh)
   * Tự động lấy ảnh của bài hát đầu tiên làm ảnh đại diện cho playlist nếu user chưa upload ảnh riêng.
   */
  async refreshSmartCover(playlistId: string) {
    const playlist = await Playlist.findById(playlistId).populate({
      path: "tracks",
      select: "coverImage",
      options: { limit: 1 },
    });

    if (!playlist) return;

    // Chỉ tự động cập nhật nếu user chưa tự upload ảnh (coverImage rỗng)
    if (!playlist.coverImage || playlist.coverImage === "") {
      const firstTrack = playlist.tracks[0] as any;
      if (firstTrack?.coverImage) {
        await Playlist.updateOne(
          { _id: playlistId },
          { coverImage: firstTrack.coverImage },
        );
      }
    }
  }

  /**
   * ➕ 3. USER ADD TRACKS (Bọc lại hàm addTracks gốc)
   * Thêm nhạc và tự động cập nhật ảnh bìa thông minh.
   */
  async userAddTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    // Gọi logic addTracks có sẵn từ PlaylistService (hoặc viết trực tiếp nếu cần phân quyền user)
    // Giả sử dùng logic Atomic Update của Phú
    const result = await Playlist.findOneAndUpdate(
      { _id: playlistId, user: currentUser._id }, // Bảo mật: Chỉ chủ sở hữu mới được thêm
      { $addToSet: { tracks: { $each: trackIds } } },
      { new: true },
    );

    if (!result)
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Playlist không tồn tại hoặc bạn không có quyền",
      );

    // Kích hoạt logic ảnh bìa thông minh
    await this.refreshSmartCover(playlistId);

    return result;
  }

  /**
   * 🗑️ 4. BULK REMOVE TRACKS
   * Xóa nhiều bài hát khỏi playlist cùng lúc cho người dùng tiện lợi.
   */
  async bulkRemoveTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    const result = await Playlist.findOneAndUpdate(
      { _id: playlistId, user: currentUser._id },
      { $pullAll: { tracks: trackIds } },
      { new: true },
    );

    if (!result)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    // Sau khi xóa, nếu playlist trống thì có thể reset ảnh bìa
    if (result.tracks.length === 0) {
      result.coverImage = "";
      await result.save();
    } else {
      await this.refreshSmartCover(playlistId);
    }

    return result;
  }

  /**
   * 🔒 5. TOGGLE PRIVACY
   * Chuyển nhanh chế độ Riêng tư/Công khai
   */
  async toggleVisibility(playlistId: string, currentUser: IUser) {
    const playlist = await Playlist.findOne({
      _id: playlistId,
      user: currentUser._id,
    });
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy playlist");

    playlist.visibility =
      playlist.visibility === "public" ? "private" : "public";
    await playlist.save();

    return playlist;
  }
  /**
   * 8. GET ALL MY PLAYLISTS (For Sidebar/Profile)
   * Lấy toàn bộ playlist mà user sở hữu, không phân trang, bao gồm cả Private
   */
  async getMyAllPlaylists(userId: string) {
    return await Playlist.find({
      user: userId,
    })
      .select(
        "title slug description visibility user themeColor type isSystem totalTracks coverImage",
      ) // Chỉ lấy field cần thiết cho Sidebar
      .sort({ createdAt: -1 })
      .lean();
  }
}

export default new PlaylistService();
