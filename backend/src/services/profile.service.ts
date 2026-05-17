// src/services/profile.service.ts
import mongoose from "mongoose";
import PlayLog from "../models/PlayLog";
import Playlist from "../models/Playlist";
import Like from "../models/Like";

import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import logger from "../utils/logger";
import Track from "../models/Track";

class ProfileService {
  /**
   * 1. THỐNG KÊ PHÂN TÍCH (7 ngày gần nhất)
   */
  async getListeningAnalytics(
    userId: string,
    timezone: string = "Asia/Ho_Chi_Minh",
  ) {
    const days = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const stats = await PlayLog.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          listenedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$listenedAt",
              timezone: timezone, // 🔥 Xử lý lệch múi giờ cho chuẩn chart
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return this._fillMissingDates(stats, days);
  }

  /**
   * 3. LẤY NỘI DUNG ĐÃ LIKE (Nâng cấp Phân trang & Lean)
   */
  async getLikedContent(
    userId: string,
    type: "track" | "album" | "playlist",
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    // 1. Xác định collection và bảng chứa thông tin tác giả dựa trên Type
    const targetCollection =
      type === "track" ? "tracks" : type === "album" ? "albums" : "playlists";
    // Track/Album thì join với 'artists', Playlist thì join với 'users'
    const authorCollection = type === "playlist" ? "users" : "artists";
    // Track/Album dùng field 'artist', Playlist dùng field 'user'
    const authorField = type === "playlist" ? "user" : "artist";

    const result = await Like.aggregate([
      // --- BƯỚC 1: LỌC BẢN GHI LIKE ---
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          targetType: type,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // --- BƯỚC 2: LẤY CHI TIẾT NỘI DUNG ---
      {
        $lookup: {
          from: targetCollection,
          localField: "targetId",
          foreignField: "_id",
          as: "details",
        },
      },
      { $unwind: "$details" },

      // --- BƯỚC 3: LỌC NỘI DUNG HỢP LỆ (Quan trọng nhất) ---
      {
        $match: {
          // A. Album/Track dùng isPublic, Playlist dùng visibility
          $and: [
            // Lọc deleted chung
            { "details.isDeleted": { $ne: true } },
            // Lọc trạng thái public tùy theo type
            type === "playlist"
              ? { "details.visibility": "public" }
              : { "details.isPublic": true },
            // Lọc status ready chỉ dành riêng cho Track
            type === "track" ? { "details.status": "ready" } : {},
          ],
        },
      },

      // --- BƯỚC 4: LẤY THÔNG TIN TÁC GIẢ (Artist/User) ---
      {
        $lookup: {
          from: authorCollection,
          localField: `details.${authorField}`,
          foreignField: "_id",
          as: "authorInfo",
        },
      },
      {
        $unwind: { path: "$authorInfo", preserveNullAndEmptyArrays: true },
      },

      // --- BƯỚC 5: ĐỊNH DẠNG ĐẦU RA ĐỒNG NHẤT ---
      {
        $project: {
          _id: 0,
          likedAt: "$createdAt",
          item: {
            $mergeObjects: [
              "$details",
              {
                // Trả về author để FE không phải check t.artist hay t.user
                author: {
                  _id: "$authorInfo._id",
                  name: {
                    $ifNull: ["$authorInfo.name", "$authorInfo.displayName"],
                  }, // Tương thích cả User/Artist
                  avatar: {
                    $ifNull: ["$authorInfo.avatar", "$authorInfo.photoURL"],
                  },
                  slug: "$authorInfo.slug",
                },
              },
            ],
          },
        },
      },
    ]);

    const totalItems = await Like.countDocuments({ userId, targetType: type });

    return {
      data: result.map((r) => ({ ...r.item, likedAt: r.likedAt })),
      meta: {
        totalItems,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: skip + limit < totalItems,
      },
    };
  }

