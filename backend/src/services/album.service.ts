import mongoose, { Types } from "mongoose";
import Album from "../models/Album";
import Track from "../models/Track";
import Artist from "../models/Artist";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateSafeSlug, generateUniqueSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  AlbumFilterInput,
  CreateAlbumInput,
  UpdateAlbumInput,
} from "../validations/album.validation";
import { parseGenreIds, parseTags } from "../utils/helper";
import Genre from "../models/Genre";
import { console } from "inspector";

class AlbumService {
  /**
   * ==========================================
   * 1. CREATE ALBUM (Chuẩn Transaction)
   * ==========================================
   */
  async createAlbum(
    currentUser: IUser,
    data: CreateAlbumInput,
    file?: Express.Multer.File,
  ) {
    let targetArtistId: string;

    // 1. Phân quyền và xác định Artist
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
    const genreIds = parseGenreIds(data.genreIds);
    const tagsArray = parseTags(data.tags);
    const slug = await generateUniqueSlug(Album, data.title);
    const coverPath = file ? file.path : "";

    // 🔥 BẮT ĐẦU TRANSACTION
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 3. Tạo Album (Truyền session vào)
      // Lưu ý: create với mảng [data] khi dùng session
      const [album] = await Album.create(
        [
          {
            ...data,
            slug,
            artist: targetArtistId,
            type: data.type || "album",
            genres: genreIds,
            tags: tagsArray,
            releaseDate: data.releaseDate
              ? new Date(data.releaseDate)
              : new Date(),
            coverImage: coverPath,
            isPublic: String(data.isPublic) === "true",
            totalTracks: 0,
            totalDuration: 0,
            playCount: 0,
            likeCount: 0,
          },
        ],
        { session },
      );

      // 4. Update Counter cho Artist
      await Artist.findByIdAndUpdate(
        targetArtistId,
        { $inc: { totalAlbums: 1 } },
        { session },
      );

      // 5. Update Counter cho Genres
      if (genreIds.length > 0) {
        await Genre.updateMany(
          { _id: { $in: genreIds } },
          { $inc: { albumCount: 1 } },
          { session },
        );
      }

      // 🔥 NẾU TẤT CẢ OK -> COMMIT LƯU VÀO DB
      await session.commitTransaction();
      return album;
    } catch (error) {
      // 🚨 NẾU CÓ LỖI -> ROLLBACK DB (Không có gì được lưu)
      await session.abortTransaction();

      // Xóa file rác vừa up lên Cloudinary (nếu có)
      if (coverPath) {
        deleteFileFromCloud(coverPath, "image").catch((err) =>
          console.error("Lỗi dọn rác Cloudinary khi Create Album failed:", err),
        );
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 2. UPDATE ALBUM
   */
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

    // A. Logic Đổi Artist (Admin Only)
    if (data.artist && data.artist !== album.artist.toString()) {
      if (currentUser.role !== "admin")
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Chỉ Admin mới được đổi Artist",
        );

      const newArtistExists = await Artist.exists({ _id: data.artist });
      if (!newArtistExists)
        throw new ApiError(httpStatus.BAD_REQUEST, "Artist mới không tồn tại");

      await Artist.findByIdAndUpdate(album.artist, {
        $inc: { totalAlbums: -1 },
      });
      await Artist.findByIdAndUpdate(data.artist, { $inc: { totalAlbums: 1 } });

      album.artist = new mongoose.Types.ObjectId(data.artist);
    }

    // B. Update Metadata
    if (data.title && data.title !== album.title) {
      album.title = data.title;

      // 🔥 TRUYỀN THÊM ID VÀO ĐÂY (album._id)
      album.slug = await generateUniqueSlug(Album, data.title, album._id);
    }
    if (data.description) album.description = data.description;
    if (data.type) album.type = data.type;

    // New Fields
    if (data.label) album.label = data.label;
    if (data.upc) album.upc = data.upc;
    if (data.copyright) album.copyright = data.copyright;
    if (data.themeColor) album.themeColor = data.themeColor;

    if (data.releaseDate) {
      album.releaseDate = new Date(data.releaseDate);
      album.releaseYear = album.releaseDate.getFullYear();
    }

    if (data.genreIds) {
      const newGenreIds = parseGenreIds(data.genreIds);
      const oldGenreIdsStr = album.genres.map((id: any) => id.toString());
      const newGenreIdsStr = newGenreIds.map((id: any) => id.toString());

      const addedGenres = newGenreIdsStr.filter(
        (id) => !oldGenreIdsStr.includes(id),
      );
      const removedGenres = oldGenreIdsStr.filter(
        (id) => !newGenreIdsStr.includes(id),
      );

      const promises = [];
      if (addedGenres.length > 0) {
        promises.push(
          Genre.updateMany(
            { _id: { $in: addedGenres } },
            { $inc: { albumCount: 1 } },
          ),
        );
      }
      // 2. 🔥 FIX: Giảm count cho Genre bị gỡ (Thêm điều kiện $gt: 0)
      if (removedGenres.length > 0) {
        promises.push(
          Genre.updateMany(
            {
              _id: { $in: removedGenres },
              albumCount: { $gt: 0 }, // Chỉ trừ nếu đang > 0
            },
            { $inc: { albumCount: -1 } },
          ),
        );
      }

      await Promise.all(promises);
      album.genres = newGenreIds;
    }
    if (data.tags) album.tags = parseTags(data.tags);

    if (data.isPublic !== undefined) {
      album.isPublic = String(data.isPublic) === "true";
    }

    // C. Update Image
    if (file) {
      if (album.coverImage && !album.coverImage.includes("default")) {
        await deleteFileFromCloud(album.coverImage, "image").catch(
          console.error,
        );
      }
      album.coverImage = file.path;
    }

    await album.save();
    return album;
  }

