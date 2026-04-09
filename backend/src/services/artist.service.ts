import mongoose, { Types } from "mongoose";
import Artist from "../models/Artist";
import User, { IUser } from "../models/User";
import Album from "../models/Album";
import Track from "../models/Track";
import Follow from "../models/Follow"; // Import bảng Follow
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateSafeSlug, generateUniqueSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseGenreIds, parseTags } from "../utils/helper";
import {
  CreateArtistInput,
  UpdateArtistInput,
  ArtistFilterInput,
} from "../validations/artist.validation";
import Genre from "../models/Genre";
import { cacheRedis } from "../config/redis";
import { buildCacheKey, withCacheTimeout } from "../utils/cacheHelper";
import escapeStringRegexp from "escape-string-regexp";

class ArtistService {
  // ==========================================
  // 🟢 PUBLIC METHODS
  // ==========================================

  /**
   * 1. GET DETAIL (Tối ưu Performance & Aggregation)
   */
  /**
   * 1. GET DETAIL (Virtual Scroll Optimized)
   */
  async getArtistDetail(slugOrId: string, currentUserId?: string) {
    const isId = mongoose.isValidObjectId(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    // 1. Fetch thông tin Artist cơ bản
    const artist = await Artist.findOne({ ...query, isActive: true })
      .populate("genres", "name slug color")
      .lean();

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

    return {
      artist: {
        ...artist,
        trackIds: allTrackIds.map((t) => t._id),
      },
      albums,
    };
  }
  /**
   * 2. GET ARTIST TRACKS (Infinite Loading cho Virtual Scroll)
   */
  async getArtistTracks(
    artistId: string,
    filter: any, // { page, limit }
    userRole?: string,
  ) {
    const { page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;
    const isAdmin = userRole === "admin";

    // 1. Cache Key
    const cacheKey = buildCacheKey(
      `artist:tracks:${artistId}`,
      userRole || "guest",
      { page, limit },
    );
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Truy vấn Database
    const trackQuery: Record<string, any> = {
      artist: artistId,
      status: "ready",
    };

    if (!isAdmin) {
      trackQuery.isPublic = true;
    }

    const [tracks, total] = await Promise.all([
      Track.find(trackQuery)
        .sort({ playCount: -1, createdAt: -1 }) // Thứ tự phổ biến giảm dần
        .skip(skip)
        .limit(Number(limit))
        .populate("album", "title slug coverImage")
        .select(
          "title slug duration playCount coverImage hlsUrl isPublic bitrate isExplicit trackNumber",
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

    // 3. Set Cache (TTL 15-20 phút)
    const ttl = 900 + Math.floor(Math.random() * 120);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Set Album Tracks Error:", err));

    return result;
  }
  /**
   * 2. GET LIST (Advanced Search & Filter)
   */
  async getArtists(queryInput: ArtistFilterInput, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const isAdmin = userRole === "admin";

    // 1. CHUẨN HÓA FILTER & CACHE KEY
    // Loại bỏ các trường rỗng/undefined để Cache Key luôn ổn định
    const cleanFilter = Object.fromEntries(
      Object.entries(queryInput).filter(
        ([_, v]) => v !== undefined && v !== "",
      ),
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

    // --- 2. SECURITY LAYER ---
    // Guest/User chỉ thấy Artist đang hoạt động. Admin thấy theo filter.
    if (!isAdmin) {
      filterQuery.isActive = true;
    } else if (isActive !== undefined) {
      filterQuery.isActive = isActive;
    }

    // --- 3. SEARCH LOGIC (Chống ReDoS & Tối ưu Index) ---
    if (keyword) {
      const safeKeyword = escapeStringRegexp(keyword.substring(0, 100));
      // Prefix match (^) để tận dụng Index hiệu quả hơn thay vì tìm kiếm chứa chuỗi (contains)
      filterQuery.$or = [
        { name: { $regex: `^${safeKeyword}`, $options: "i" } },
        { aliases: { $in: [new RegExp(`^${safeKeyword}`, "i")] } },
      ];
    }

    if (genreId) filterQuery.genres = genreId;
    if (nationality) filterQuery.nationality = nationality;
    if (isVerified !== undefined) filterQuery.isVerified = isVerified;

    // --- 4. SORT MAP ---
    const SORT_MAP: Record<string, any> = {
      popular: { totalPlays: -1, totalFollowers: -1, _id: 1 },
      monthlyListeners: { monthlyListeners: -1, _id: 1 },
      newest: { createdAt: -1, _id: 1 },
      name: { name: 1, _id: 1 },
    };

    const sortOption = SORT_MAP[sort ?? "popular"] ?? SORT_MAP.popular;

    // --- 5. EXECUTION ---
    const [artists, total] = await Promise.all([
      Artist.find(filterQuery)
        .populate("genres", "name color slug")
        .select(
          "name avatar coverImage slug isVerified nationality genres themeColor totalFollowers monthlyListeners isActive",
        )
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
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

    // --- 6. CACHE SET (Jitter logic) ---
    // TTL 15-20 phút (Artist ít thay đổi hơn Track)
    const ttl = 900 + Math.floor(Math.random() * 300);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), { ex: ttl } as any),
    ).catch((err) => console.error("[Cache] Artist SET error:", err));

    return result;
  }
  // ==========================================
  // 🔴 ADMIN / WRITE METHODS
  // ==========================================

  /**
   * CREATE ARTIST (ADMIN)
   */
  async createArtistByAdmin(
    data: CreateArtistInput,
    files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    // 1. Kiểm tra tồn tại với Lean() cho nhanh
    const existingArtist = await Artist.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, "i") },
    }).lean();

    if (existingArtist) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Tên nghệ sĩ này đã tồn tại");
    }

    // 2. Thu thập đường dẫn file
    const avatar = files?.["avatar"]?.[0]?.path || "";
    const coverImage = files?.["coverImage"]?.[0]?.path || "";
    const galleryImages = files?.["images"]?.map((f) => f.path) || [];

    const genres = parseGenreIds(data.genreIds);
    const aliases = parseTags(data.aliases);

    // 3. Khởi tạo Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let userId = null;
      if (data.userId) {
        // 🔥 NÂNG CẤP: Dùng findOneAndUpdate với điều kiện để chống Race Condition ngay từ lúc kiểm tra User
        const user = await User.findOneAndUpdate(
          { _id: data.userId, role: { $ne: "artist" } }, // Chỉ lấy nếu user chưa là artist
          { role: "artist" }, // Tạm set role để lock user lại trong transaction này
          { session, new: true },
        );

        if (!user) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "User không tồn tại hoặc đã liên kết với một Artist khác",
          );
        }
        userId = data.userId;
      }

      // Generate slug TRONG transaction để đảm bảo an toàn
      const slug = await generateUniqueSlug(Artist, data.name);

      // 4. Tạo Artist
      const [artist] = await Artist.create(
        [
          {
            ...data,
            slug,
            user: userId,
            avatar,
            coverImage,
            images: galleryImages,
            genres,
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

      // 5. Cập nhật lại chính xác _id của artist cho User
      if (userId) {
        await User.updateOne(
          { _id: userId },
          { artistProfile: artist._id },
          { session },
        );
      }

      // 6. Cập nhật số lượng cho Genre
      if (genres.length > 0) {
        await Genre.updateMany(
          { _id: { $in: genres } },
          { $inc: { artistCount: 1 } },
          { session },
        );
      }

      await session.commitTransaction();
      return artist;
    } catch (error) {
      await session.abortTransaction();

      // 🔥 NÂNG CẤP: Chờ xóa xong file rác mới văng lỗi, dùng Promise.allSettled
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

  /**
   * UPDATE ARTIST (ADMIN)
   */
  async updateArtistByAdmin(
    id: string,
    data: UpdateArtistInput,
    files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    // 1. Kiểm tra Artist trước, không cần session ở bước này để tối ưu tốc độ
    const artist = await Artist.findById(id);
    if (!artist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // --- A. USER SWAP LOGIC (Bảo vệ bằng Transaction) ---
      if (
        data.userId !== undefined &&
        String(data.userId) !== String(artist.user)
      ) {
        // 1. Gỡ User cũ: Update trực tiếp qua DB thay vì update obj artist
        if (artist.user) {
          await User.updateOne(
            { _id: artist.user },
            { role: "user", $unset: { artistProfile: 1 } },
            { session },
          );
        }

        // 2. Gán User mới
        if (data.userId) {
          // Khóa User mới để chống đè
          const newUser = await User.findOneAndUpdate(
            { _id: data.userId, artistProfile: { $exists: false } },
            { role: "artist", artistProfile: artist._id },
            { session, new: true },
          );

          if (!newUser) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "User mới không tồn tại hoặc đã là Artist",
            );
          }
          artist.user = data.userId as any;
        } else {
          artist.user = null as any;
        }
      }

      // --- B. XỬ LÝ GENRES (Bảo vệ bằng Transaction) ---
      if (data.genreIds) {
        const newGenreIds = parseGenreIds(data.genreIds);
        const oldIds = artist.genres.map((id) => id.toString());
        const newIds = newGenreIds.map((id) => id.toString());

        const added = newIds.filter((id) => !oldIds.includes(id));
        const removed = oldIds.filter((id) => !newIds.includes(id));

        if (added.length || removed.length) {
          await Promise.all([
            added.length &&
              Genre.updateMany(
                { _id: { $in: added } },
                { $inc: { artistCount: 1 } },
                { session },
              ),
            removed.length &&
              Genre.updateMany(
                { _id: { $in: removed }, artistCount: { $gt: 0 } },
                { $inc: { artistCount: -1 } },
                { session },
              ),
          ]);
        }
        artist.genres = newGenreIds;
      }

      // --- C. XỬ LÝ HÌNH ẢNH (Ghi nhận mảng cần xóa) ---
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

      if (deletedImages.length > 0) {
        imagesToDelete.push(...deletedImages);
      }

      const newUploads = files?.["images"]?.map((f) => f.path) || [];
      artist.images = [...keptImages, ...newUploads];

      // --- D. UPDATE FIELDS CÒN LẠI ---
      if (data.name && data.name !== artist.name) {
        // Sinh slug trước khi save
        artist.slug = await generateUniqueSlug(Artist, data.name);
        artist.name = data.name;
      }

      // Gán các thông tin cơ bản
      if (data.bio !== undefined) artist.bio = data.bio;
      if (data.nationality !== undefined) artist.nationality = data.nationality;
      if (data.themeColor !== undefined) artist.themeColor = data.themeColor;
      if (data.isVerified !== undefined) artist.isVerified = data.isVerified;
      if (data.aliases !== undefined) artist.aliases = parseTags(data.aliases);

      // 🔥 NÂNG CẤP: Chống Mass Assignment cho Social Links
      if (data.facebook !== undefined)
        artist.socialLinks.facebook = data.facebook;
      if (data.instagram !== undefined)
        artist.socialLinks.instagram = data.instagram;
      if (data.twitter !== undefined) artist.socialLinks.twitter = data.twitter;
      if (data.website !== undefined) artist.socialLinks.website = data.website;
      if (data.spotify !== undefined) artist.socialLinks.spotify = data.spotify;
      if (data.youtube !== undefined) artist.socialLinks.youtube = data.youtube;

      // Lưu artist (Trong Transaction)
      await artist.save({ session });

      await session.commitTransaction();

      // --- E. DỌN DẸP CLOUDINARY SAU KHI THÀNH CÔNG ---
      // Chỉ khi DB commit thành công 100%, ta mới bắt đầu xóa ảnh cũ trên Cloudinary
      // Tránh việc xóa ảnh xong DB lưu lỗi -> Mất sạch ảnh cũ.
      if (imagesToDelete.length > 0) {
        // Chạy ngầm không cần await để tăng tốc response API
        Promise.allSettled(
          imagesToDelete.map((img) => deleteFileFromCloud(img, "image")),
        ).catch(console.error);
      }

      return artist;
    } catch (error) {
      await session.abortTransaction();

      // Nếu lỗi, xóa ngay những ảnh MỚI vừa được multer upload lên Cloudinary trong request này
      const newUploadedFiles = [];
      if (files?.["avatar"]?.[0])
        newUploadedFiles.push(files["avatar"][0].path);
      if (files?.["coverImage"]?.[0])
        newUploadedFiles.push(files["coverImage"][0].path);
      if (files?.["images"])
        newUploadedFiles.push(...files["images"].map((f) => f.path));

      if (newUploadedFiles.length > 0) {
        Promise.allSettled(
          newUploadedFiles.map((img) => deleteFileFromCloud(img, "image")),
        ).catch(console.error);
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }
  // ==========================================
  // 🔴 ADMIN & USER METHODS
  // ==========================================

  /**
   * 5. TOGGLE STATUS (Tối ưu Atomic Update)
   */
  async toggleStatus(id: string) {
    // 🔥 NÂNG CẤP: Dùng FindOneAndUpdate để thao tác nguyên tử (Atomic),
    // ngăn ngừa lỗi nhiều Admin bấm cùng lúc.
    const artist = await Artist.findById(id);
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    artist.isActive = !artist.isActive;
    await artist.save();

    return { id: artist._id, isActive: artist.isActive };
  }

  /**
   * 6. DELETE ARTIST (Bọc Transaction & Xử lý File chuẩn)
   */
  async deleteArtist(id: string) {
    const artist = await Artist.findById(id);
    if (!artist)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy nghệ sĩ");

    // 1. Check Ràng buộc cực ngặt
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

    // 🔥 NÂNG CẤP: Sử dụng Transaction để xóa liên kết an toàn
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Gỡ liên kết User
      if (artist.user) {
        await User.updateOne(
          { _id: artist.user },
          { role: "user", $unset: { artistProfile: 1 } },
          { session },
        );
      }

      // 3. Xóa tất cả các lượt Follow liên quan
      await Follow.deleteMany({ following: id }, { session });

      // 4. Trừ đi đếm số lượng của Genre
      if (artist.genres && artist.genres.length > 0) {
        await Genre.updateMany(
          { _id: { $in: artist.genres }, artistCount: { $gt: 0 } },
          { $inc: { artistCount: -1 } },
          { session },
        );
      }

      // 5. Xóa Nghệ Sĩ
      await Artist.deleteOne({ _id: id }).session(session);

      await session.commitTransaction();

      // 6. XÓA FILE TRÊN MÂY SAU KHI DB ĐÃ XÓA THÀNH CÔNG (Tránh mất file nếu Rollback)
      const filesToDelete = [
        artist.avatar,
        artist.coverImage,
        ...(artist.images || []),
      ].filter(Boolean);

      if (filesToDelete.length > 0) {
        // Chạy ngầm, không await để tăng tốc API response
        Promise.allSettled(
          filesToDelete.map((img) => deleteFileFromCloud(img, "image")),
        ).catch(console.error);
      }

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 7. SELF UPDATE (Cho Artist tự sửa profile)
   */
  async updateMyProfile(userId: string, data: any, files: any) {
    const artist = await Artist.findOne({ user: userId });

    if (!artist) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn chưa có hồ sơ Nghệ sĩ để chỉnh sửa",
      );
    }

    // 🔥 SECURITY CHECK: Xóa triệt để các trường nhạy cảm
    // Dùng destructuring để tạo object an toàn, loại bỏ nguy cơ ghi đè
    const {
      userId: _u,
      isVerified: _v,
      name: _n,
      slug: _s,
      totalPlays: _tp,
      totalFollowers: _tf,
      monthlyListeners: _ml,
      ...safeData
    } = data;

    // Tái sử dụng hàm Update Admin với dữ liệu đã thanh lọc
    return this.updateArtistByAdmin(artist._id.toString(), safeData, files);
  }
}

export default new ArtistService();
