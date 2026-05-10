// services/album.service.ts

import mongoose from "mongoose";
import Album, { IAlbum } from "../models/Album";
import Track from "../models/Track";
import Artist from "../models/Artist";
import { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import escapeStringRegexp from "escape-string-regexp";
import { deleteFileFromCloud } from "../utils/cloudinary";

import { parseTags } from "../utils/helper";

import { cacheRedis } from "../config/redis";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidateAlbumCache,
  invalidateAlbumListCache,
} from "../utils/cacheHelper";
import { CounterAlbum, CounterTrack } from "../utils/counter";
import themeColorService from "./themeColor.service";
import { APP_CONFIG, TRACK_POPULATE, TRACK_SELECT } from "../config/constants";
import {
  AlbumAdminFilterInput,
  AlbumUserFilterInput,
  CreateAlbumInput,
  UpdateAlbumInput,
} from "../validations/album.validation";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function syncAlbumStats(albumId: string): Promise<void> {
  try {
    await Album.calculateStats(albumId);
  } catch (err) {
    console.error("[AlbumService] calculateStats error (non-critical):", err);
  }
}
class AlbumService {
  // 1. CREATE
  async createAlbum(
    currentUser: IUser,
    data: CreateAlbumInput,
    file?: Express.Multer.File,
  ) {
    let targetArtistId: string;
    if (currentUser.role === "admin") {
      if (!data.artist)
        throw new ApiError(httpStatus.BAD_REQUEST, "Admin phải chọn Nghệ sĩ");
      targetArtistId = data.artist;
    } else {
      if (!currentUser.artistProfile)
        throw new ApiError(httpStatus.FORBIDDEN, "Bạn chưa có hồ sơ Nghệ sĩ");
      targetArtistId = currentUser.artistProfile.toString();
    }

    const artistExists = await Artist.exists({ _id: targetArtistId });
    if (!artistExists)
      throw new ApiError(httpStatus.NOT_FOUND, "Nghệ sĩ không tồn tại");

    // 2. Chuẩn bị dữ liệu
    const tagsArray = parseTags(data.tags);
    const coverSize = file?.size ?? 0;
    let themeColor = data.themeColor || "#121212";
    const coverPath = file?.path ?? "";
    if (!data.themeColor && coverPath) {
      try {
        themeColor = await themeColorService.extractThemeColor(coverPath);
      } catch (err) {
        console.error("[AlbumService] Color extraction failed:", err);
      }
    }
    // 3. Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [album] = await Album.create(
        [
          {
            ...data,
            artist: targetArtistId,
            type: data.type ?? "album",
            tags: tagsArray,
            releaseDate: data.releaseDate
              ? new Date(data.releaseDate)
              : new Date(),
            coverImage: coverPath,
            fileSize: coverSize,
            // Đảm bảo ép kiểu boolean chuẩn xác
            isPublic: String(data.isPublic) === "true",
            totalTracks: 0,
            totalDuration: 0,
            playCount: 0,
            likeCount: 0,
          },
        ],
        { session },
      );

      // Tăng số lượng Album của Artist ngay trong transaction
      await Artist.findByIdAndUpdate(
        targetArtistId,
        { $inc: { totalAlbums: 1 } },
        { session },
      );

      await session.commitTransaction();

      // 4. Hậu kỳ SAU KHI commit thành công
      // Sử dụng Promise.allSettled để không làm chậm response của user
      Promise.allSettled([
        CounterAlbum.increment(), // Tăng tổng số album hệ thống
        // Invalidate cache thông minh
        invalidateAlbumCache(album._id.toString()), // Hàm này tự xóa list và artist:albums
        // Cập nhật dung lượng ảnh bìa
        coverSize > 0
          ? CounterTrack.increment(coverSize, "image") // Giả sử COVER_MIME là image
          : Promise.resolve(),
      ]);

