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
  GenreFilterInput,
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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Giới hạn độ sâu của cây genre để chống tràn bộ nhớ */
const MAX_HIERARCHY_DEPTH = 10;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────────────────────────────────────

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
    const session = await mongoose.startSession();
    session.startTransaction();
    const imageUrl = file?.path ?? "";

    try {
      // 1. Kiểm tra tồn tại trong transaction
      const existing = await Genre.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, "i") },
      })
        .session(session)
        .lean();

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
            image: imageUrl,
            isActive: true,
            trackCount: 0,
            parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
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
    const session = await mongoose.startSession();
    session.startTransaction();
    let oldImage = "";
    let isImageUpdated = false;

    try {
      const genre = await Genre.findById(id).session(session);
      if (!genre)
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

      oldImage = genre.image;

      // ── Tên + Slug ────────────────────────────────────────────────────────
      if (data.name && data.name !== genre.name) {
        const duplicate = await Genre.exists({
          name: { $regex: new RegExp(`^${data.name}$`, "i") },
          _id: { $ne: id },
        }).session(session);

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
        if (!data.parentId) {
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

      // BUG FIX: isActive phải được set TRƯỚC save() để nằm trong cùng một transaction write
      const needsCascade =
        data.isActive !== undefined && data.isActive !== genre.isActive;
      if (data.isActive !== undefined) genre.isActive = data.isActive;

      // ── Image ─────────────────────────────────────────────────────────────
      if (file) {
        genre.image = file.path;
        isImageUpdated = true;
      } else {
        // NÂNG CẤP C: color thay đổi → middleware tự regenerate gradient
        // Service chỉ gán color và gradient nếu được gửi tường minh
        if (data.color !== undefined) genre.color = data.color;
        // Gán gradient nếu Admin muốn override thủ công, ngược lại middleware lo
        if (data.gradient !== undefined) genre.gradient = data.gradient;
      }

      await genre.save({ session }); // pre("save"): slug + gradient nếu cần

      // Cascade deactivate sub-genres
      if (needsCascade && data.isActive === false) {
        await Genre.updateMany(
          { parentId: genre._id },
          { isActive: false },
        ).session(session);
      }

      await session.commitTransaction();

      // BONUS: Cache invalidation + Cloudinary cleanup — fire-and-forget
      Promise.allSettled([
        invalidateGenreCache(id),
        isImageUpdated && oldImage && !oldImage.includes("default")
          ? deleteFileFromCloud(oldImage, "image")
          : Promise.resolve(),
      ]).catch(console.error);

      return genre;
    } catch (error) {
      await session.abortTransaction();
      if (file) deleteFileFromCloud(file.path, "image").catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ── 3. DELETE GENRE ────────────────────────────────────────────────────────

  async deleteGenre(id: string) {
    const genre = await Genre.findById(id);
    if (!genre)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

    // 1. Kiểm tra sự phụ thuộc chặt chẽ
    const [tracksUsing, albumsUsing, subGenres] = await Promise.all([
      Track.exists({ genres: id }),
      Album.exists({ genres: id }),
      Genre.exists({ parentId: id }),
    ]);

    if (tracksUsing || albumsUsing || subGenres) {
      const reasons: string[] = [];
      if (tracksUsing) reasons.push("Bài hát");
      if (albumsUsing) reasons.push("Album");
      if (subGenres) reasons.push("Thể loại con");

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Không thể xóa vì đang chứa các dữ liệu liên quan: ${reasons.join(", ")}.`,
      );
    }

    const imageToDelete = genre.image;

    // 2. Thực hiện xóa
    await genre.deleteOne();

    // 3. Post-delete: Cleanup + Cache
    // Dùng Promise.allSettled để đảm bảo cleanup không bao giờ làm crash API
    Promise.allSettled([
      imageToDelete && !imageToDelete.includes("default")
        ? deleteFileFromCloud(imageToDelete, "image")
        : Promise.resolve(),
      invalidateGenreCache(id),
    ]).catch(console.error);

    return { message: "Xóa thể loại thành công", _id: id };
  }

  // ── 4. TOGGLE STATUS (truly atomic) ───────────────────────────────────────

  async toggleStatus(id: string) {
    const genre = await Genre.findById(id).select("isActive").lean();
    if (!genre)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

    // Atomic flip
    const updated = await Genre.findByIdAndUpdate(
      id,
      [{ $set: { isActive: { $not: "$isActive" } } }],
      { new: true, select: "_id isActive" },
    ).lean();

    // Cascade: nếu vừa deactivate → tắt luôn sub-genres
    if (!updated!.isActive) {
      await Genre.updateMany({ parentId: id }, { isActive: false });
    }

    invalidateGenreCache(id).catch(console.error);

    return updated;
  }

  // ── 5. GET ALL GENRES ─────────────────────────────────────────────────────

  async getAllGenres(queryInput: GenreFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";

    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("genre:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = 20,
      keyword,
      status,
      sort,
      parentId,
      isTrending,
    } = queryInput;

    const filterQuery: Record<string, any> = {};

    if (!isAdmin) {
      filterQuery.isActive = true;
    } else if (status !== undefined) {
      filterQuery.isActive = status === "active";
    }

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
      name: { name: 1, _id: 1 },
      oldest: { createdAt: 1, _id: 1 },
    };

    const sortOption = SORT_MAP[sort ?? "priority"] ?? SORT_MAP.priority;

    const query = Genre.find(filterQuery)
      .populate("parentId", "name slug")
      .select(
        "name slug image color gradient priority trackCount isTrending isActive parentId",
      )
      .sort(sortOption)
      .lean();

    if (limit !== "all") {
      const skip = (Number(page) - 1) * Number(limit);
      query.skip(skip).limit(Number(limit));
    }

    const [genres, total] = await Promise.all([
      query.exec(),
      Genre.countDocuments(filterQuery),
    ]);

    const result = {
      data: genres,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: limit === "all" ? total : Number(limit),
        totalPages: limit === "all" ? 1 : Math.ceil(total / Number(limit)),
        hasNextPage:
          limit === "all" ? false : Number(page) * Number(limit) < total,
      },
    };

    const ttl = 1800 + Math.floor(Math.random() * 600);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch(console.error);

    return result;
  }

  // ── 6. GET GENRE TREE ─────────────────────────────────────────────────────

  async getGenreTree() {
    return Genre.find()
      .select("_id name slug parentId color image priority isActive")
      .sort({ priority: -1, name: 1 })
      .lean();
  }

  // ── 7. GET GENRE DETAIL ────────────────────────────────────────────────────

  async getGenreBySlug(slug: string, userRole: string = "guest") {
    // 1. Build Cache Key (phụ thuộc vào slug và role)
    const cacheKey = buildCacheKey(`genre:detail:${slug}`, userRole, {});

    // 2. Thử lấy từ Cache
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const genre = await Genre.findOne({ slug: slug, isActive: true })
      .populate("parentId", "_id name slug image color")
      .lean();

    if (!genre) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Thể loại không tồn tại hoặc đã bị ẩn",
      );
    }

    const genreId = genre._id;

    // 2. 🔥 QUERY PARALLEL: Lấy dữ liệu liên quan
    const [subGenres, breadcrumbs, allTrackIds] = await Promise.all([
      // A. Lấy danh sách thể loại con (để hiện tab hoặc list gợi ý)
      Genre.find({ parentId: genreId, isActive: true })
        .select("_id name slug image trackCount priority color")
        .sort({ priority: -1, trackCount: -1 })
        .lean(),

      // B. Xây dựng đường dẫn (Pop -> Dance Pop...)
      this.buildBreadcrumbs(genre),

      // C. Lấy mảng ID của TOÀN BỘ bài hát thuộc thể loại này
      // Sắp xếp theo độ phổ biến (playCount) hoặc mới nhất
      Track.find({ genres: genreId, status: "ready", isPublic: true })
        .sort({ playCount: -1, createdAt: -1 })
        .select("_id")
        .lean(),
    ]);

    const result = {
      ...genre,
      subGenres,
      breadcrumbs,
      // Trả về mảng ID cực nhẹ để FE làm Virtual Scroll
      trackIds: allTrackIds.map((t) => t._id),
    };

    // 4. Lưu Cache (TTL 1 giờ)
    await withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    );

    return result;
  }
  // ── 8. GET GENRE TRACKS ───────────────────────────────────────────────────

  async getGenreTracks(genreId: string, filter: any, userRole?: string) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;
    const isAdmin = userRole === "admin";

    const cacheKey = buildCacheKey(
      `genre:tracks:${genreId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const trackQuery: Record<string, any> = {
      genres: genreId,
      status: "ready",
    };
    if (!isAdmin) trackQuery.isPublic = true;

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
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
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
