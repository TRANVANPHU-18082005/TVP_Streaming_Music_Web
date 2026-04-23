// services/artist.service.ts

import mongoose, { Types } from "mongoose";
import Artist, { IArtist } from "../models/Artist";
import User, { IUser } from "../models/User";
import Album from "../models/Album";
import Track from "../models/Track";
import Follow from "../models/Follow";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateUniqueSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseGenreIds, parseTags } from "../utils/helper";
import {
  CreateArtistInput,
  UpdateArtistInput,
  ArtistFilterInput,
} from "../validations/artist.validation";
import Genre from "../models/Genre";
import { cacheRedis } from "../config/redis";
import {
  buildCacheKey,
  withCacheTimeout,
  invalidateArtistCache,
} from "../utils/cacheHelper";
import escapeStringRegexp from "escape-string-regexp";

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
  // ── 1. GET DETAIL ──────────────────────────────────────────────────────────

  /**
   * NÂNG CẤP C: Dùng Virtual populate cho albums + topTracks.
   * Model đã cấu hình sort/limit trong virtual options — không cần query thủ công.
   *
   * trackIds vẫn query riêng vì virtual topTracks chỉ lấy 5.
   * Virtual scroll cần toàn bộ IDs để FE paginate.
   */
  async getArtistDetail(
    slugOrId: string,
    currentUserId?: string,
    userRole: string = "guest",
  ) {
    // 1. Build Cache Key
    const cacheKey = buildCacheKey(`artist:detail:${slugOrId}`, userRole, {});

    // 2. Thử lấy từ cache
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    // 3. Query Database
    const isId = mongoose.isValidObjectId(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };
    // 1. Fetch thông tin Artist cơ bản
    const artist = await Artist.findOne({ ...query, isActive: true }).lean();

    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Nghệ sĩ không tồn tại");

    const artistId = artist._id;

    // 2. 🔥 QUERY PARALLEL: Lấy các thông tin "vỏ"
    const [albums, allTrackIds] = await Promise.all([
      // B. Get Albums (Discography) - Lấy 10 album mới nhất
      Album.find({ artist: artistId, isPublic: true })
        .sort({ releaseYear: -1, createdAt: -1 })
        .limit(10)
        .select("title coverImage releaseYear slug type")
        .lean(),

      // C. Lấy mảng ID của TOÀN BỘ bài hát (Để làm Virtual Scroll)
      // Sắp xếp theo playCount để lấy danh sách "Top Tracks" đầy đủ
      Track.find({ artist: artistId, status: "ready", isPublic: true })
        .sort({ playCount: -1 })
        .select("_id")
        .lean(),
    ]);

    const result = {
      artist: {
        ...artist,
        trackIds: allTrackIds.map((t) => t._id),
      },
      albums,
    };

    // 4. Lưu Cache (TTL 1 giờ)
    await withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", 3600),
    );

    return result;
  }

  // ── 2. GET ARTIST TRACKS ───────────────────────────────────────────────────

  async getArtistTracks(artistId: string, filter: any, userRole?: string) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;
    const isAdmin = userRole === "admin";

    const cacheKey = buildCacheKey(
      `artist:tracks:${artistId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const trackQuery: Record<string, any> = {
      artist: artistId,
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
    ).catch((err) => console.error("[Cache] Artist Tracks SET error:", err));

    return result;
  }

  // ── 3. GET ARTISTS LIST ────────────────────────────────────────────────────

  async getArtists(queryInput: ArtistFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";

    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(([, v]) => v !== undefined && v !== ""),
    );
    const cacheKey = buildCacheKey("artist:list", userRole, cleanFilter);

    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) return JSON.parse(cached as string);

    const {
      page = 1,
      limit = 12,
      keyword,
      genreId,
      nationality,
      isVerified,
      sort,
      isActive,
    } = queryInput;

    const skip = (page - 1) * limit;
    const filterQuery: Record<string, any> = {};

    if (!isAdmin) {
      filterQuery.isActive = true;
    } else if (isActive !== undefined) {
      filterQuery.isActive = isActive;
    }

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

    if (genreId) filterQuery.genres = genreId;
    if (nationality) filterQuery.nationality = nationality;
    if (isVerified !== undefined) filterQuery.isVerified = isVerified;

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
      .select(
        "name avatar coverImage slug isVerified nationality genres themeColor " +
          "totalFollowers monthlyListeners isActive",
      )
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
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: page * limit < total,
      },
    };

    const ttl = 900 + Math.floor(Math.random() * 300);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Artist LIST SET error:", err));

    return result;
  }

  // ── 4. CREATE ARTIST (ADMIN) ───────────────────────────────────────────────

  async createArtistByAdmin(
    data: CreateArtistInput,
    files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    const existingArtist = await Artist.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, "i") },
    }).lean();

    if (existingArtist)
      throw new ApiError(httpStatus.BAD_REQUEST, "Tên nghệ sĩ này đã tồn tại");

    const avatar = files?.["avatar"]?.[0]?.path || "";
    const coverImage = files?.["coverImage"]?.[0]?.path || "";
    const galleryImages = files?.["images"]?.map((f) => f.path) || [];
    const aliases = parseTags(data.aliases);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let userId = null;
      if (data.userId) {
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
            "User không tồn tại hoặc đã liên kết với một Artist khác",
          );

        userId = data.userId;
      }

      const [artist] = await Artist.create(
        [
          {
            ...data,
            user: userId,
            avatar,
            coverImage,
            images: galleryImages,
            aliases,
            socialLinks: {
              facebook: data.facebook || "",
              instagram: data.instagram || "",
              twitter: data.twitter || "",
              website: data.website || "",
              spotify: data.spotify || "",
              youtube: data.youtube || "",
            },
          },
        ],
        { session },
      );

      if (userId) {
        await User.updateOne(
          { _id: userId },
          { artistProfile: artist._id },
          { session },
        );
      }

      await session.commitTransaction();

      // NÂNG CẤP A: Sync stats + invalidate cache — fire-and-forget
      Promise.allSettled([
        syncArtistStats(artist._id.toString()),
        invalidateArtistCache(artist._id.toString()),
      ]).catch(console.error);

      return artist;
    } catch (error) {
      await session.abortTransaction();

      const allFiles = [avatar, coverImage, ...galleryImages].filter(Boolean);
      if (allFiles.length > 0) {
        await Promise.allSettled(
          allFiles.map((path) => deleteFileFromCloud(path, "image")),
        );
      }
      throw error;
    } finally {
      await session.endSession();
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── A. User swap ─────────────────────────────────────────────────────
      if (
        data.userId !== undefined &&
        String(data.userId) !== String(artist.user)
      ) {
        if (artist.user) {
          await User.updateOne(
            { _id: artist.user },
            { role: "user", $unset: { artistProfile: 1 } },
            { session },
          );
        }

        // ── A. User Swap Logic ─────────────────────────────────────────────────────
        if (data.userId !== undefined) {
          const targetUserId = data.userId ? String(data.userId) : null;
          const oldUserId = artist.user ? String(artist.user) : null;

          if (targetUserId !== oldUserId) {
            // 1. Gỡ quyền user cũ (nếu có)
            if (oldUserId) {
              await User.updateOne(
                { _id: oldUserId },
                { role: "user", $unset: { artistProfile: 1 } },
                { session },
              );
            }

            // 2. Gán quyền cho user mới (nếu có)
            if (targetUserId) {
              const newUser = await User.findOneAndUpdate(
                { _id: targetUserId, artistProfile: { $exists: false } },
                { role: "artist", artistProfile: artist._id },
                { session, new: true },
              );
              if (!newUser)
                throw new ApiError(
                  httpStatus.BAD_REQUEST,
                  "User mới không hợp lệ hoặc đã là Artist",
                );

              artist.user = new mongoose.Types.ObjectId(targetUserId) as any;
            } else {
              artist.user = null as any;
            }
          }
        }
      }

      // ── C. Images ─────────────────────────────────────────────────────────
      const imagesToDelete: string[] = [];

      if (files?.["avatar"]?.[0]) {
        if (artist.avatar) imagesToDelete.push(artist.avatar);
        artist.avatar = files["avatar"][0].path;
        // NÂNG CẤP B: avatar thay đổi → pre("save") sẽ tự extract themeColor.
        // KHÔNG gán themeColor ở đây trừ khi Admin gửi override tường minh.
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
      if (deletedImages.length > 0) imagesToDelete.push(...deletedImages);

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

      // NÂNG CẤP B: chỉ override themeColor nếu Admin gửi tường minh.
      // Khi avatar thay đổi mà không có themeColor override → middleware tự extract.
      if (data.themeColor !== undefined) {
        artist.themeColor = data.themeColor;
      }

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

      // NÂNG CẤP A + BONUS: Sau commit
      Promise.allSettled([
        syncArtistStats(id),
        invalidateArtistCache(id),
        imagesToDelete.length > 0
          ? Promise.allSettled(
              imagesToDelete.map((img) => deleteFileFromCloud(img, "image")),
            )
          : Promise.resolve(),
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

  /**
   * BONUS: Comment cũ nói "Atomic" nhưng dùng findById + save không atomic.
   * Fix thực sự atomic bằng findOneAndUpdate với conditional flip.
   */
  async toggleStatus(id: string) {
    // Dùng conditional update: đọc trạng thái hiện tại, flip nó
    const artist = await Artist.findById(id).select("isActive").lean();
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    const updated = await Artist.findByIdAndUpdate(
      id,
      [{ $set: { isActive: { $not: "$isActive" } } }], // MongoDB aggregation pipeline update
      { new: true, select: "_id isActive" },
    ).lean();

    // Invalidate cache vì isActive thay đổi ảnh hưởng visibility
    invalidateArtistCache(id).catch(console.error);

    return { id: updated!._id, isActive: updated!.isActive };
  }

  // ── 7. DELETE ARTIST ───────────────────────────────────────────────────────

  /**
   * BONUS: Cache invalidation sau khi xóa thành công.
   */
  async deleteArtist(id: string) {
    const artist = await Artist.findById(id);
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    // 1. Kiểm tra an toàn
    const [hasAlbums, hasTracks] = await Promise.all([
      Album.exists({ artist: id }),
      Track.exists({ artist: id }),
    ]);

    if (hasAlbums || hasTracks) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không thể xóa Nghệ sĩ đang sở hữu Album hoặc Bài hát",
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Thực hiện xóa với Transaction
      await Promise.all([
        Follow.deleteMany({ following: id }, { session }),
        Artist.deleteOne({ _id: id }).session(session),
        artist.user
          ? User.updateOne(
              { _id: artist.user },
              { role: "user", $unset: { artistProfile: 1 } },
              { session },
            )
          : Promise.resolve(),
      ]);

      await session.commitTransaction();

      // 3. Post-commit: Cleanup + Cache (Fire-and-forget)
      const filesToDelete = [
        artist.avatar,
        artist.coverImage,
        ...(artist.images || []),
      ].filter(Boolean) as string[];

      Promise.allSettled([
        ...filesToDelete.map((img) => deleteFileFromCloud(img, "image")),
        invalidateArtistCache(id),
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
