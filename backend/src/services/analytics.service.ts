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

// Helper kiểm tra chuẩn MongoDB ID (24 ký tự Hex)
const isValidMongoId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

class AnalyticsService {
  // --- BỘ NHỚ ĐỆM (RAM) ---
  private viewBuffer: Map<string, number> = new Map();
  private logBuffer: LogItem[] = [];
  private heartbeatBuffer: Map<string, string> = new Map();
  private geoBuffer: Map<string, number> = new Map();

  private readonly FLUSH_INTERVAL = 10000; // 10 giây
  private readonly USER_TIMEOUT = 60000; // 60 giây
  private isFlushing = false; // LẮP KHÓA MUTEX

  constructor() {
    setInterval(() => this.flushData(), this.FLUSH_INTERVAL);
  }

  /**
   * 1. TRACK VIEW
   */
  trackPlay(trackId: string, userId?: string, ip?: string) {
    if (!trackId || !isValidMongoId(trackId)) return; // Chặn rác ngay từ cửa

    const current = this.viewBuffer.get(trackId) || 0;
    this.viewBuffer.set(trackId, current + 1);

    this.logBuffer.push({
      trackId,
      userId: userId && isValidMongoId(userId) ? userId : undefined,
      ip: ip || "unknown",
      timestamp: new Date(),
    });
  }

  /**
   * 2. TRACK USER ACTIVITY
   */
  pingUserActivity(userId: string, trackId: string) {
    if (!userId || !isValidMongoId(userId)) return;

    const validTrackId = trackId && isValidMongoId(trackId) ? trackId : "";
    this.heartbeatBuffer.set(userId, validTrackId);
  }

  /**
   * 3. TRACK LOCATION
   */
  trackUserLocation(ip: string) {
    const lookupIp = ip === "::1" || ip === "127.0.0.1" ? "113.161.73.50" : ip;
    const geo = geoip.lookup(lookupIp);
    if (geo && geo.country) {
      const current = this.geoBuffer.get(geo.country) || 0;
      this.geoBuffer.set(geo.country, current + 1);
    }
  }