  /**
   * 3. GET LIST (Advanced Sort)
   */
  /**
   * 3. GET LIST (Advanced Sort & ReDoS Protection)
   */
  async getAlbums(filter: AlbumFilterInput) {
    const {
      page,
      limit,
      keyword,
      artistId,
      year,
      genreId,
      type,
      sort,
      isPublic,
    } = filter;
    const skip = (page - 1) * limit;
    const query: any = {};

    if (keyword) {
      // 🔥 BẢO MẬT: Escape các ký tự đặc biệt của Regex trước khi query
      const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safeKeyword, $options: "i" };
    }

    if (artistId) query.artist = artistId;
    if (year) query.releaseYear = year;
    if (genreId) query.genres = genreId;
    if (type) query.type = type;
    if (isPublic !== undefined) query.isPublic = isPublic;

    let sortOption: any = { releaseDate: -1 };
    if (sort === "popular") sortOption = { playCount: -1 };
    if (sort === "oldest") sortOption = { releaseDate: 1 };
    if (sort === "name") sortOption = { title: 1 };

    const [albums, total] = await Promise.all([
      Album.find(query)
        .populate("artist", "name avatar slug isVerified") // Thêm isVerified để UI có dấu tích xanh
        .select("-tracks")
        .skip(skip)
        .limit(limit)
        .sort(sortOption)
        .lean(),
      Album.countDocuments(query),
    ]);

    return {
      data: albums,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 3. DELETE ALBUM (Fix: Giảm Counter & Unlink Tracks)
   */
  /**
   * 3. DELETE ALBUM (Chuẩn Transaction & An toàn file)
   */
  async deleteAlbum(id: string, currentUser: IUser) {
    const album = await Album.findById(id);
    if (!album) throw new ApiError(httpStatus.NOT_FOUND, "Album not found");

    const isOwner =
      currentUser.artistProfile &&
      album.artist.toString() === currentUser.artistProfile.toString();

    if (currentUser.role !== "admin" && !isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền xóa");
    }

    const coverImageToDelete = album.coverImage;

    // 🔥 BẮT ĐẦU TRANSACTION
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Unlink Tracks (Gỡ bài hát khỏi album)
      await Track.updateMany(
        { album: id },
        { $unset: { album: "" } },
        { session },
      );

      // 2. Giảm Counter của Artist
      if (album.artist) {
        await Artist.findByIdAndUpdate(
          album.artist,
          { $inc: { totalAlbums: -1 } },
          { session },
        );
      }

      // 3. Giảm Counter của Genre
      if (album.genres && album.genres.length > 0) {
        await Genre.updateMany(
          {
            _id: { $in: album.genres },
            albumCount: { $gt: 0 },
          },
          { $inc: { albumCount: -1 } },
          { session },
        );
      }

      // 4. Xóa Album khỏi DB
      await album.deleteOne({ session });

      // 🔥 LƯU VÀO DB
      await session.commitTransaction();

      // 🧹 SAU KHI XÓA DB THÀNH CÔNG: Mới được xóa ảnh trên Cloudinary
      if (coverImageToDelete && !coverImageToDelete.includes("default")) {
        deleteFileFromCloud(coverImageToDelete, "image").catch(console.error);
      }

      return { message: "Xóa đĩa nhạc thành công" };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 4. GET DETAIL
   */
  /**
   * 4. GET DETAIL (Optimized Payload)
   */
  async getAlbumDetail(
    slugOrId: string,
    currentUserId?: string,
    userRole?: string,
  ) {
    const isId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    const album = await Album.findOne(query)
      .populate("artist", "name avatar slug isVerified")
      .populate("genres", "name slug color") // Lấy thêm color để UI hiển thị đẹp hơn
      .populate({
        path: "tracks",
        match: { status: "ready" },
        // Chỉ lấy những trường cần thiết nhất của Track
        select:
          "title slug duration playCount coverImage trackUrl isPublic explicit",
        options: { sort: { trackNumber: 1, createdAt: 1 } },
        populate: [
          {
            path: "artist",
            select: "name slug",
          },
        ],
      });

    if (!album)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy đĩa nhạc");

    // Logic Check Private
    if (!album.isPublic) {
      const albumArtistId =
        (album.artist as any)._id?.toString() || album.artist.toString();

      const isOwner =
        currentUserId &&
        (userRole === "admin" ||
          (await User.exists({
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

    return album;
  }
}
export default new AlbumService();