      return album;
    } catch (error) {
      await session.abortTransaction();
      // Cleanup file nếu upload lên mây rồi mà DB lỗi
      if (coverPath) {
        deleteFileFromCloud(coverPath, "image").catch((err) =>
          console.error("[AlbumService] Cleanup failed:", err),
        );
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // 2. UPDATE
  async updateAlbum(
    id: string,
    currentUser: IUser,
    data: UpdateAlbumInput,
    file?: Express.Multer.File,
  ) {
    const album = await Album.findById(id);
    if (!album) throw new ApiError(httpStatus.NOT_FOUND, "Album not found");

    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();

    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền chỉnh sửa");
    }

    const oldCoverImage = album.coverImage;
    const oldCoverSize = album.fileSize ?? 0;
    const newCoverSize = file?.size ?? 0;
    let newThemeColor = data.themeColor || album.themeColor || "#121212";

    if (file && !data.themeColor) {
      try {
        newThemeColor = await themeColorService.extractThemeColor(file.path);
      } catch (err) {
        console.error("[AlbumService] Color extraction failed:", err);
      }
    }
    // ── Transaction ──────────────────────────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // A. Đổi Artist (Admin only) — FIX: bọc vào session
      if (data.artist && data.artist !== album.artist.toString()) {
        if (currentUser.role !== "admin")
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Chỉ Admin mới được đổi Artist",
          );

        const newArtistExists = await Artist.exists({ _id: data.artist });
        if (!newArtistExists)
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Artist mới không tồn tại",
          );

        await Promise.all([
          Artist.findByIdAndUpdate(
            album.artist,
            { $inc: { totalAlbums: -1 } },
            { session },
          ),
          Artist.findByIdAndUpdate(
            data.artist,
            { $inc: { totalAlbums: 1 } },
            { session },
          ),
        ]);

        album.artist = new mongoose.Types.ObjectId(data.artist);
      }

      // B. Metadata
      if (data.title && data.title !== album.title) {
        album.title = data.title;
      }

      if (data.description !== undefined) album.description = data.description;
      if (data.type) album.type = data.type;

      if (data.releaseDate) {
        album.releaseDate = new Date(data.releaseDate);
      }

      if (data.tags) album.tags = parseTags(data.tags);

      if (data.isPublic !== undefined) {
        album.isPublic = String(data.isPublic) === "true";
      }

      // D. Cover image update
      if (file) {
        album.coverImage = file.path;
        album.fileSize = newCoverSize;
        if (newThemeColor) album.themeColor = newThemeColor;
      } else {
        album.themeColor = newThemeColor;
      }

      await album.save({ session });
      await session.commitTransaction();

      // 3. Hậu kỳ (Async)
      const postCommitTasks: Promise<any>[] = [
        invalidateAlbumCache(id),
        syncAlbumStats(id), // Đảm bảo số liệu luôn khớp
      ];

      // Dọn dẹp ảnh cũ
      if (file && oldCoverImage && !oldCoverImage.includes("default")) {
        postCommitTasks.push(deleteFileFromCloud(oldCoverImage, "image"));
      }

      // Cập nhật Counter Storage
      if (file && newCoverSize > 0) {
        const pipeline = cacheRedis.pipeline();
        if (oldCoverSize > 0)
          pipeline.decrby("stats:storage:image_bytes", oldCoverSize);
        pipeline.incrby("stats:storage:image_bytes", newCoverSize);
        postCommitTasks.push(pipeline.exec());
      }

      Promise.allSettled(postCommitTasks).catch(console.error);
      return album;
    } catch (error) {
      await session.abortTransaction();
      if (file?.path)
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  // ── 3. GET LIST BY USER ───────────────────────────────────────────────────────────

  async getAlbumsByUser(filter: AlbumUserFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ? "user" : "guest";

    const cleanFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("album:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      artistId,
      year,
      type,
      sort,
    } = filter;

    const skip = (page - 1) * limit;
    const query: Record<string, any> = { isDeleted: false, isPublic: true };

    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      const safeKeyword = escapeStringRegexp(keyword.substring(0, 100));
      if (!sort) {
        // $text search: tận dụng text index, sort theo relevance
        query.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        // Prefix regex + compound index (sort được ưu tiên)
        query.title = { $regex: `^${safeKeyword}`, $options: "i" };
      }
    }

    // ── Filters ──────────────────────────────────────────────────────────────
    if (artistId) query.artist = artistId;
    if (year) query.releaseYear = year;
    if (type) query.type = type;

    // ── Sort fallback ────────────────────────────────────────────────────────
    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, _id: 1 },
        newest: { releaseDate: -1, _id: 1 },
        oldest: { releaseDate: 1, _id: 1 },
        name: { title: 1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    // ── Query ────────────────────────────────────────────────────────────────
    let baseQuery = Album.find(query)
      .populate("artist", "name slug")
      .select("title coverImage artist releaseYear type playCount slug")
      .sort(sortOption!)
      .skip(skip)
      .limit(limit)
      .lean<IAlbum & { score?: number }>();

    // Thêm score vào projection khi dùng text search
    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }

    const [albums, total] = await Promise.all([
      baseQuery.lean(),
      Album.countDocuments(query),
    ]);

    const result = {
      data: albums,
      meta: {
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: Number(page) * Number(limit) < Number(total),
      },
    };

    // Cache với jitter để tránh thundering herd
    const ttl = 600 + Math.floor(Math.random() * 120);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch((err) => console.error("[Cache] SET error:", err));

    return result;
  }
  // ── 4. GET LIST BY ADMIN ───────────────────────────────────────────────────────────

  async getAlbumsByAdmin(filter: AlbumAdminFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";
    // ── Authorization ────────────────────────────────────────────────────────
    if (!isAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Admin mới được truy cập");
    }
    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      artistId,
      year,
      type,
      sort,
      isPublic,
      isDeleted,
    } = filter;

    const skip = (Number(page) - 1) * Number(limit);
    const query: Record<string, any> = {};

    // ── Search strategy ──────────────────────────────────────────────────────
    // Khi có keyword VÀ không có explicit sort → dùng $text (full Atlas scoring)
    // Khi có sort → dùng prefix $regex để compound index hoạt động đúng
    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      const safeKeyword = escapeStringRegexp(keyword.substring(0, 100));

      if (!sort) {
        // $text search: tận dụng text index, sort theo relevance
        query.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        // Prefix regex + compound index (sort được ưu tiên)
        query.title = { $regex: `^${safeKeyword}`, $options: "i" };
      }
    }

    // ── Filters ──────────────────────────────────────────────────────────────
    if (artistId) query.artist = artistId;
    if (year) query.releaseYear = year;
    if (isPublic !== undefined) query.isPublic = isPublic;
    if (isDeleted !== undefined) query.isDeleted = isDeleted;
    if (type) query.type = type;

    // ── Sort fallback ────────────────────────────────────────────────────────
    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, _id: 1 },
        newest: { releaseDate: -1, _id: 1 },
        oldest: { releaseDate: 1, _id: 1 },
        name: { title: 1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    // ── Query ────────────────────────────────────────────────────────────────
    let baseQuery = Album.find(query)
      .populate("artist", "name slug")
      .sort(sortOption!)
      .skip(skip)
      .limit(limit)
      .lean<IAlbum & { score?: number }>();

    // Thêm score vào projection khi dùng text search
    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }

    const [albums, total] = await Promise.all([
      baseQuery.lean(),
      Album.countDocuments(query),
    ]);

    const result = {
      data: albums,
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

  // ── 5. DELETE ─────────────────────────────────────────────────────────────

  async deleteAlbum(id: string, currentUser: IUser) {
    const album = await Album.findById(id);
    if (!album || album.isDeleted) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Album không tồn tại hoặc đã bị xóa",
      );
    }

    // 1. Kiểm tra quyền sở hữu
    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();
    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền xóa");
    }

    const artistId = album.artist;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Thực hiện xóa mềm
      await Album.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          isPublic: false, // Ẩn khỏi mọi nơi ngay lập tức
          deletedAt: new Date(), // Nên thêm trường này để theo dõi
        },
        { session },
      );

      // 3. Xử lý các dữ liệu liên quan
      await Promise.all([
        // Cách A: Gỡ album khỏi các bài hát (như bạn đang làm)
        // Track.updateMany({ album: id }, { $unset: { album: "" } }, { session }),

        // Cách B (Khuyên dùng nếu muốn khôi phục sau này):
        // Chỉ đánh dấu các Track đó thuộc về một album đã bị xóa mềm.

        // Giảm counter của Artist (Vì album không còn hiển thị nữa)
        Artist.findByIdAndUpdate(
          artistId,
          { $inc: { totalAlbums: -1 } },
          { session },
        ),
      ]);

      await session.commitTransaction();

      // 4. Hậu kỳ (Async)
      Promise.allSettled([
        CounterAlbum.decrement(),
        invalidateAlbumCache(id),
        // LƯU Ý: Với xóa mềm, KHÔNG xóa ảnh trên Cloudinary
        // để có thể khôi phục lại Album nguyên vẹn khi cần.
      ]).catch(console.error);

      return { message: "Xóa đĩa nhạc thành công (Soft Delete)" };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 9. RESTORE ALBUM (UNDO SOFT DELETE) ────────────────────────────────
  async restoreAlbum(id: string, currentUser: IUser) {
    const album = await Album.findById(id);
    if (!album || !album.isDeleted) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Album không tồn tại hoặc không ở trạng thái đã xóa",
      );
    }

    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, "Bạn không có quyền khôi phục");
    }

    const artistId = album.artist.toString();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Album.findByIdAndUpdate(
        id,
        { isDeleted: false, deletedAt: null },
        { session },
      );

      // Tăng counter cho Artist
      await Artist.findByIdAndUpdate(
        artistId,
        { $inc: { totalAlbums: 1 } },
        { session },
      );

      await session.commitTransaction();

      // Hậu kỳ: invalidate caches và counters
      Promise.allSettled([
        CounterAlbum.increment(),
        invalidateAlbumCache(id),
        invalidateAlbumListCache(),
      ]).catch(console.error);

      return { message: "Khôi phục album thành công", _id: id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 6. GET DETAIL ─────────────────────────────────────────────────────────

  private async checkAlbumAccess(
    album: any,
    currentUser?: IUser, // Truyền cả object user từ request vào
  ) {
    if (album.isPublic) return;

    const userRole = currentUser?.role || "guest";
    const currentUserId = currentUser?._id?.toString();
    const userArtistProfile = currentUser?.artistProfile?.toString();

    const albumArtistId =
      album.artist?._id?.toString() ?? album.artist?.toString();

    // Kiểm tra quyền: Admin hoặc là chủ sở hữu Album
    const isOwner =
      currentUserId &&
      (userRole === "admin" || userArtistProfile === albumArtistId);

    if (!isOwner) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Đĩa nhạc này đang ở chế độ riêng tư",
      );
    }
  }

  async getAlbumDetail(
    slug: string,
    currentUser?: IUser, // Nhận currentUser từ Controller
  ) {
    const userRole = currentUser?.role || "guest";

    // KHÔNG lọc isPublic ở đây để Admin/Owner vẫn tìm thấy bản ghi
    const query = { slug, isDeleted: false };

    const cacheKey = buildCacheKey(`album:detail:${slug}`, userRole, {});

    // 1. Check Cache
    const cachedData = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cachedData) {
      const parsed = JSON.parse(cachedData as string);
      // Nếu cache là private, check quyền ngay
      if (!parsed.isPublic) {
        await this.checkAlbumAccess(parsed, currentUser);
      }
      return parsed;
    }

    // 2. Database Query
    const album = await Album.findOne(query)
      .populate("artist", "name avatar slug")
      .lean();

    if (!album)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy đĩa nhạc");

    // 3. Kiểm tra bảo mật (Dành cho cả trường hợp isPublic = false)
    await this.checkAlbumAccess(album, currentUser);

    // 4. Lấy Track IDs
    const tracks = await Track.find({
      album: album._id,
      status: "ready",
      isPublic: true,
      isDeleted: false,
    })
      .sort({ playCount: -1, createdAt: -1 })
      .limit(APP_CONFIG.TRACKS_LIMIT) // Ngưỡng an toàn để tránh Payload quá lớn
      .select("_id")
      .lean();
    const result = {
      ...album,
      trackIds: tracks.map((t) => t._id),
    };

    // 5. Lưu Cache (Chỉ lưu nếu hợp lệ)
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    ).catch(console.error);

    return result;
  }

  // ── 7. GET ALBUM TRACKS ───────────────────────────────────────────────────

  async getAlbumTracks(
    albumId: string,
    filter: AlbumUserFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const userId = currentUser?._id?.toString();
    const isAdmin = userRole === "admin";

    const album = await Album.findById(albumId)
      .populate("artist", "name avatar slug")
      .lean();

    if (!album)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy đĩa nhạc");

    if (!album.isPublic && !isAdmin) {
      const isOwner = userId && album.artist?.toString() === userId;
      if (!isOwner) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền xem danh sách này",
        );
      }
    }
    if (!album.isDeleted && !isAdmin) {
      const isOwner = userId && album.artist?.toString() === userId;
      if (!isOwner && !album.isPublic) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền xem danh sách này",
        );
      }
    }

    const { page = 1, limit = APP_CONFIG.VIRTUAL_SCROLL_LIMIT } = filter;
    const cacheKey = buildCacheKey(`album:tracks:${albumId}`, userRole, {
      page,
      limit,
    });

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const skip = (Number(page) - 1) * Number(limit);

    const trackQuery: Record<string, any> = {
      album: albumId,
      status: "ready",
      isPublic: true,
      isDeleted: false,
    };
    if (!isAdmin) trackQuery.isPublic = true;

    const [tracks, total] = await Promise.all([
      Track.find(trackQuery)
        .sort({ playCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(TRACK_SELECT)
        .populate(TRACK_POPULATE as any)
        .lean(),
      Track.countDocuments(trackQuery),
    ]);

    const result = {
      data: tracks,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: page * limit < total,
      },
    };

    const ttl = 1800 + Math.floor(Math.random() * 300);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch((err) => console.error("[Cache] Set Album Tracks Error:", err));

    return result;
  }
  // ── 8. TOGGLE ALBUM PUBLICITY ─────────────────────────────────────────
  async toggleAlbumPublicity(id: string, currentUser: IUser) {
    const album = await Album.findById(id);
    if (!album || album.isDeleted) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Album không tồn tại hoặc đã bị xóa",
      );
    }

    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();
    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền thực hiện");
    }

    album.isPublic = !album.isPublic;
    await album.save(); // Lưu lại để trigger middleware nếu có

    // Invalidate cache liên quan
    Promise.allSettled([
      invalidateAlbumCache(id),
      invalidateAlbumListCache(), // Xóa cache list để cập nhật trạng thái công khai
    ]).catch(console.error);

    return {
      id: album._id,
      isPublic: album.isPublic,
    };
  }
}

export default new AlbumService();
