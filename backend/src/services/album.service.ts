// services/album.service.ts

import mongoose from "mongoose";
import Album, { IAlbum } from "../models/Album";
import Track from "../models/Track";
import Artist from "../models/Artist";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import escapeStringRegexp from "escape-string-regexp";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  AlbumFilterInput,
  CreateAlbumInput,
  UpdateAlbumInput,
} from "../validations/album.validation";
import { parseGenreIds, parseTags } from "../utils/helper";
import Genre from "../models/Genre";
import { cacheRedis } from "../config/redis";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidateAlbumCache,
  invalidateAlbumListCache,
} from "../utils/cacheHelper";
import { CounterAlbum, CounterTrack } from "../utils/counter";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Mime type cho ảnh bìa album upload qua Cloudinary */
const COVER_MIME = "image/jpeg";
async function syncAlbumStats(albumId: string): Promise<void> {
  try {
    await Album.calculateStats(albumId);
  } catch (err) {
    console.error("[AlbumService] calculateStats error (non-critical):", err);
  }
}
class AlbumService {
  // ── 1. CREATE ─────────────────────────────────────────────────────────────

  async createAlbum(
    currentUser: IUser,
    data: CreateAlbumInput,
    file?: Express.Multer.File,
  ) {
    // 1. Phân quyền & Xác định Artist (Oce)
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
    const coverPath = file?.path ?? "";
    const coverSize = file?.size ?? 0;

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

  // ── 2. UPDATE ─────────────────────────────────────────────────────────────

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

      // FIX 3: Bỏ releaseYear thủ công — pre-save middleware tự set
      if (data.releaseDate) {
        album.releaseDate = new Date(data.releaseDate);
        // releaseYear sẽ được pre-save tính lại tự động
      }

      // C. Genres (diff-based, giữ trong session)

      if (data.tags) album.tags = parseTags(data.tags);

      if (data.isPublic !== undefined) {
        album.isPublic = String(data.isPublic) === "true";
      }

      // D. Cover image update
      if (file) {
        album.coverImage = file.path;
        album.fileSize = newCoverSize;
      } else {
        if (data.themeColor) album.themeColor = data.themeColor;
      }

      await album.save({ session });
      await session.commitTransaction();

      // ── FIX 4: Sau commit — cleanup + cache invalidate ────────────────────
      const postCommitTasks: Promise<any>[] = [invalidateAlbumCache(id)];

      // Xóa ảnh cũ khỏi Cloudinary nếu đổi cover
      if (file && oldCoverImage && !oldCoverImage.includes("default")) {
        postCommitTasks.push(
          deleteFileFromCloud(oldCoverImage, "image").catch((err) =>
            console.error("[AlbumService] Old cover cleanup failed:", err),
          ),
        );
      }

      // FIX 1: Điều chỉnh imageBytes counter nếu đổi cover
      if (file && newCoverSize > 0) {
        if (oldCoverSize > 0) {
          // Trừ cái cũ, cộng cái mới
          const pipeline = cacheRedis.pipeline();
          pipeline.decrby("stats:storage:image_bytes", oldCoverSize);
          pipeline.incrby("stats:storage:image_bytes", newCoverSize);
          postCommitTasks.push(pipeline.exec().catch(() => {}));
        } else {
          postCommitTasks.push(
            CounterTrack.increment(newCoverSize, COVER_MIME),
          );
        }
      }

      Promise.allSettled([
        ...postCommitTasks, // ✅ Spread mảng ra
        syncAlbumStats(album._id.toString()),
      ]);
      return album;
    } catch (error) {
      await session.abortTransaction();

      // Xóa file mới nếu transaction fail
      if (file?.path) {
        deleteFileFromCloud(file.path, "image").catch((err) =>
          console.error("[AlbumService] New cover cleanup failed:", err),
        );
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 3. GET LIST ───────────────────────────────────────────────────────────

  async getAlbums(filter: AlbumFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";

    const cleanFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("album:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = 10,
      keyword,
      artistId,
      year,
      genreId,
      type,
      sort,
      isPublic,
    } = filter;

    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    // ── Authorization ────────────────────────────────────────────────────────
    if (!isAdmin) {
      query.isPublic = true;
    } else if (isPublic !== undefined) {
      query.isPublic = isPublic;
    }

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
    if (genreId) query.genres = genreId;
    if (type) query.type = type;

    // ── Sort fallback ────────────────────────────────────────────────────────
    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, _id: 1 },
        oldest: { releaseDate: 1, _id: 1 },
        name: { title: 1, _id: 1 },
        newest: { releaseDate: -1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    // ── Query ────────────────────────────────────────────────────────────────
    let baseQuery = Album.find(query)
      .populate("artist", "name avatar slug isVerified")
      .select(
        "title coverImage artist releaseYear type playCount slug isPublic genres themeColor",
      )
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
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: page * limit < total,
      },
    };

    // Cache với jitter để tránh thundering herd
    const ttl = 600 + Math.floor(Math.random() * 120);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] SET error:", err));