  /**
   * 4. FLUSH DATA (CORE ENGINE)
   */
  private async flushData() {
    if (this.isFlushing) return; // Nếu mẻ trước chưa xong, bỏ qua
    this.isFlushing = true;

    // PATTERN: SNAPSHOT & CLEAR IMMEDIATELY
    const viewsToFlush = new Map(this.viewBuffer);
    this.viewBuffer.clear();

    const heartbeatsToFlush = new Map(this.heartbeatBuffer);
    this.heartbeatBuffer.clear();

    const geoToFlush = new Map(this.geoBuffer);
    this.geoBuffer.clear();

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    if (
      viewsToFlush.size === 0 &&
      heartbeatsToFlush.size === 0 &&
      logsToFlush.length === 0 &&
      geoToFlush.size === 0
    ) {
      this.isFlushing = false;
      return;
    }

    try {
      const pipeline = cacheRedis.pipeline();
      const now = Date.now();
      const currentHourKey = `trending:${new Date().toISOString().slice(0, 13)}`;
      const trackBulkOps: any[] = [];

      // A. PREPARE VIEWS
      viewsToFlush.forEach((count, trackId) => {
        pipeline.incrby(`track:views:${trackId}`, count);
        pipeline.zincrby(currentHourKey, count, trackId);
        trackBulkOps.push({
          updateOne: {
            filter: { _id: trackId },
            update: { $inc: { playCount: count, totalPlays: count } },
          },
        });
      });
      if (viewsToFlush.size > 0) pipeline.expire(currentHourKey, 7200);

      // B. PREPARE HEARTBEATS
      heartbeatsToFlush.forEach((trackId, userId) => {
        pipeline.zadd("online_users", now, userId);
        if (trackId) {
          pipeline.set(`user:current_track:${userId}`, trackId, "EX", 120);
          pipeline.zincrby("now_listening", 1, trackId);
        }
      });

      // C. PREPARE GEO
      geoToFlush.forEach((count, countryCode) => {
        pipeline.zincrby("analytics:geo:countries", count, countryCode);
      });

      // D. CLEANUP REDIS
      pipeline.zremrangebyscore(
        "online_users",
        "-inf",
        now - this.USER_TIMEOUT,
      );
      pipeline.expire("now_listening", 60);

      // CHẠY SONG SONG TẤT CẢ TÁC VỤ
      const promises: Promise<any>[] = [pipeline.exec()];

      if (trackBulkOps.length > 0) {
        promises.push(
          Track.bulkWrite(trackBulkOps).catch((err) =>
            console.error("❌ Bulk View Update Error:", err),
          ),
        );
      }

      if (logsToFlush.length > 0) {
        promises.push(
          PlayLog.insertMany(
            logsToFlush.map((log) => ({
              trackId: log.trackId,
              userId: log.userId,
              listenedAt: log.timestamp,
              ip: log.ip,
              source: "web",
            })),
          ).catch((err) => console.error("❌ Log Flush Error:", err)),
        );
      }

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("❌ Analytics Flush Fatal Error:", error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 🔥 ĐỒNG BỘ CHO CONTROLLER: Hàm gọi flush thủ công
   */
  public async forceFlush() {
    await this.flushData();
  }

  /**
   * 5. GET STATS (Cho Controller)
   */
  async getStats() {
    const pipeline = cacheRedis.pipeline();
    const currentHourKey = `trending:${new Date().toISOString().slice(0, 13)}`;

    pipeline.zcard("online_users");
    pipeline.zrevrange("now_listening", 0, 4, "WITHSCORES");
    pipeline.zrevrange(currentHourKey, 0, 4, "WITHSCORES");
    pipeline.zrevrange("analytics:geo:countries", 0, -1, "WITHSCORES");

    const results = await pipeline.exec();

    const activeUsers = (results?.[0]?.[1] as number) || 0;
    const rawNowListening = results?.[1]?.[1] as string[];
    const rawTrending = results?.[2]?.[1] as string[];
    const rawGeo = results?.[3]?.[1] as string[];

    return {
      activeUsers,
      nowListening: await this.populateTracks(rawNowListening),
      trending: await this.populateTracks(rawTrending),
      geoData: this.parseGeoData(rawGeo),
    };
  }

  /**
   * HELPER: Parse Geo Data
   */
  private parseGeoData(list: string[]) {
    if (!list || list.length === 0) return [];
    const result = [];

    // An toàn hơn khi khởi tạo Intl.DisplayNames (Có thể fail trên một số server Node cũ)
    let regionNames: Intl.DisplayNames | null = null;
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch (e) {
      /* fallback if not supported */
    }

    for (let i = 0; i < list.length; i += 2) {
      const code = list[i];
      const count = parseInt(list[i + 1]);
      let name = code;

      if (regionNames) {
        try {
          name = regionNames.of(code) || code;
        } catch (e) {}
      }

      result.push({ id: code, name: name, value: count });
    }
    return result;
  }

  /**
   * HELPER: Populate Tracks từ DB
   */
  private async populateTracks(redisList: string[]) {
    if (!redisList || redisList.length === 0) return [];

    const trackIds: string[] = [];
    const scoreMap = new Map<string, number>();

    for (let i = 0; i < redisList.length; i += 2) {
      const id = redisList[i];
      const score = parseInt(redisList[i + 1]);

      if (isValidMongoId(id)) {
        trackIds.push(id);
        scoreMap.set(id, score);
      }
    }

    if (trackIds.length === 0) return [];

    try {
      const tracks = await Track.find({ _id: { $in: trackIds } })
        .select("title artist coverImage")
        .populate("artist", "name")
        .lean();

      return tracks
        .map((track: any) => ({
          track,
          score: scoreMap.get(track._id.toString()) || 0,
        }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error("⚠️ Error populateTracks:", error);
      return [];
    }
  }
}

export default new AnalyticsService();
