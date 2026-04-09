import mongoose, { Types } from "mongoose";
import httpStatus from "http-status";
import Genre from "../models/Genre";
import Track from "../models/Track";
import Album from "../models/Album";
import ApiError from "../utils/ApiError";
import { generateUniqueSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  CreateGenreInput,
  GenreFilterInput,
  UpdateGenreInput,
} from "../validations/genre.validation";
import { IUser } from "../models/User";
import { buildCacheKey, withCacheTimeout } from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";
import escapeStringRegexp from "escape-string-regexp";

class GenreService {
  // ==========================================
  // 🔴 WRITE METHODS (CREATE, UPDATE, DELETE)
  // ==========================================

  /**
   * 1. CREATE GENRE (Chống Race Condition & Bọc Session)
   */
  async createGenre(data: CreateGenreInput, file?: Express.Multer.File) {
    const session = await mongoose.startSession();
    session.startTransaction();

    const slug = await generateUniqueSlug(Genre, data.name);
    const imageUrl = file ? file.path : "";

    try {
      // 1. Kiểm tra tồn tại trong Transaction để đảm bảo Isolation
      const existingGenre = await Genre.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, "i") },
      })
        .session(session)
        .lean();

      if (existingGenre) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Tên thể loại này đã tồn tại",
        );
      }

      // 2. Khóa (Lock) Thể loại cha để đảm bảo nó không bị xóa trong lúc ta đang tạo con
      if (data.parentId) {
        const parentGenre = await Genre.findById(data.parentId)
          .session(session)
          .lean();
        if (!parentGenre) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Thể loại cha không tồn tại",
          );
        }
      }

      // 3. Create an toàn
      const [newGenre] = await Genre.create(
        [
          {
            ...data,
            slug,
            image: imageUrl,
            isActive: true,
            trackCount: 0,
            albumCount: 0,
            artistCount: 0,
            parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return newGenre;
    } catch (error: any) {
      await session.abortTransaction();

      // Dọn rác file Cloudinary nếu DB lỗi
      if (imageUrl) {
        await deleteFileFromCloud(imageUrl, "image").catch(console.error);
      }

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

  /**
   * 2. UPDATE GENRE (Fix Cloudinary Lifecycle & Circular Dependency)
   */
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
      // Dùng findByIdAndUpdate hoặc lấy document ra trong session
      const genre = await Genre.findById(id).session(session);
      if (!genre) {
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");
      }

      oldImage = genre.image;

      // A. Xử lý đổi tên & Slug (Check unique trong session)
      if (data.name && data.name !== genre.name) {
        const duplicate = await Genre.exists({
          name: { $regex: new RegExp(`^${data.name}$`, "i") },
          _id: { $ne: id },
        }).session(session);

        if (duplicate) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Tên thể loại đã được sử dụng",
          );
        }
        genre.name = data.name;
        genre.slug = await generateUniqueSlug(Genre, data.name);
      }

      // B. Xử lý Logic Thể loại Cha
      if (data.parentId !== undefined) {
        if (data.parentId === "" || data.parentId === null) {
          genre.parentId = null;
        } else {
          if (data.parentId.toString() === id.toString()) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Không thể chọn chính mình làm cha",
            );
          }

          const parentGenre = await Genre.findById(data.parentId)
            .session(session)
            .lean();
          if (!parentGenre) {
            throw new ApiError(
              httpStatus.NOT_FOUND,
              "Thể loại cha không tồn tại",
            );
          }

          // Kiểm tra Vòng lặp vô tận (Phải truyền session vào helper nếu check sâu)
          const isCircular = await this.checkCircularDependency(
            id,
            data.parentId,
            session,
          );
          if (isCircular) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Phát hiện vòng lặp vô tận giữa các thể loại cha - con",
            );
          }

          genre.parentId = new Types.ObjectId(data.parentId);
        }
      } else if (data.parentId === undefined) {
        genre.parentId = data.parentId; // Giữ nguyên nếu không truyền parentId
      }

      // C. Cập nhật các trường còn lại
      if (data.description !== undefined) genre.description = data.description;
      if (data.color) genre.color = data.color;
      if (data.gradient !== undefined) genre.gradient = data.gradient;
      if (data.priority !== undefined) genre.priority = data.priority;
      if (data.isTrending !== undefined) genre.isTrending = data.isTrending;

      // D. Cập nhật File Ảnh
      if (file) {
        genre.image = file.path;
        isImageUpdated = true;
      }

      await genre.save({ session });

      // 🔥 Bổ sung Logic: Nếu Vô hiệu hóa (Inactive) Genre cha, vô hiệu hóa luôn Genre con
      if (data.isActive !== undefined && data.isActive !== genre.isActive) {
        genre.isActive = data.isActive;
        if (data.isActive === false) {
          await Genre.updateMany(
            { parentId: genre._id },
            { isActive: false },
          ).session(session);
        }
      }

      await session.commitTransaction();

      // Dọn rác Cloudinary ảnh cũ sau khi commit thành công
      if (isImageUpdated && oldImage && !oldImage.includes("default")) {
        deleteFileFromCloud(oldImage, "image").catch(console.error);
      }

      return genre;
    } catch (error: any) {
      await session.abortTransaction();
      if (file) {
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 3. DELETE GENRE (Fix Cloudinary Data Consistency)
   */
  async deleteGenre(id: string) {
    const genre = await Genre.findById(id);
    if (!genre)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

    // Check Ràng buộc
    const [tracksUsing, albumsUsing, subGenres] = await Promise.all([
      Track.exists({ genres: id }),
      Album.exists({ genres: id }),
      Genre.exists({ parentId: id }),
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

    // Xóa DB trước
    await genre.deleteOne();

    // Nếu DB xóa thành công, dọn rác trên mây ngầm
    if (imageToDelete && !imageToDelete.includes("default")) {
      deleteFileFromCloud(imageToDelete, "image").catch(console.error);
    }

    return { message: "Xóa thể loại thành công", _id: id };
  }

  /**
   * 4. TOGGLE STATUS (Atomic Update + Tác động dây chuyền xuống con)
   */
  async toggleStatus(id: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const genre = await Genre.findById(id).session(session);
      if (!genre)
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy thể loại");

      const newStatus = !genre.isActive;
      genre.isActive = newStatus;
      await genre.save({ session });

      // Nếu tắt Genre cha, tự động tắt tất cả sub-genres của nó
      if (newStatus === false) {
        await Genre.updateMany(
          { parentId: genre._id },
          { isActive: false },
        ).session(session);
      }

      await session.commitTransaction();
      return genre;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ==========================================
  // 🟢 READ METHODS (GET LIST & TREE)
  // ==========================================
  /**
   * 2. GET ALL GENRES (Tree Support & Caching)
   */
  async getAllGenres(queryInput: GenreFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";

    // 1. STABLE CACHE KEY
    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(
        ([_, v]) => v !== undefined && v !== "",
      ),
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

    // --- 2. SECURITY & FILTER LOGIC ---
    // Guest/User chỉ thấy Active. Admin thấy theo filter.
    if (!isAdmin) {
      filterQuery.isActive = true;
    } else if (status !== undefined) {
      filterQuery.isActive = status === "active";
    }

    if (isTrending !== undefined) filterQuery.isTrending = isTrending;

    // Xử lý logic Tree
    if (parentId === "root") {
      filterQuery.parentId = null;
    } else if (parentId) {
      filterQuery.parentId = parentId;
    }

    // Chống ReDoS & Prefix Match để tận dụng Index
    if (keyword) {
      const safeKeyword = escapeStringRegexp(keyword.substring(0, 100));
      filterQuery.name = { $regex: `^${safeKeyword}`, $options: "i" };
    }

    // --- 3. SORT MAP ---
    const SORT_MAP: Record<string, any> = {
      priority: { priority: -1, trackCount: -1, _id: 1 },
      popular: { trackCount: -1, priority: -1, _id: 1 },
      newest: { createdAt: -1, _id: 1 },
      name: { name: 1, _id: 1 },
      oldest: { createdAt: 1, _id: 1 },
    };

    const sortOption = SORT_MAP[sort ?? "priority"] ?? SORT_MAP.priority;

    // --- 4. EXECUTION ---
    const query = Genre.find(filterQuery)
      .populate("parentId", "name slug")
      .select(
        "name slug image color gradient priority trackCount isTrending isActive parentId themeColor",
      )
      .sort(sortOption)
      .lean();

    // Chỉ phân trang nếu limit không phải "all"
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
        hasNextPage: limit === "all" ? false : page * Number(limit) < total,
      },
    };

    // --- 5. INTELLIGENT CACHING ---
    // Thể loại thường rất ít thay đổi -> TTL dài (30 phút - 1 tiếng)
    const ttl = 1800 + Math.floor(Math.random() * 600);

    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Genre SET error:", err));

    return result;
  }

  /**
   * 2.5. GET GENRE TREE (For Selectors/Dropdowns)
   */
  async getGenreTree() {
    return await Genre.find()
      .select("_id name slug parentId color image priority isActive")
      .sort({ priority: -1, name: 1 })
      .lean();
  }

  /**
   * 4. GET GENRE DETAIL (Client View)
   */
  /**
   * 4. GET GENRE DETAIL (Virtual Scroll Optimized)
   * Lấy Metadata + Sub-genres + Mảng ID bài hát đầy đủ
   */
  async getGenreBySlug(slug: string, userRole?: string) {
    // 1. Fetch thông tin Genre cơ bản
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

    return {
      ...genre,
      subGenres,
      breadcrumbs,
      // Trả về mảng ID cực nhẹ để FE làm Virtual Scroll
      trackIds: allTrackIds.map((t) => t._id),
    };
  }
  /**
   * 5. GET GENRE TRACKS (Infinite Loading)
   * Tải chi tiết bài hát theo trang (Page/Limit) cho Virtual Scroll
   */
  async getGenreTracks(
    genreId: string,
    filter: any, // { page, limit }
    userRole?: string,
  ) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;
    const isAdmin = userRole === "admin";

    // 1. Xử lý CACHE (Thể loại nhạc thường có lượt truy cập cao)
    const cacheKey = buildCacheKey(
      `genre:tracks:${genreId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    // 2. Truy vấn Database
    const trackQuery: Record<string, any> = {
      genres: genreId, // MongoDB tự hiểu genreId nằm trong mảng genreIds
      status: "ready",
    };

    if (!isAdmin) {
      trackQuery.isPublic = true;
    }

    const [tracks, total] = await Promise.all([
      Track.find(trackQuery)
        .sort({ playCount: -1, createdAt: -1 }) // Thứ tự phổ biến nhất
        .skip(skip)
        .limit(Number(limit))
        .populate("artist", "name slug isVerified")
        .populate("album", "title slug coverImage")
        .select(
          "title slug duration playCount coverImage hlsUrl isPublic isExplicit bitrate",
        )
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

    // 3. LƯU CACHE (15-20 phút)
    const ttl = 900 + Math.floor(Math.random() * 120);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Set Genre Tracks Error:", err));

    return result;
  }
  // ==========================================
  // ⚙️ HELPERS
  // ==========================================

  /**
   * HELPER: Circular Check (Thuật toán truy vết an toàn, chống tràn bộ nhớ)
   */
  async checkCircularDependency(
    genreId: string,
    newParentId: string,
    session?: mongoose.ClientSession,
  ): Promise<boolean> {
    let currentParentId: string | null = newParentId;
    const visitedSet = new Set<string>();

    while (currentParentId) {
      if (currentParentId.toString() === genreId.toString()) return true;
      if (visitedSet.has(currentParentId.toString())) return true;

      visitedSet.add(currentParentId.toString());

      const query = Genre.findById(currentParentId).select("parentId").lean();
      if (session) query.session(session);

      const parent: any = await query;
      currentParentId = parent?.parentId ? parent.parentId.toString() : null;
    }

    return false;
  }
  async buildBreadcrumbs(currentGenre: any) {
    const crumbs = [];
    let currentParentId = currentGenre.parentId?._id || currentGenre.parentId;
    const visitedSet = new Set<string>();

    while (currentParentId) {
      // Chống lặp vô tận trong lúc build breadcrumbs
      if (visitedSet.has(currentParentId.toString())) break;
      visitedSet.add(currentParentId.toString());

      const parent = await Genre.findById(currentParentId)
        .select("_id name slug parentId")
        .lean();

      if (!parent) break;

      crumbs.unshift(parent);
      currentParentId = parent.parentId;
    }
    return crumbs;
  }
}

export default new GenreService();