    return result;
  }

  // ── 4. DELETE ─────────────────────────────────────────────────────────────

  async deleteAlbum(id: string, currentUser: IUser) {
    const album = await Album.findById(id);
    if (!album) throw new ApiError(httpStatus.NOT_FOUND, "Album not found");

    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();

    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền xóa");
    }

    // Snapshot trước khi xóa — dùng trong cleanup sau commit
    const coverImageToDelete = album.coverImage;
    const coverSizeToDeduct = album.fileSize ?? 0;
    const artistId = album.artist;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Promise.all([
        // Unlink tracks khỏi album
        Track.updateMany({ album: id }, { $unset: { album: "" } }, { session }),
        // Giảm counter Artist
        Artist.findByIdAndUpdate(
          artistId,
          { $inc: { totalAlbums: -1 } },
          { session },
        ),
      ]);

      await album.deleteOne({ session });
      await session.commitTransaction();

      // ── Sau commit: cleanup không block response ──────────────────────────
      await Promise.allSettled([
        // Redis counters
        CounterAlbum.decrement(),
        coverSizeToDeduct > 0
          ? CounterTrack.decrement(coverSizeToDeduct, COVER_MIME)
          : Promise.resolve(),

        // Cache invalidation
        invalidateAlbumCache(id),
        // Cloudinary cleanup
        coverImageToDelete && !coverImageToDelete.includes("default")
          ? deleteFileFromCloud(coverImageToDelete, "image")
          : Promise.resolve(),
      ]);

      return { message: "Xóa đĩa nhạc thành công" };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 5. GET DETAIL ─────────────────────────────────────────────────────────

  async getAlbumDetail(
    slugOrId: string,
    currentUserId?: string,
    userRole: string = "guest", // Mặc định là guest để build key
  ) {
    // 1. Khởi tạo Query & Cache Key
    const isId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    // Cache key phụ thuộc vào slugOrId và role (vì admin/owner thấy được album private)
    const cacheKey = buildCacheKey(`album:detail:${slugOrId}`, userRole, {});

    // 2. Thử lấy dữ liệu từ Cache trước
    const cachedData = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cachedData) {
      const parsed = JSON.parse(cachedData as string);

      // Kiểm tra bảo mật cho dữ liệu cache (nếu album riêng tư)
      if (!parsed.isPublic) {
        await this.checkAlbumAccess(parsed, currentUserId, userRole);
      }
      return parsed;
    }

    // 3. Nếu Cache miss -> Truy vấn Database
    const album = await Album.findOne(query)
      .populate("artist", "name avatar slug isVerified")
      .lean();

    if (!album)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy đĩa nhạc");

    // 4. Kiểm tra quyền truy cập (Private check)
    await this.checkAlbumAccess(album, currentUserId, userRole);

    // 5. Lấy danh sách trackIds (Nguồn cho Virtual Scroll ở FE)
    const tracks = await Track.find({
      album: album._id,
      status: "ready",
      isDeleted: false,
    })
      .sort({ trackNumber: 1, createdAt: 1 })
      .select("_id")
      .lean();

    const result = {
      ...album,
      trackIds: tracks.map((t) => t._id),
    };

    // 6. Lưu vào Cache (TTL 1 tiếng hoặc tùy Phú chỉnh)
    await withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    );

    return result;
  }

  /**
   * Hàm hỗ trợ kiểm tra quyền truy cập (Tách ra để dùng chung cho cả Cache & DB)
   */
  private async checkAlbumAccess(
    album: any,
    currentUserId?: string,
    userRole?: string,
  ) {
    if (album.isPublic) return;

    const albumArtistId =
      album.artist?._id?.toString() ?? album.artist?.toString();

    const isOwner =
      currentUserId &&
      (userRole === "admin" ||
        (await mongoose.model("User").exists({
          _id: currentUserId,
          artistProfile: albumArtistId,
        })));

    if (!isOwner) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Đĩa nhạc này đang ở chế độ riêng tư",
      );
    }
  }

  // ── 6. GET ALBUM TRACKS ───────────────────────────────────────────────────

  async getAlbumTracks(
    albumId: string,
    filter: AlbumFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const userId = currentUser?._id?.toString();
    const isAdmin = userRole === "admin";

    const album = await Album.findById(albumId)
      .select("isPublic artist")
      .lean();
    if (!album)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Album");

    if (!album.isPublic && !isAdmin) {
      const isOwner = userId && album.artist?.toString() === userId;
      if (!isOwner) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền xem danh sách này",
        );
      }
    }

    const { page = 1, limit = 20 } = filter;
    const cacheKey = buildCacheKey(`album:tracks:${albumId}`, userRole, {
      page,
      limit,
    });

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const skip = (page - 1) * limit;

    const trackQuery: Record<string, any> = { album: albumId, status: "ready" };
    if (!isAdmin) trackQuery.isPublic = true;

    const [tracks, total] = await Promise.all([
      Track.find(trackQuery)
        .sort({ trackNumber: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
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
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Set Album Tracks Error:", err));

    return result;
  }
}

export default new AlbumService();
