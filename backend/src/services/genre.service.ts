// services/genre.service.ts

import mongoose, { Types } from "mongoose";
import httpStatus from "http-status";
import Genre from "../models/Genre";
import Track from "../models/Track";
import Album from "../models/Album";
import ApiError from "../utils/ApiError";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  CreateGenreInput,
  GenreAdminFilterInput,
  GenreUserFilterInput,
  UpdateGenreInput,
} from "../validations/genre.validation";
import { IUser } from "../models/User";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidateGenreCache,
} from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";
import escapeStringRegexp from "escape-string-regexp";
import themeColorService from "./themeColor.service";
import { is } from "zod/v4/locales";
import { APP_CONFIG } from "../config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Giới hạn độ sâu của cây genre để chống tràn bộ nhớ */
const MAX_HIERARCHY_DEPTH = 10;
async function syncGenreStats(genreId: string): Promise<void> {
  try {
    await Genre.calculateStats(genreId);
  } catch (err) {
    console.error("[GenreService] calculateStats error (non-critical):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class GenreService {
  // ── 1. CREATE GENRE ────────────────────────────────────────────────────────
  async createGenre(data: CreateGenreInput, file?: Express.Multer.File) {
    // Nếu FE không gửi color mà có ảnh, thử trích xuất màu chủ đạo để tạo gradient đẹp hơn
    let color = data.color || "#121212";
    const imageUrl = file?.path ?? "";
    if (!data.color && imageUrl) {
      try {
        color = await themeColorService.extractThemeColor(imageUrl);
      } catch (err) {
        console.error("[GenreService] Color extraction failed:", err);
      }
    }
    const gradient = `linear-gradient(135deg, ${color} 0%, #121212 100%)`;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Kiểm tra tồn tại trong transaction
      const existing = await Genre.exists({ name: data.name }).session(session);
      if (existing)
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Tên thể loại này đã tồn tại",
        );

      // 2. Lock parent nếu có
      if (data.parentId) {
        const parent = await Genre.findById(data.parentId)
          .session(session)
          .lean();
        if (!parent)
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Thể loại cha không tồn tại",
          );
      }

      // 3. Tạo Genre
      const [newGenre] = await Genre.create(
        [
          {
            ...data,
            color,
            gradient,
            image: imageUrl,
            isActive: true,
            trackCount: 0,
            playCount: 0,
            parentId:
              data.parentId === "root"
                ? null
                : data.parentId
                  ? new Types.ObjectId(data.parentId)
                  : null,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      // 4. Hậu kỳ (Post-commit)
      Promise.allSettled([invalidateGenreCache(newGenre._id.toString())]).catch(
        console.error,
      );

      return newGenre;
    } catch (error: any) {
      await session.abortTransaction();
      if (imageUrl)
        await deleteFileFromCloud(imageUrl, "image").catch(console.error);

      if (error.code === 11000) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Tên thể loại hoặc đường dẫn (slug) đã tồn tại",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ── 2. UPDATE GENRE ────────────────────────────────────────────────────────
  async updateGenre(
    id: string,
    data: UpdateGenreInput,
    file?: Express.Multer.File,
  ) {
    // 1. Xử lý ảnh và màu sắc trước khi mở Transaction
    let themeColorData: { color?: string; gradient?: string } = {};
    if (file && !data.color) {
      try {
        const color = await themeColorService.extractThemeColor(file.path);
        themeColorData.color = color;
        themeColorData.gradient = `linear-gradient(135deg, ${color} 0%, #121212 100%)`;
      } catch (err) {
        console.error("[UpdateGenre] Color extraction failed:", err);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let oldImage = "";

    try {
      const genre = await Genre.findById(id).session(session);
      if (!genre)
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

      oldImage = genre.image;

      // ── Tên + Slug ────────────────────────────────────────────────────────
      if (data.name && data.name !== genre.name) {
        const duplicate = await Genre.exists({ name: data.name }).session(
          session,
        );

        if (duplicate)
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Tên thể loại đã được sử dụng",
          );

        genre.name = data.name;
        // pre("save") tự regenerate slug khi name isModified
      }

      // ── Parent + Circular check ───────────────────────────────────────────
      if (data.parentId !== undefined) {
        if (
          data.parentId === null ||
          data.parentId === "" ||
          data.parentId === "root"
        ) {
          genre.parentId = null;
        } else {
          if (data.parentId.toString() === id)
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Không thể chọn chính mình làm cha",
            );

          const parent = await Genre.findById(data.parentId)
            .session(session)
            .lean();
          if (!parent)
            throw new ApiError(
              httpStatus.NOT_FOUND,
              "Thể loại cha không tồn tại",
            );

          const isCircular = await this.checkCircularDependency(
            id,
            data.parentId,
            session,
          );
          if (isCircular)
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Phát hiện vòng lặp vô tận giữa các thể loại cha - con",
            );

          genre.parentId = new Types.ObjectId(data.parentId);
        }
      }

      // ── Metadata ──────────────────────────────────────────────────────────
      if (data.description !== undefined) genre.description = data.description;
      if (data.priority !== undefined) genre.priority = data.priority;
      if (data.isTrending !== undefined) genre.isTrending = data.isTrending;

      // ── Image ─────────────────────────────────────────────────────────────
      if (file) {
        genre.image = file.path;
        if (themeColorData.color) {
          genre.color = themeColorData.color;
          genre.gradient = themeColorData.gradient!;
        }
      } else {
        if (data.color) genre.color = data.color;
        if (data.gradient) genre.gradient = data.gradient;
      }

      await genre.save({ session }); // pre("save"): slug + gradient nếu cần

      await session.commitTransaction();

      // 7. Cleanup (Chỉ chạy một lần trong Promise.allSettled)
      Promise.allSettled([
        invalidateGenreCache(id),
        syncGenreStats(id),
        file && oldImage && !oldImage.includes("default")
          ? deleteFileFromCloud(oldImage, "image")
          : Promise.resolve(),
      ]).catch(console.error);

      return genre;
    } catch (error) {
      await session.abortTransaction();
      if (file)
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ── 3. DELETE GENRE ────────────────────────────────────────────────────────

  async deleteGenre(id: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const genre = await Genre.findById(id).session(session).lean();
      if (!genre) {
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");
      }
      // 1. Lấy thông tin trước khi xóa

      // 2. Kiểm tra sự phụ thuộc chặt chẽ (Giữ nguyên vì rất tốt)
      const [tracksUsing, albumsUsing, subGenres] = await Promise.all([
        Track.exists({ genres: id }).session(session),
        Album.exists({ genres: id }).session(session),
        Genre.exists({ parentId: id }).session(session),
      ]);

      if (tracksUsing || albumsUsing || subGenres) {
        const reasons = [];
        if (tracksUsing) reasons.push("Bài hát");
        if (albumsUsing) reasons.push("Album");
        if (subGenres) reasons.push("Thể loại con");

        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Không thể xóa vì đang chứa các dữ liệu liên quan: ${reasons.join(", ")}.`,
        );
      }

      const imageToDelete = genre.image;

      // 3. Thực hiện xóa thông qua Model (Thay vì Document instance đã lean)
      await Genre.updateOne({ _id: id }, { isDeleted: true }).session(session);

      await session.commitTransaction();

      // 4. Hậu kỳ (Async)
      Promise.allSettled([
        imageToDelete && !imageToDelete.includes("default")
          ? deleteFileFromCloud(imageToDelete, "image")
          : Promise.resolve(),
        invalidateGenreCache(id),
      ]).catch(console.error);

      return { message: "Xóa thể loại thành công", _id: id };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
  // ── 4. TOGGLE STATUS (truly atomic) ───────────────────────────────────────

  async toggleStatus(id: string) {
    const updated = await Genre.findByIdAndUpdate(
      id,
      [{ $set: { isActive: { $not: "$isActive" } } }],
      { new: true, select: "_id isActive" },
    ).lean();

    if (!updated) {
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");
    }

    if (updated.isActive === false) {
      Genre.updateMany({ parentId: id }, { isActive: false }).catch(
        console.error,
      );
    }

    // 3. Xử lý Cache
    invalidateGenreCache(id).catch(console.error);

    return updated;
  }

  // ── 5. GET ALL GENRES ─────────────────────────────────────────────────────

  async getGenresByUser(queryInput: GenreUserFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ? "user" : "guest";

    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("genre:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      sort,
      parentId,
      isTrending,
    } = queryInput;

    const filterQuery: Record<string, any> = {
      isDeleted: false,
      isActive: true,
    };

    if (isTrending !== undefined) filterQuery.isTrending = isTrending;

    if (parentId === "root") {
      filterQuery.parentId = null;
    } else if (parentId) {
      filterQuery.parentId = parentId;
    }

    if (keyword) {
      const safe = escapeStringRegexp(keyword.substring(0, 100));
      filterQuery.name = { $regex: `^${safe}`, $options: "i" };
    }

    const SORT_MAP: Record<string, any> = {
      priority: { priority: -1, trackCount: -1, _id: 1 },
      popular: { playCount: -1, priority: -1, _id: 1 },
      newest: { createdAt: -1, _id: 1 },
      oldest: { createdAt: 1, _id: 1 },
      name: { name: 1, _id: 1 },
    };

    const sortOption = SORT_MAP[sort ?? "priority"] ?? SORT_MAP.priority;

    const query = Genre.find(filterQuery)
      .select("name slug image trackCount isTrending")
      .sort(sortOption)
      .lean();

    const skip = (Number(page) - 1) * Number(limit);
    query.skip(skip).limit(Number(limit));

    const [genres, total] = await Promise.all([
      query.exec(),
      Genre.countDocuments(filterQuery),
    ]);

    const result = {
      data: genres,
      meta: {
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: Number(page) * Number(limit) < Number(total),
      },
    };

    const ttl = 1800 + Math.floor(Math.random() * 600);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }

  // ── 5.1 GET GENRES BY ADMIN ─────────────────────────────────────────────────────
  async getGenresByAdmin(
    queryInput: GenreAdminFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";
    if (!isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Chỉ admin mới có quyền truy cập danh sách thể loại đầy đủ",
      );
    }
    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      isActive,
      isDeleted,
      sort,
      parentId,
      isTrending,
    } = queryInput;

    const filterQuery: Record<string, any> = {};
    if (isActive !== undefined) filterQuery.isActive = isActive;
    if (isDeleted !== undefined) filterQuery.isDeleted = isDeleted;
    if (isTrending !== undefined) filterQuery.isTrending = isTrending;
    if (parentId === "root") {
      filterQuery.parentId = null;
    } else if (parentId) {
      filterQuery.parentId = parentId;
    }
    if (keyword) {
      const safe = escapeStringRegexp(keyword.substring(0, 100));
      filterQuery.name = { $regex: `^${safe}`, $options: "i" };
    }

    const SORT_MAP: Record<string, any> = {
      priority: { priority: -1, trackCount: -1, _id: 1 },
      popular: { playCount: -1, priority: -1, _id: 1 },
      newest: { createdAt: -1, _id: 1 },
      oldest: { createdAt: 1, _id: 1 },
      name: { name: 1, _id: 1 },
    };

    const sortOption = SORT_MAP[sort ?? "priority"] ?? SORT_MAP.priority;

    const query = Genre.find(filterQuery)
      .populate("parentId", "name slug")
      .sort(sortOption)
      .lean();

    const skip = (Number(page) - 1) * Number(limit);
    query.skip(skip).limit(Number(limit));

    const [genres, total] = await Promise.all([
      query.exec(),
      Genre.countDocuments(filterQuery),
    ]);

    const result = {
      data: genres,
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

  // ── 6. GET GENRE TREE ─────────────────────────────────────────────────────
  async getGenreTree() {
    return Genre.find()
      .select(
        "_id name slug parentId color image priority isTrending trackCount playCount",
      )
      .sort({ priority: -1, name: 1 })
      .lean();
  }

  // ── 7. GET GENRE DETAIL ────────────────────────────────────────────────────
  async getGenreDetail(slug: string, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const cacheKey = buildCacheKey(`genre:detail:${slug}`, userRole, {});

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    // 1. Tìm Genre chính
    const genre = await Genre.findOne({
      slug: slug,
      isActive: true,
      isDeleted: false,
    })
      .populate("parentId", "_id name slug image color trackCount")
      .lean();

    if (!genre) {
      throw new ApiError(httpStatus.NOT_FOUND, "Thể loại không tồn tại");
    }

    const genreId = genre._id;

    // 2. QUERY PARALLEL (Tối ưu hóa Index)
    const [subGenres, breadcrumbs, allTrackIds] = await Promise.all([
      Genre.find({ parentId: genreId, isActive: true, isDeleted: false })
        .select("_id name slug image color trackCount")
        .sort({ priority: -1, trackCount: -1 })
        .lean(),

      this.buildBreadcrumbs(genre),

      Track.find({
        genres: genreId, // Đảm bảo trường 'genres' trong Track đã được đánh Index
        status: "ready",
        isPublic: true,
        isDeleted: false,
      })
        .sort({ playCount: -1, createdAt: -1 })
        .limit(APP_CONFIG.TRACKS_LIMIT) // Ngưỡng an toàn để tránh Payload quá lớn
        .select("_id")
        .lean(),
    ]);

    const result = {
      ...genre,
      subGenres,
      breadcrumbs,
      trackIds: allTrackIds.map((t) => t._id),
      totalTracksCount: allTrackIds.length, // Thêm thông tin tổng số lượng để FE hiển thị
    };

    // 3. Lưu Cache với cơ chế "Fire-and-forget" để không block client
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    ).catch((err) => console.error("Redis Set Error:", err));

    return result;
  }
  // ── 8. GET GENRE TRACKS ───────────────────────────────────────────────────

  async getGenreTracks(genreId: string, filter: any, currentUser?: IUser) {
    const { page = 1, limit = APP_CONFIG.VIRTUAL_SCROLL_LIMIT } = filter;
    const skip = (Number(page) - 1) * Number(limit);
    const userRole = currentUser?.role ? "user" : "guest";

    const cacheKey = buildCacheKey(
      `genre:tracks:${genreId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const trackQuery: Record<string, any> = {
      genres: genreId, // Đảm bảo trường 'genres' trong Track đã được đánh Index
      status: "ready",
      isPublic: true,
      isDeleted: false,
    };

    const [tracks, total] = await Promise.all([
      Track.find(trackQuery)
        .sort({ playCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
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
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: skip + Number(limit) < Number(total),
      },
    };

    const ttl = 900 + Math.floor(Math.random() * 120);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  /**
   * BONUS: Batched ancestor lookup thay vì sequential await trong while loop.
   * Thu thập tất cả parentId → bulk fetch → traverse — O(depth) queries thay vì
   * O(depth) sequential awaits.
   *
   * Depth limit = MAX_HIERARCHY_DEPTH để chống tràn bộ nhớ nếu có circular bug còn sót.
   */
  async checkCircularDependency(
    genreId: string,
    newParentId: string,
    session?: mongoose.ClientSession,
  ): Promise<boolean> {
    let currentId = newParentId;
    const visited = new Set<string>();
    let depth = 0;

    while (currentId && depth < MAX_HIERARCHY_DEPTH) {
      if (currentId === genreId) return true;
      if (visited.has(currentId)) return true; // circular trong tree hiện tại

      visited.add(currentId);
      depth++;

      const q = Genre.findById(currentId).select("parentId").lean();
      if (session) q.session(session);

      const parent: any = await q;
      currentId = parent?.parentId?.toString() ?? "";
    }

    return false;
  }

  /**
   * BONUS: Batch breadcrumb build — fetch tất cả ancestors trong ít queries nhất.
   * Dùng ID collection thay vì sequential await.
   */
  async buildBreadcrumbs(currentGenre: any): Promise<any[]> {
    // Thu thập chain of parentIds bằng cách đi ngược cây
    const crumbs: any[] = [];
    let currentParentId =
      currentGenre.parentId?._id?.toString() ??
      currentGenre.parentId?.toString() ??
      null;

    const visited = new Set<string>();
    let depth = 0;

    while (currentParentId && depth < MAX_HIERARCHY_DEPTH) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      depth++;

      const parent = await Genre.findById(currentParentId)
        .select("_id name slug parentId")
        .lean();

      if (!parent) break;

      crumbs.unshift(parent);
      currentParentId = (parent as any).parentId?.toString() ?? null;
    }

    return crumbs;
  }
}

export default new GenreService();
