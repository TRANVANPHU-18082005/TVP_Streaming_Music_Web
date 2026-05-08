// services/artist.service.ts

import mongoose, { Types } from "mongoose";
import Artist, { IArtist } from "../models/Artist";
import User, { IUser } from "../models/User";
import Album from "../models/Album";
import Track from "../models/Track";
import Follow from "../models/Follow";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseTags } from "../utils/helper";
import {
  ArtistAdminFilterInput,
  ArtistUserFilterInput,
  CreateArtistInput,
  UpdateArtistInput,
} from "../validations/artist.validation";

import { cacheRedis } from "../config/redis";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidateArtistCache,
} from "../utils/cacheHelper";
import escapeStringRegexp from "escape-string-regexp";
import { APP_CONFIG } from "../config/constants";
import themeColorService from "./themeColor.service";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gọi Artist.calculateStats() sau commit — fire-and-forget, không block response.
 * Dùng Promise.allSettled nên failure không crash caller.
 */
async function syncArtistStats(artistId: string): Promise<void> {
  try {
    await Artist.calculateStats(artistId);
  } catch (err) {
    console.error("[ArtistService] calculateStats error (non-critical):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class ArtistService {
  // ── 1. GET ARTIST DETAIL ───────────────────────────────────────────────────
  async getArtistDetail(slug: string, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    // 1. Build Cache Key
    const cacheKey = buildCacheKey(`artist:detail:${slug}`, userRole, {});

    // 2. Thử lấy từ cache
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    // 3. Query Database
    const query = { slug, isActive: true, isDeleted: false };
    // 1. Fetch thông tin Artist cơ bản
    const artist = await Artist.findOne(query).lean();

    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Nghệ sĩ không tồn tại");

    const artistId = artist._id;

    // 2. 🔥 QUERY PARALLEL: Lấy các thông tin "vỏ"
    const [albums, allTrackIds] = await Promise.all([
      // B. Get Albums (Discography) - Lấy 10 album mới nhất
      Album.find({ artist: artistId, isPublic: true, isDeleted: false })
        .sort({ releaseYear: -1, createdAt: -1 })
        .limit(10)
        .select("title coverImage releaseYear slug type")
        .lean(),

      // C. Lấy mảng ID của TOÀN BỘ bài hát (Để làm Virtual Scroll)
      // Sắp xếp theo playCount để lấy danh sách "Top Tracks" đầy đủ
      Track.find({
        $or: [{ artist: artistId }, { featuringArtists: artistId }],
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
      ...artist,
      trackIds: allTrackIds.map((t) => t._id),
      albums,
    };

    // 4. Lưu Cache (TTL 1 giờ)
    await withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    ).catch((err) => console.error("Redis Set Error:", err));

    return result;
  }

  // ── 2. GET ARTIST TRACKS ───────────────────────────────────────────────────
  async getArtistTracks(artistId: string, filter: any, currentUser?: IUser) {
    const { page = 1, limit = APP_CONFIG.VIRTUAL_SCROLL_LIMIT } = filter;
    const skip = (Number(page) - 1) * Number(limit);
    const userRole = currentUser?.role ? "user" : "guest";

    const cacheKey = buildCacheKey(
      `artist:tracks:${artistId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const trackQuery: Record<string, any> = {
      $or: [{ artist: artistId }, { featuringArtists: artistId }],
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
    ).catch((err) => console.error("[Cache] Artist Tracks SET error:", err));

    return result;
  }

  // ── 3. GET ARTISTS LIST BY ADMIN ────────────────────────────────────────────────────

  async getArtistsByAdmin(
    queryInput: ArtistAdminFilterInput,
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
      nationality,
      isVerified,
      sort,
      isActive,
      isDeleted,
    } = queryInput;

    const skip = (Number(page) - 1) * Number(limit);
    const filterQuery: Record<string, any> = {};

    // BONUS: Dual search strategy
    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      if (!sort) {
        // $text: relevance ranking, uses text index on name + aliases + bio
        filterQuery.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        // Prefix regex — compound index works with explicit sort
        const safe = escapeStringRegexp(keyword.substring(0, 100));
        filterQuery.$or = [
          { name: { $regex: `^${safe}`, $options: "i" } },
          { aliases: { $in: [new RegExp(`^${safe}`, "i")] } },
        ];
      }
    }

    if (nationality) filterQuery.nationality = nationality;
    if (isVerified !== undefined) filterQuery.isVerified = isVerified;
    if (isDeleted !== undefined) filterQuery.isDeleted = isDeleted;
    if (isActive !== undefined) filterQuery.isActive = isActive;
    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, totalFollowers: -1, _id: 1 },
        monthlyListeners: { monthlyListeners: -1, _id: 1 },
        newest: { createdAt: -1, _id: 1 },
        oldest: { createdAt: 1, _id: 1 },
        name: { name: 1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "popular"] ?? SORT_MAP.popular;
    }

    let baseQuery = Artist.find(filterQuery)
      .sort(sortOption!)
      .skip(skip)
      .limit(Number(limit))
      .lean<IArtist & { score?: number }>();

    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }
    const [artists, total] = await Promise.all([
      baseQuery.lean(),
      Artist.countDocuments(filterQuery),
    ]);

    const result = {
      data: artists,
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
  // ── 4. GET ARTISTS LIST BY USER ────────────────────────────────────────────────────

  async getArtistsByUser(
    queryInput: ArtistUserFilterInput,
    currentUser?: IUser,
  ) {
    const userRole = currentUser?.role ? "user" : "guest";

    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("artist:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = APP_CONFIG.GRID_LIMIT,
      keyword,
      nationality,
      sort,
    } = queryInput;

    const skip = (Number(page) - 1) * Number(limit);
    const filterQuery: Record<string, any> = {
      isActive: true,
      isDeleted: false,
    };

    // BONUS: Dual search strategy
    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      if (!sort) {
        // $text: relevance ranking, uses text index on name + aliases + bio
        filterQuery.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        // Prefix regex — compound index works with explicit sort
        const safe = escapeStringRegexp(keyword.substring(0, 100));
        filterQuery.$or = [
          { name: { $regex: `^${safe}`, $options: "i" } },
          { aliases: { $in: [new RegExp(`^${safe}`, "i")] } },
        ];
      }
    }

    if (nationality) filterQuery.nationality = nationality;

    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        popular: { playCount: -1, totalFollowers: -1, _id: 1 },
        monthlyListeners: { monthlyListeners: -1, _id: 1 },
        newest: { createdAt: -1, _id: 1 },
        name: { name: 1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "popular"] ?? SORT_MAP.popular;
    }

    let baseQuery = Artist.find(filterQuery)
      .sort(sortOption!)
      .skip(skip)
      .limit(Number(limit))
      .lean<IArtist & { score?: number }>();

    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }
    const [artists, total] = await Promise.all([
      baseQuery.lean(),
      Artist.countDocuments(filterQuery),
    ]);

    const result = {
      data: artists,
      meta: {
        totalItems: Number(total),
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(Number(total) / Number(limit)),
        hasNextPage: Number(page) * Number(limit) < Number(total),
      },
    };

    const ttl = 900 + Math.floor(Math.random() * 300);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Artist LIST SET error:", err));

    return result;
  }

  // ── 5. CREATE ARTIST (ADMIN) ───────────────────────────────────────────────

  async createArtistByAdmin(
    data: CreateArtistInput,
    files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    // 1. Kiểm tra tồn tại (Case-insensitive nếu cần)
    const existing = await Artist.exists({
      name: { $regex: new RegExp(`^${data.name}$`, "i") },
    });
    if (existing)
      throw new ApiError(httpStatus.BAD_REQUEST, "Tên nghệ sĩ này đã tồn tại");

    // 2. Tiền xử lý File & Theme Color
    const avatar = files?.["avatar"]?.[0]?.path || "";
    const coverImage = files?.["coverImage"]?.[0]?.path || "";
    const galleryImages = files?.["images"]?.map((f) => f.path) || [];

    let themeColor = data.themeColor || "#1db954"; // Màu mặc định nếu không có avatar hoặc không extract được
    if (!data.themeColor && avatar) {
      try {
        themeColor = await themeColorService.extractThemeColor(avatar);
      } catch (err) {
        console.error("[ArtistService] Color extraction failed:", err);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let userId = null;

      // 3. Liên kết User (nếu có)
      if (data.userId && mongoose.Types.ObjectId.isValid(data.userId)) {
        const user = await User.findOneAndUpdate(
          {
            _id: data.userId,
            role: { $ne: "artist" },
            artistProfile: { $exists: false },
          },
          { role: "artist" },
          { session, new: true },
        );

        if (!user)
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "User không khả dụng hoặc đã là Artist",
          );
        userId = data.userId;
      }

      // 4. Tạo Artist Profile
      const [artist] = await Artist.create(
        [
          {
            ...data,
            user: userId,
            avatar,
            coverImage,
            themeColor,
            images: galleryImages,
            aliases: parseTags(data.aliases),
            socialLinks: {
              facebook: data.facebook || "",
              instagram: data.instagram || "",
              twitter: data.twitter || "",
              website: data.website || "",
              spotify: data.spotify || "",
              youtube: data.youtube || "",
            },
            totalTracks: 0,
            totalAlbums: 0,
            totalFollowers: 0,
            playCount: 0,
            monthlyListeners: 0,
          },
        ],
        { session },
      );

      // 5. Gắn ngược ID vào User
      if (userId) {
        await User.updateOne(
          { _id: userId },
          { artistProfile: artist._id },
          { session },
        );
      }

      await session.commitTransaction();

      // 6. Hậu kỳ (Async)
      Promise.allSettled([invalidateArtistCache(artist._id.toString())]).catch(
        console.error,
      );

      return artist;
    } catch (error) {
      await session.abortTransaction();
      const allFiles = [avatar, coverImage, ...galleryImages].filter(Boolean);
      if (allFiles.length > 0) {
        Promise.allSettled(
          allFiles.map((path) => deleteFileFromCloud(path, "image")),
        );
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 5. UPDATE ARTIST (ADMIN) ───────────────────────────────────────────────

  async updateArtistByAdmin(
    id: string,
    data: UpdateArtistInput,
    files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    const artist = await Artist.findById(id);
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    // 1. Tiền xử lý màu sắc (Ngoài transaction để tối ưu performance)
    let newThemeColor = data.themeColor || artist.themeColor || "#1db954";
    if (files?.["avatar"]?.[0] && !data.themeColor) {
      try {
        newThemeColor = await themeColorService.extractThemeColor(
          files["avatar"][0].path,
        );
      } catch (err) {
        console.error("[ArtistService] Theme color extraction failed", err);
      }
    }
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── A. User swap ─────────────────────────────────────────────────────
      if (data.userId !== undefined) {
        const targetUserId = data.userId ? String(data.userId) : null;
        const oldUserId = artist.user ? String(artist.user) : null;

        if (targetUserId !== oldUserId) {
          if (oldUserId) {
            await User.updateOne(
              { _id: oldUserId },
              { role: "user", $unset: { artistProfile: 1 } },
              { session },
            );
          }
          if (targetUserId) {
            const newUser = await User.findOneAndUpdate(
              { _id: targetUserId, artistProfile: { $exists: false } },
              { role: "artist", artistProfile: artist._id },
              { session, new: true },
            );
            if (!newUser)
              throw new ApiError(
                httpStatus.BAD_REQUEST,
                "User mới không hợp lệ",
              );
            artist.user = new mongoose.Types.ObjectId(targetUserId) as any;
          } else {
            artist.user = null as any;
          }
        }
      }

      // ── C. Images ─────────────────────────────────────────────────────────

      // 3. Quản lý hình ảnh & Cleanup list
      const imagesToDelete: string[] = [];
      if (files?.["avatar"]?.[0]) {
        if (artist.avatar) imagesToDelete.push(artist.avatar);
        artist.avatar = files["avatar"][0].path;
      }

      if (files?.["coverImage"]?.[0]) {
        if (artist.coverImage) imagesToDelete.push(artist.coverImage);
        artist.coverImage = files["coverImage"][0].path;
      }

      const keptImages = data.keptImages
        ? parseTags(data.keptImages)
        : artist.images;
      const deletedImages = artist.images.filter(
        (img) => !keptImages.includes(img),
      );
      imagesToDelete.push(...deletedImages);

      const newUploads = files?.["images"]?.map((f) => f.path) || [];
      artist.images = [...keptImages, ...newUploads];

      // ── D. Metadata ───────────────────────────────────────────────────────
      if (data.name && data.name !== artist.name) {
        // Slug generation trong session (pre("save") cũng regenerate — để model tự xử lý)
        artist.name = data.name;
      }

      if (data.bio !== undefined) artist.bio = data.bio;
      if (data.nationality !== undefined) artist.nationality = data.nationality;
      if (data.isVerified !== undefined) artist.isVerified = data.isVerified;
      if (data.aliases !== undefined) artist.aliases = parseTags(data.aliases);
      if (newThemeColor) artist.themeColor = newThemeColor;

      // Social links — explicit field-by-field để chống mass assignment
      if (data.facebook !== undefined)
        artist.socialLinks.facebook = data.facebook;
      if (data.instagram !== undefined)
        artist.socialLinks.instagram = data.instagram;
      if (data.twitter !== undefined) artist.socialLinks.twitter = data.twitter;
      if (data.website !== undefined) artist.socialLinks.website = data.website;
      if (data.spotify !== undefined) artist.socialLinks.spotify = data.spotify;
      if (data.youtube !== undefined) artist.socialLinks.youtube = data.youtube;

      await artist.save({ session }); // pre("save") chạy tại đây: slug + themeColor nếu cần
      await session.commitTransaction();

      // 5. Hậu kỳ (Async)
      Promise.allSettled([
        syncArtistStats(id),
        invalidateArtistCache(id),
        imagesToDelete.length > 0 &&
          Promise.allSettled(
            imagesToDelete.map((img) => deleteFileFromCloud(img, "image")),
          ),
      ]).catch(console.error);

      return artist;
    } catch (error) {
      await session.abortTransaction();

      // Xóa file MỚI vừa upload nếu transaction fail
      const newFiles: string[] = [];
      if (files?.["avatar"]?.[0]) newFiles.push(files["avatar"][0].path);
      if (files?.["coverImage"]?.[0])
        newFiles.push(files["coverImage"][0].path);
      if (files?.["images"])
        newFiles.push(...files["images"].map((f) => f.path));

      if (newFiles.length > 0) {
        Promise.allSettled(
          newFiles.map((img) => deleteFileFromCloud(img, "image")),
        ).catch(console.error);
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }

  // ── 6. TOGGLE STATUS (truly atomic) ───────────────────────────────────────

  async toggleStatus(id: string) {
    // 1. Kiểm tra tồn tại trước (Giữ nguyên logic của bạn)
    const artist = await Artist.findById(id).select("_id").lean();
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    // 2. Fix lỗi: Thêm option { overwrite: false } hoặc đơn giản là dùng cú pháp chuẩn
    const updated = await Artist.findByIdAndUpdate(
      id,
      [
        {
          $set: { isActive: { $not: "$isActive" } },
        },
      ],
      { new: true }, // Mặc định khi truyền Array, Mongoose sẽ coi là pipeline
    )
      .select("_id isActive")
      .lean();

    // Invalidate cache
    invalidateArtistCache(id).catch(console.error);

    return { id: updated!._id, isActive: updated!.isActive };
  }

  // ── 7. DELETE ARTIST ───────────────────────────────────────────────────────

  async deleteArtist(id: string) {
    const artist = await Artist.findById(id);
    if (!artist || artist.isDeleted) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Không tìm thấy nghệ sĩ hoặc đã bị xóa",
      );
    }

    // 1. Kiểm tra an toàn (Vẫn giữ nguyên vì không nên xóa Artist có dữ liệu liên quan)
    const [hasAlbums, hasTracks] = await Promise.all([
      Album.exists({ artist: id, isDeleted: false }),
      Track.exists({ artist: id, isDeleted: false }),
    ]);

    if (hasAlbums || hasTracks) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không thể xóa Nghệ sĩ đang sở hữu Album hoặc Bài hát đang hoạt động",
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Thực hiện Xóa mềm với Transaction
      await Promise.all([
        // A. Đánh dấu Artist là đã xóa
        Artist.updateOne(
          { _id: id },
          {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
          },
          { session },
        ),

        // B. Gỡ quyền User (Về mặt logic, tài khoản này không còn là Artist nữa)
        artist.user
          ? User.updateOne(
              { _id: artist.user },
              { role: "user", $unset: { artistProfile: 1 } },
              { session },
            )
          : Promise.resolve(),

        // C. Xử lý Follow (Tùy chọn: Có thể giữ lại nếu muốn bảo toàn stats cũ)
        // Follow.deleteMany({ following: id }, { session }),
      ]);

      await session.commitTransaction();

      // 3. Post-commit: Cache (KHÔNG xóa file ảnh trên Cloud khi xóa mềm)
      Promise.allSettled([
        invalidateArtistCache(id),
        // Cập nhật lại các cache danh sách nghệ sĩ phổ biến
        cacheRedis.del("artists:popular"),
      ]).catch(console.error);

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 8. SELF UPDATE ─────────────────────────────────────────────────────────

  async updateMyProfile(userId: string, data: any, files: any) {
    const artist = await Artist.findOne({ user: userId });

    if (!artist)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn chưa có hồ sơ Nghệ sĩ để chỉnh sửa",
      );

    // Strip fields Artist không được tự sửa
    const {
      userId: _u,
      isVerified: _v,
      name: _n,
      slug: _s,
      playCount: _tp,
      totalFollowers: _tf,
      monthlyListeners: _ml,
      ...safeData
    } = data;

    return this.updateArtistByAdmin(artist._id.toString(), safeData, files);
  }
}

export default new ArtistService();
