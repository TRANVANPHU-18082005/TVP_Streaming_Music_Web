import mongoose from "mongoose";
import { cacheRedis } from "../config/redis";
import PlayLog from "../models/PlayLog";
import Track from "../models/Track";
import geoip from "geoip-lite";

interface LogItem {
  trackId: string;
  userId?: string;
  ip?: string;
  timestamp: Date;
}

const isValidMongoId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

class AnalyticsService {
  // Bộ nhớ đệm trong RAM để giảm tải cho Redis
  private viewBuffer: Map<string, number> = new Map();
  private heartbeatBuffer: Map<string, string> = new Map();
  private geoBuffer: Map<string, number> = new Map();

  private readonly FLUSH_INTERVAL = 10000; // 10 giây xả buffer một lần
  private readonly USER_TIMEOUT = 60000; // 1 phút để tính User Online
  private isFlushing = false;

  constructor() {
    // Khởi tạo vòng lặp xả dữ liệu định kỳ
    setInterval(() => this.flushData(), this.FLUSH_INTERVAL);
  }

  /**
   * HELPER: Đồng bộ Key theo giờ giữa Đọc và Ghi
   * Định dạng: trending:YYYY-MM-DD:HH (Dùng giờ địa phương để khớp Dashboard)
   */
  private getCurrentHourKey() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    return `trending:${date}:${hour}`;
  }

  /**
   * 1. Nhận lượt Play từ Controller/Socket và lưu vào RAM
   */
  trackPlay(trackId: string) {
    if (!trackId || !isValidMongoId(trackId)) return;
    this.viewBuffer.set(trackId, (this.viewBuffer.get(trackId) || 0) + 1);
  }

  /**
   * 2. Heartbeat: Đánh dấu User đang online và bài hát họ đang nghe
   */
  pingUserActivity(userId: string, trackId?: string) {
    if (!userId || !isValidMongoId(userId)) return;
    this.heartbeatBuffer.set(
      userId,
      trackId && isValidMongoId(trackId) ? trackId : "",
    );
  }

  /**
   * 3. Xử lý vị trí địa lý dựa trên IP
   */
  trackUserLocation(ip: string) {
    const lookupIp = ip === "::1" || ip === "127.0.0.1" ? "113.161.73.50" : ip;
    const geo = geoip.lookup(lookupIp);
    if (geo && geo.country) {
      this.geoBuffer.set(
        geo.country,
        (this.geoBuffer.get(geo.country) || 0) + 1,
      );
    }
  }

  /**
   * 4. CORE: Xả dữ liệu từ RAM xuống Redis (Chỉ xử lý dữ liệu Real-time)
   * Loại bỏ BulkWrite MongoDB để SyncJob và Worker xử lý.
   */
  private async flushData() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    // Snapshot & Clear: Giải phóng RAM ngay lập tức để nhận mẻ mới
    const views = new Map(this.viewBuffer);
    this.viewBuffer.clear();
    const heartbeats = new Map(this.heartbeatBuffer);
    this.heartbeatBuffer.clear();
    const geos = new Map(this.geoBuffer);
    this.geoBuffer.clear();

    if (views.size === 0 && heartbeats.size === 0 && geos.size === 0) {
      this.isFlushing = false;
      return;
    }

    try {
      const pipeline = cacheRedis.pipeline();
      const now = Date.now();
      const hourKey = this.getCurrentHourKey();

      // A. Cập nhật Trending và Bộ đếm view cho Cron Job
      views.forEach((count, trackId) => {
        // Tích lũy để SyncJob quét cập nhật DB sau mỗi 5p
        pipeline.incrby(`track:views:${trackId}`, count);
        // Tích lũy cho bảng xếp hạng Trending Dashboard
        pipeline.zincrby(hourKey, count, trackId);
        pipeline.expire(hourKey, 86400); // Key trending tồn tại trong 24h
      });

      // B. Xử lý Trạng thái Online & Now Listening
      heartbeats.forEach((trackId, userId) => {
        pipeline.zadd("online_users", now, userId);
        if (trackId) {
          // Ghi nhận bài hát đang được nhiều người nghe nhất cùng lúc
          pipeline.zincrby("now_listening", 1, trackId);
        }
      });

      // C. Cập nhật dữ liệu bản đồ địa lý
      geos.forEach((count, code) => {
        pipeline.zincrby("analytics:geo:countries", count, code);
      });

      // D. Dọn dẹp User offline (sau 1 phút không có heartbeat)
      pipeline.zremrangebyscore(
        "online_users",
        "-inf",
        now - this.USER_TIMEOUT,
      );
      // Đặt expire ngắn cho now_listening để dữ liệu luôn tươi mới
      pipeline.expire("now_listening", 30);

      await pipeline.exec();
      console.log(
        `[Analytics] Flushed ${views.size} views to Redis | Key: ${hourKey}`,
      );
    } catch (error) {
      console.error("❌ Analytics Flush Error:", error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 5. Dashboard: Lấy toàn bộ số liệu thống kê hiện tại
   */
  async getStats() {
    const hourKey = this.getCurrentHourKey();
    const pipeline = cacheRedis.pipeline();

    pipeline.zcard("online_users");
    pipeline.zrevrange("now_listening", 0, 4, "WITHSCORES");
    pipeline.zrevrange(hourKey, 0, 4, "WITHSCORES");
    pipeline.zrevrange("analytics:geo:countries", 0, -1, "WITHSCORES");

    const results = await pipeline.exec();

    const activeUsers = (results?.[0]?.[1] as number) || 0;
    const nowListeningRaw = (results?.[1]?.[1] as string[]) || [];
    const trendingRaw = (results?.[2]?.[1] as string[]) || [];
    const geoRaw = (results?.[3]?.[1] as string[]) || [];

    return {
      activeUsers,
      nowListening: await this.populateTracks(nowListeningRaw),
      trending: await this.populateTracks(trendingRaw),
      geoData: this.parseGeoData(geoRaw),
    };
  }

  /**
   * Ép xả dữ liệu ngay lập tức (Dành cho Admin/Shutdown)
   */
  async forceFlush() {
    await this.flushData();
  }

  private async populateTracks(list: string[]) {
    if (!list || list.length === 0) return [];
    const ids: string[] = [];
    const scores = new Map<string, number>();

    for (let i = 0; i < list.length; i += 2) {
      ids.push(list[i]);
      scores.set(list[i], parseInt(list[i + 1]));
    }

    // Lấy thông tin track kèm nghệ sĩ để hiển thị Dashboard
    const tracks = await Track.find({ _id: { $in: ids } })
      .select("title coverImage")
      .populate("artist", "name avatar")
      .lean();

    return tracks
      .map((t: any) => ({
        ...t,
        score: scores.get(t._id.toString()) || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private parseGeoData(list: string[]) {
    const res = [];
    for (let i = 0; i < list.length; i += 2) {
      res.push({ id: list[i], value: parseInt(list[i + 1]) });
    }
    return res;
  }
  /**
   * Lấy tổng quan hoạt động của 1 User
   */
  async getUserMusicSummary(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const stats = await PlayLog.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: 1 },
          uniqueArtists: { $addToSet: "$artistId" }, // Giả sử bạn có lưu artistId trong PlayLog
          totalMinutes: { $sum: 3.5 }, // Giả sử trung bình 1 bài là 3.5 phút
        },
      },
    ]);

    const result = stats[0] || {
      totalPlays: 0,
      uniqueArtists: [],
      totalMinutes: 0,
    };

    return {
      totalPlays: result.totalPlays,
      artistCount: result.uniqueArtists?.length || 0,
      totalMinutes: Math.round(result.totalMinutes),
    };
  }

  /**
   * Lấy danh sách Top bài hát mà User nghe nhiều nhất
   */
  async getUserTopTracks(userId: string, limit = 5) {
    return await PlayLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$trackId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "_id",
          as: "track",
        },
      },
      { $unwind: "$track" },
      {
        $project: {
          _id: 0,
          playCount: "$count",
          track: {
            _id: "$track._id",
            title: "$track.title",
            coverImage: "$track.coverImage",
          },
        },
      },
    ]);
  }
  /**
   * Lấy danh sách bài hát nghe gần đây (Đã gộp trùng và Populate)
   */
  async getRecentPlayed(userId: string, limit = 10) {
    return await PlayLog.aggregate([
      // 1. Lọc theo User
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },

      // 2. Sắp xếp mới nhất lên đầu
      { $sort: { listenedAt: -1 } },

      // 3. Nhóm theo trackId để tránh một bài hiện nhiều lần liên tiếp
      {
        $group: {
          _id: "$trackId",
          lastListenedAt: { $first: "$listenedAt" }, // Lấy mốc thời gian gần nhất
        },
      },

      // 4. Sắp xếp lại sau khi nhóm
      { $sort: { lastListenedAt: -1 } },

      // 5. Giới hạn số lượng hiển thị
      { $limit: limit },

      // 6. Join với bảng Tracks để lấy thông tin chi tiết
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "_id",
          as: "track",
        },
      },
      { $unwind: "$track" },

      // 7. Join tiếp với bảng Artists để lấy tên nghệ sĩ
      {
        $lookup: {
          from: "artists",
          localField: "track.artist",
          foreignField: "_id",
          as: "track.artist",
        },
      },
      { $unwind: "$track.artist" },

      // 8. Định dạng lại kết quả trả về
      {
        $project: {
          _id: 0,
          lastListenedAt: 1,
          track: {
            _id: "$track._id",
            title: "$track.title",
            coverImage: "$track.coverImage",
            artist: {
              _id: "$track.artist._id",
              name: "$track.artist.name",
            },
          },
        },
      },
    ]);
  }
}

export default new AnalyticsService();
