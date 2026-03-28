// src/services/profile.service.ts
import mongoose from "mongoose";
import PlayLog from "../models/PlayLog";
import Playlist from "../models/Playlist";
import Like from "../models/Like";

import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

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
   * 2. LẤY PLAYLIST CÁ NHÂN
   */
  async getMyPlaylists(userId: string) {
    return await Playlist.find({ creator: userId, isSystem: false })
      .sort({ updatedAt: -1 })
      .lean();
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
    const targetCollection =
      type === "track" ? "tracks" : type === "album" ? "albums" : "playlists";

    const result = await Like.aggregate([
      // 1. Lọc các bản ghi Like của User và đúng loại
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          targetType: type,
        },
      },

      // 2. Sắp xếp theo thời gian Like mới nhất
      { $sort: { createdAt: -1 } },

      // 3. Phân trang ngay tại đây
      { $skip: skip },
      { $limit: limit },

      // 4. JOIN (Lookup) với bảng dữ liệu thật (Track/Album/Playlist)
      {
        $lookup: {
          from: targetCollection,
          localField: "targetId",
          foreignField: "_id",
          as: "details",
        },
      },

      // 5. Gỡ mảng chi tiết (Vì lookup trả về mảng)
      { $unwind: "$details" },

      // 6. Lọc bỏ các dữ liệu mồ côi hoặc bị ẩn (Security & Integrity)
      {
        $match: {
          "details.status": "ready", // Chỉ lấy bài hát đã sẵn sàng
          "details.isDeleted": false,
        },
      },

      // 7. Thêm thông tin Artist/User (Lookup sâu nếu cần)
      // Ví dụ cho Track: lấy Artist chi tiết
      {
        $lookup: {
          from: "artists", // Giả sử collection là artists
          localField: "details.artist",
          foreignField: "_id",
          as: "details.artist",
        },
      },
      {
        $unwind: { path: "$details.artist", preserveNullAndEmptyArrays: true },
      },

      // 8. Định dạng lại Output sạch sẽ
      {
        $project: {
          _id: 0, // Bỏ ID của bản ghi Like
          likedAt: "$createdAt",
          item: "$details",
        },
      },
    ]);

    // Lấy tổng số để phân trang (Nên dùng count riêng hoặc Facet trong Aggregate)
    const totalItems = await Like.countDocuments({ userId, targetType: type });

    return {
      data: result.map((r) => ({ ...r.item, likedAt: r.likedAt })), // Giữ cấu trúc phẳng cho FE
      meta: {
        totalItems,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalItems / limit),
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
  /**
   * 6. LẤY LỊCH SỬ NGHE NHẠC (Recently Played)
   * Lấy danh sách các bài hát user đã nghe gần đây, không trùng lặp (Unique)
   */
  async getRecentlyPlayed(userId: string, limit: number = 20) {
    const result = await PlayLog.aggregate([
      // 1. Lọc theo User
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },

      // 2. Sắp xếp log mới nhất lên đầu
      { $sort: { listenedAt: -1 } },

      // 3. Nhóm theo trackId để tránh 1 bài hiện nhiều lần nếu user nghe đi nghe lại
      {
        $group: {
          _id: "$trackId",
          lastListenedAt: { $first: "$listenedAt" }, // Lấy thời điểm nghe gần nhất
        },
      },

      // 4. Sắp xếp lại sau khi group để đảm bảo tính thời gian
      { $sort: { lastListenedAt: -1 } },

      // 5. Giới hạn số lượng
      { $limit: limit },

      // 6. JOIN với bảng Track để lấy thông tin chi tiết
      {
        $lookup: {
          from: "tracks", // Tên collection của Track
          localField: "_id",
          foreignField: "_id",
          as: "trackDetails",
        },
      },

      // 7. Gỡ mảng lookup
      { $unwind: "$trackDetails" },

      // 8. Lọc bài hát còn hoạt động (Security)
      {
        $match: {
          "trackDetails.status": "ready",
          "trackDetails.isDeleted": false,
        },
      },

      // 9. JOIN với bảng Artist để lấy tên nghệ sĩ
      {
        $lookup: {
          from: "artists",
          localField: "trackDetails.artist",
          foreignField: "_id",
          as: "trackDetails.artist",
        },
      },
      {
        $unwind: {
          path: "$trackDetails.artist",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 10. Định dạng output sạch sẽ
      {
        $project: {
          _id: "$_id",
          listenedAt: "$lastListenedAt",
          title: "$trackDetails.title",
          slug: "$trackDetails.slug",
          hlsUrl: "$trackDetails.hlsUrl",
          coverImage: "$trackDetails.coverImage",
          duration: "$trackDetails.duration",
          artist: {
            _id: "$trackDetails.artist._id",
            name: "$trackDetails.artist.name",
            slug: "$trackDetails.artist.slug",
          },
        },
      },
    ]);

    return result;
  }
  /**
   * 5. TỔNG HỢP DASHBOARD
   */
  async getFullProfileDashboard(userId: string) {
    // Lấy 8 bài hát và 6 album mới nhất đã like làm bản xem trước (preview)
    const [
      analytics,
      recentlyPlayed,
      playlists,
      likedTracks,
      likedAlbums,
      likedPlaylists,
    ] = await Promise.all([
      this.getListeningAnalytics(userId),
      this.getRecentlyPlayed(userId, 10),
      this.getMyPlaylists(userId),
      this.getLikedContent(userId, "track", 1, 8),
      this.getLikedContent(userId, "album", 1, 6),
      this.getLikedContent(userId, "playlist", 1, 6),
    ]);

    return {
      analytics,
      playlists,
      recentlyPlayed,
      library: {
        tracks: likedTracks.data,
        albums: likedAlbums.data,
        playlists: likedPlaylists.data,
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