  /**
   * 4. CẬP NHẬT HỒ SƠ
   */
  async updateUserProfile(userId: string, updateBody: any) {
    const user = await User.findByIdAndUpdate(userId, updateBody, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user)
      throw new ApiError(httpStatus.NOT_FOUND, "Người dùng không tồn tại");
    return user;
  }
  async getLikedTracks(
    userId: string,
    filter: { page?: number; limit?: number },
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    // 1. Lấy danh sách trackId đã like, sắp xếp theo thời gian like mới nhất
    // Lưu ý: Chỉ query đúng type 'track'
    const [likes, total] = await Promise.all([
      Like.find({
        userId: new mongoose.Types.ObjectId(userId),
        targetType: "track",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Like.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        targetType: "track",
      }),
    ]);

    const trackIds = likes.map((like) => like.targetId);

    // 2. Lấy chi tiết track chuẩn chỉnh (Dùng chung cấu trúc populate/select)
    const tracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready", // Chỉ lấy bài đã sẵn sàng
      isDeleted: false,
    })
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
      .populate({ path: "moodVideo", select: "videoUrl loop" })
      .lean();

    // 3. Mapping: Giữ thứ tự theo thời gian Like và đính kèm likedAt
    const likedTracksMap = new Map(
      likes.map((l) => [l.targetId.toString(), l.createdAt]),
    );

    const sortedTracks = trackIds
      .map((id) => {
        const track = tracks.find((t) => t._id.toString() === id.toString());
        if (!track) return null;
        // Đính kèm thời gian đã like vào track object
        return { ...track, likedAt: likedTracksMap.get(id.toString()) };
      })
      .filter(Boolean);

    return {
      data: sortedTracks,
      meta: {
        totalItems: total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
      },
    };
  }
  async getUserTopTracks(
    userId: string,
    filter: { page?: number; limit?: number },
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    // 1. Gom nhóm tính tổng số lượt nghe (playCount) của từng trackId và phân trang ngầm
    const logs = await PlayLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$trackId", playCount: { $sum: 1 } } },
      { $sort: { playCount: -1 } }, // Thằng nào nghe nhiều nhất xếp đầu
      { $skip: skip },
      { $limit: limit },
    ]);

    const trackIds = logs.map((log) => log._id);

    // Tính tổng số lượng bài hát duy nhất mà user này đã từng nghe để làm meta phân trang
    const total = await PlayLog.distinct("trackId", {
      userId: new mongoose.Types.ObjectId(userId),
    }).then((ids) => ids.length);

    // 2. Lấy chi tiết thông tin Track (Bảo lưu chính xác bộ select & populate của Phú)
    const tracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
      isDeleted: false,
    })
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
      .populate({ path: "moodVideo", select: "videoUrl loop" })
      .lean();

    // 3. TÁI SẮP XẾP: Giữ đúng thứ tự Top Tracks và đính kèm thuộc tính `playCount` vào dữ liệu trả về
    const sortedTracks = logs
      .map((log) => {
        const trackDoc = tracks.find(
          (t) => t._id.toString() === log._id.toString(),
        );
        if (!trackDoc) return null;

        return {
          ...trackDoc,
          playCount: log.playCount, // 🚀 Gắn kèm số lượt nghe cho Frontend hiển thị (Ví dụ: "145 lượt nghe")
        };
      })
      .filter(Boolean);

    // 4. Trả về cấu trúc chuẩn chỉ nhất
    return {
      data: sortedTracks,
      meta: {
        totalItems: total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
      },
    };
  }
  /**
   * 5. TỔNG HỢP DASHBOARD
   */
  async getFullProfileDashboard(userId: string) {
    // Lấy 8 bài hát và 6 album mới nhất đã like làm bản xem trước (preview)
    const [analytics, likedTracks, likedAlbums, likedPlaylists, topTracks] =
      await Promise.all([
        this.getListeningAnalytics(userId),
        this.getLikedContent(userId, "track", 1, 8),
        this.getLikedContent(userId, "album", 1, 6),
        this.getLikedContent(userId, "playlist", 1, 6),
        this.getUserTopTracks(userId, { page: 1, limit: 7 }),
      ]);
    logger.debug("Favourite Track content: " + likedTracks);
    return {
      analytics,
      library: {
        tracks: likedTracks.data,
        albums: likedAlbums.data,
        playlists: likedPlaylists.data,
        topTracks: topTracks,
      },
    };
  }
  async getLibrary(userId: string, limit: number = 20) {
    // Lấy 8 bài hát và 6 album mới nhất đã like làm bản xem trước (preview)
    const [likedTracks, likedAlbums, likedPlaylists] = await Promise.all([
      this.getLikedContent(userId, "track", 1, limit),
      this.getLikedContent(userId, "album", 1, limit),
      this.getLikedContent(userId, "playlist", 1, limit),
    ]);
    return {
      tracks: likedTracks.data,
      albums: likedAlbums.data,
      playlists: likedPlaylists.data,
    };
  }
  async getAnalytics(userId: string) {
    // Lấy 8 bài hát và 6 album mới nhất đã like làm bản xem trước (preview)
    const [analytics] = await Promise.all([this.getListeningAnalytics(userId)]);
    return {
      analytics,
    };
  }
  //
  async getRecentlyPlayed(
    userId: string,
    filter: { page?: number; limit?: number },
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    // 1. Lấy danh sách trackId duy nhất đã nghe, sắp xếp theo thời gian mới nhất
    const logs = await PlayLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $sort: { listenedAt: -1 } },
      {
        $group: { _id: "$trackId", lastListenedAt: { $first: "$listenedAt" } },
      },
      { $sort: { lastListenedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const trackIds = logs.map((log) => log._id);
    const total = await PlayLog.distinct("trackId", {
      userId: new mongoose.Types.ObjectId(userId),
    }).then((ids) => ids.length);

    // 2. Lấy chi tiết track bằng .find() với cấu trúc .select() và .populate() như getAlbumTracks
    const tracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
      isDeleted: false,
    })
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
      .populate({ path: "moodVideo", select: "videoUrl loop" })
      .lean();

    // 3. Sắp xếp lại danh sách theo thứ tự lastListenedAt (vì find { $in } không giữ thứ tự)
    const sortedTracks = trackIds
      .map((id) => tracks.find((t) => t._id.toString() === id.toString()))
      .filter(Boolean);

    return {
      data: sortedTracks,
      meta: {
        totalItems: total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
      },
    };
  }
  private _fillMissingDates(stats: any[], days: number) {
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      // Format YYYY-MM-DD dựa trên local date
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const found = stats.find((s) => s._id === dateStr);
      result.push({
        date: dateStr,
        count: found ? found.count : 0,
        // Mẹo cho FE vẽ chart đẹp hơn: Thêm nhãn ngắn (Ví dụ: "27/03")
        label: `${day}/${month}`,
      });
    }
    return result;
  }
}

export default new ProfileService();
