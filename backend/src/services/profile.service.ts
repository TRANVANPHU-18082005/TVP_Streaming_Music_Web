// src/services/profile.service.ts
import mongoose from "mongoose";
import PlayLog from "../models/PlayLog";
import Playlist from "../models/Playlist";
import Like from "../models/Like";

import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import logger from "../utils/logger";

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
  async getLikedTracks(userId: string, query: any) {
    const { page = 1, limit = 20 } = query;
    const [likedTracks] = await Promise.all([
      this.getLikedContent(userId, "track", page, limit),
    ]);
    logger.debug("Favourite Track: " + likedTracks);
    return likedTracks;
  }
  /**
   * 5. TỔNG HỢP DASHBOARD
   */
  async getFullProfileDashboard(userId: string) {
    // Lấy 8 bài hát và 6 album mới nhất đã like làm bản xem trước (preview)
    const [analytics, likedTracks, likedAlbums, likedPlaylists] =
      await Promise.all([
        this.getListeningAnalytics(userId),
        this.getLikedContent(userId, "track", 1, 8),
        this.getLikedContent(userId, "album", 1, 6),
        this.getLikedContent(userId, "playlist", 1, 6),
      ]);
    logger.debug("Favourite Track content: " + likedTracks);
    return {
      analytics,
      library: {
        tracks: likedTracks.data,
        albums: likedAlbums.data,
        playlists: likedPlaylists.data,
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
    query: { page?: number; limit?: number } = {},
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sử dụng Facet để lấy cả DATA và TOTAL COUNT trong 1 lần query duy nhất (Tối ưu nhất cho Aggregate)
    const results = await PlayLog.aggregate([
      // 1. Lọc theo User (Cần có Index: { userId: 1, listenedAt: -1 })
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },

      // 2. Sắp xếp log mới nhất lên đầu để lấy đúng bản ghi 'vừa nghe'
      { $sort: { listenedAt: -1 } },

      // 3. Nhóm để tránh trùng bài hát
      {
        $group: {
          _id: "$trackId",
          lastListenedAt: { $first: "$listenedAt" },
        },
      },

      // 4. Sắp xếp lại danh sách sau khi đã loại bỏ trùng lặp
      { $sort: { lastListenedAt: -1 } },

      // 5. PHÂN TRANG & ĐẾM TỔNG (Sử dụng $facet)
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            // 6. JOIN lấy thông tin chi tiết
            {
              $lookup: {
                from: "tracks",
                localField: "_id",
                foreignField: "_id",
                as: "trackDetails",
              },
            },
            { $unwind: "$trackDetails" },
            // 7. Security Match
            // {
            //   $match: {
            //     "trackDetails.status": "ready",
            //     "trackDetails.isDeleted": false,
            //   },
            // },
            // 8. JOIN lấy Artist
            {
              $lookup: {
                from: "artists",
                localField: "trackDetails.artist",
                foreignField: "_id",
                as: "artistInfo",
              },
            },
            {
              $unwind: {
                path: "$artistInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            // 9. Format Output
            {
              $project: {
                _id: "$_id",
                listenedAt: "$lastListenedAt",
                title: "$trackDetails.title",
                slug: "$trackDetails.slug",
                hlsUrl: "$trackDetails.hlsUrl",
                coverImage: "$trackDetails.coverImage",
                duration: "$trackDetails.duration",
                playCount: "$trackDetails.playCount",
                isExplicit: "$trackDetails.isExplicit",
                artist: {
                  _id: "$artistInfo._id",
                  name: "$artistInfo.name",
                  slug: "$artistInfo.slug",
                },
              },
            },
          ],
        },
      },
    ]);

    const total = results[0]?.metadata[0]?.total || 0;
    const tracks = results[0]?.data || [];

    return {
      data: tracks,
      meta: {
        totalItems: total,
        page: Number(page),
        limit: Number(limit),
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
