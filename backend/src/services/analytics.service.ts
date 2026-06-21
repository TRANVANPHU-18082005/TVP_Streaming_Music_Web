// services/analytics.service.ts

import mongoose from "mongoose";
import { cacheRedis } from "../config/redis";
import PlayLog from "../models/PlayLog";
import Track from "../models/Track";
import Artist from "../models/Artist";
import geoip from "geoip-lite";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PopulatedTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist: { _id: string; name: string; avatar?: string };
  score: number;
}

interface GeoEntry {
  id: string;
  value: number;
}

interface AnalyticsStats {
  activeUsers: number;
  activeGuests: number;
  nowListening: PopulatedTrack[];
  trending: PopulatedTrack[];
  geoData: GeoEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

const isValidMongoId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

// FIX A: cho phép cả Guest ID (format: "guest_<socketId>")
const isValidUserId = (id: string) =>
  isValidMongoId(id) || id.startsWith("guest_");

// IP bị coi là private (loopback / RFC1918 / link-local)
const PRIVATE_IP_RE =
  /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::ffff:127\.|fe80:)/i;

const resolveIp = (ip: string): string | null => {
  if (!ip) return null;
  if (PRIVATE_IP_RE.test(ip)) return null; // bỏ private IP thay vì hardcode
  return ip;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL = 10_000; // 10 giây
const USER_TIMEOUT = 60_000; // 1 phút = offline
const NOW_LISTENING_TTL = 30; // seconds
const GEO_KEY = "analytics:geo:countries";
const ONLINE_KEY = "online_users";
const POPULATE_CACHE_TTL = 5; // giây — FIX C

// ─────────────────────────────────────────────────────────────────────────────
// CLASS
// ─────────────────────────────────────────────────────────────────────────────

class AnalyticsService {
  // viewBuffer: trackId → count cộng dồn trong 1 chu kỳ
  private viewBuffer = new Map<string, number>();

  // activeConnections lưu socketId → { userId, trackId, lastSeen }
  // Lưu trữ liên tục, không xoá trắng sau mỗi chu kỳ flush
  private activeConnections = new Map<string, { userId: string; trackId: string; lastSeen: number }>();

  // userLocations: userId → countryCode
  private userLocations = new Map<string, string>();

  private isFlushing = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Do NOT start timers or register shutdown handlers at import time.
    // Initialization that depends on infra readiness should call `init()`.
  }

  // ── FLUSH LOOP ─────────────────────────────────────────────────────────────

  private startFlushLoop() {
    const t = setInterval(() => this.flushData(), FLUSH_INTERVAL);
    // unref() để timer không giữ process sống khi không còn event nào khác
    // use local const `t` to narrow type (avoid property union narrowing issues)
    if (typeof (t as any).unref === "function") (t as any).unref();
    this.flushTimer = t;
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────────

  /** Ghi nhận 1 lượt play (gọi từ Controller / Socket event) */
  trackPlay(trackId: string): void {
    if (!trackId || !isValidMongoId(trackId)) return;
    this.viewBuffer.set(trackId, (this.viewBuffer.get(trackId) ?? 0) + 1);
  }

  /**
   * FIX A: Heartbeat chấp nhận cả Guest
   * userId có thể là MongoId (authenticated) hoặc "guest_<socketId>"
   */
  pingUserActivity(socketId: string, userId: string, trackId?: string): void {
    if (!socketId || !userId || !isValidUserId(userId)) return;
    const validTrack = trackId && isValidMongoId(trackId) ? trackId : "";
    this.activeConnections.set(socketId, { userId, trackId: validTrack, lastSeen: Date.now() });
  }

  /** Xoá user khi họ ngắt kết nối (Socket disconnect) */
  removeUserActivity(socketId: string): void {
    if (socketId) {
      this.activeConnections.delete(socketId);
    }
  }

  /** Ghi nhận vị trí địa lý từ IP kết nối với userId */
  trackUserLocation(userId: string, ip: string): void {
    if (!userId) return;
    
    const resolved = resolveIp(ip);
    if (!resolved) {
      // Mock VN for local development so the map isn't empty
      if (process.env.NODE_ENV !== "production") {
        this.userLocations.set(userId, "VN");
      }
      return; 
    }

    const geo = geoip.lookup(resolved);
    if (geo?.country) {
      this.userLocations.set(userId, geo.country);
    }
  }

  // ── FLUSH CORE ─────────────────────────────────────────────────────────────

  /**
   * FIX B: now_listening dùng Set-based snapshot thay vì zincrby
   *
   * Thay vì cộng dồn "số lần nghe", ta đếm "số userId duy nhất"
   * đang gán với trackId trong chu kỳ flush hiện tại.
   * Kết quả: phản ánh đúng số người đang nghe real-time.
   */
  private async flushData(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    const now = Date.now();
    const views = new Map(this.viewBuffer);
    this.viewBuffer.clear();

    // Dọn dẹp session đã hết hạn (chống kẹt user)
    for (const [socketId, conn] of this.activeConnections.entries()) {
      if (now - conn.lastSeen > USER_TIMEOUT) {
        this.activeConnections.delete(socketId);
      }
    }

    // Clean up userLocations cho những user không còn socket nào active
    const activeUserIds = new Set(Array.from(this.activeConnections.values()).map(c => c.userId));
    for (const userId of this.userLocations.keys()) {
      if (!activeUserIds.has(userId)) {
        this.userLocations.delete(userId);
      }
    }

    const hasData = views.size > 0 || this.activeConnections.size > 0;
    if (!hasData) {
      this.isFlushing = false;
      return;
    }

    try {
      const pipeline = cacheRedis.pipeline();
      const now = Date.now();
      const hourKey = this.getCurrentHourKey();

      // A. View counts → trending sorted set + pending counter cho SyncJob
      views.forEach((count, trackId) => {
        pipeline.incrby(`track:views:${trackId}`, count);
        pipeline.zincrby(hourKey, count, trackId);
        pipeline.expire(hourKey, 86400);
      });

      // B. Active Sessions → online_users + now_listening
      // Xây dựng snapshot trackId → Set<userId> trong RAM từ activeConnections hiện tại
      const nowListeningSnapshot = new Map<string, Set<string>>();

      this.activeConnections.forEach((conn, socketId) => {
        pipeline.zadd(ONLINE_KEY, now, conn.userId);

        if (conn.trackId) {
          if (!nowListeningSnapshot.has(conn.trackId)) {
            nowListeningSnapshot.set(conn.trackId, new Set());
          }
          nowListeningSnapshot.get(conn.trackId)!.add(conn.userId);
        }
      });

      // Ghi snapshot count (số userId duy nhất) vào Redis
      // Luôn xoá dữ liệu cũ, chỉ set nếu có người nghe
      pipeline.del("now_listening");
      if (nowListeningSnapshot.size > 0) {
        nowListeningSnapshot.forEach((userSet, trackId) => {
          pipeline.zadd("now_listening", userSet.size, trackId);
        });
        pipeline.expire("now_listening", NOW_LISTENING_TTL);
      }

      // C. Geo (Real-time Snapshot)
      const geoSnapshot = new Map<string, number>();
      
      for (const conn of this.activeConnections.values()) {
        const country = this.userLocations.get(conn.userId);
        if (country) {
          geoSnapshot.set(country, (geoSnapshot.get(country) || 0) + 1);
        }
      }

      pipeline.del(GEO_KEY); // Luôn xoá dữ liệu cũ
      if (geoSnapshot.size > 0) {
        geoSnapshot.forEach((count, code) => {
          pipeline.zadd(GEO_KEY, count, code);
        });
        pipeline.expire(GEO_KEY, NOW_LISTENING_TTL); // Tái sử dụng TTL của now_listening (30s)
      }

      // D. Dọn user offline
      pipeline.zremrangebyscore(ONLINE_KEY, "-inf", now - USER_TIMEOUT);

      await pipeline.exec();

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Analytics] Flushed: ${views.size} tracks | ${activeUserIds.size} active users (${this.activeConnections.size} sockets) | ${geoSnapshot.size} active countries`,
        );
      }
    } catch (error) {
      console.error("[Analytics] Flush error:", error);
      // Không throw — service phải tiếp tục chạy dù flush lỗi
    } finally {
      this.isFlushing = false;
    }
  }

  // ── GET STATS ──────────────────────────────────────────────────────────────

  async getStats(): Promise<AnalyticsStats> {
    const hourKey = this.getCurrentHourKey();
    const pipeline = cacheRedis.pipeline();

    pipeline.zcount(ONLINE_KEY, "-inf", "+inf"); // 0: tổng (guest + user)
    pipeline.zcount(ONLINE_KEY, "-inf", "+inf"); // placeholder — xem bên dưới
    pipeline.zrevrange("now_listening", 0, 4, "WITHSCORES");
    pipeline.zrevrange(hourKey, 0, 4, "WITHSCORES");
    pipeline.zrevrange(GEO_KEY, 0, -1, "WITHSCORES");

    const results = await pipeline.exec();

    const totalOnline = (results?.[0]?.[1] as number) ?? 0;
    const nowListeningRaw = (results?.[2]?.[1] as string[]) ?? [];
    const trendingRaw = (results?.[3]?.[1] as string[]) ?? [];
    const geoRaw = (results?.[4]?.[1] as string[]) ?? [];

    // FIX A: đếm riêng guest vs authenticated từ sorted set members
    // ZSCAN để tránh ZRANGE full set khi online_users lớn
    const { authenticated, guests } = await this.splitOnlineUsers(totalOnline);

    return {
      activeUsers: authenticated,
      activeGuests: guests,
      nowListening: await this.populateTracks(nowListeningRaw),
      trending: await this.populateTracks(trendingRaw),
      geoData: this.parseGeoData(geoRaw),
    };
  }

  /**
   * Tách guest vs authenticated users dựa trên member prefix.
   * Dùng ZSCAN (cursor-based) để an toàn với large sets.
   */
  private async splitOnlineUsers(
    total: number,
  ): Promise<{ authenticated: number; guests: number }> {
    if (total === 0) return { authenticated: 0, guests: 0 };

    try {
      // ZSCAN: lặp hết members mà không block Redis
      let cursor = "0";
      let guests = 0;
      let authenticated = 0;

      do {
        const [nextCursor, members] = (await (cacheRedis as any).zscan(
          ONLINE_KEY,
          cursor,
          "COUNT",
          200,
        )) as [string, string[]];

        cursor = nextCursor;
        // members là [member, score, member, score, ...]
        for (let i = 0; i < members.length; i += 2) {
          if (members[i].startsWith("guest_")) guests++;
          else authenticated++;
        }
      } while (cursor !== "0");

      return { authenticated, guests };
    } catch {
      // Fallback nếu ZSCAN không hỗ trợ (Upstash free tier)
      return { authenticated: total, guests: 0 };
    }
  }

  // ── POPULATE (FIX C: cached) ───────────────────────────────────────────────

  /**
   * FIX C: Cache kết quả populateTracks 5 giây trong Redis.
   * 10 Admin xem Dashboard đồng thời → chỉ 1 query DB duy nhất.
   */
  private async populateTracks(list: string[]): Promise<PopulatedTrack[]> {
    if (!list || list.length === 0) return [];

    const ids: string[] = [];
    const scores = new Map<string, number>();

    for (let i = 0; i < list.length; i += 2) {
      ids.push(list[i]);
      scores.set(list[i], parseInt(list[i + 1], 10));
    }

    // Cache key dựa trên sorted list of IDs
    const cacheKey = `analytics:populated:${[...ids].sort().join(",")}`;

    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached) return JSON.parse(cached) as PopulatedTrack[];
    } catch {
      /* cache miss — tiếp tục query DB */
    }

    const tracks = await Track.find({ _id: { $in: ids } })
      .select("title coverImage artist")
      .populate("artist", "name avatar")
      .lean<any[]>();

    const result: PopulatedTrack[] = tracks
      .map((t) => ({
        _id: t._id.toString(),
        title: t.title,
        coverImage: t.coverImage,
        artist: t.artist,
        score: scores.get(t._id.toString()) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    // Lưu cache — sai sót không được crash service
    cacheRedis
      .setex(cacheKey, POPULATE_CACHE_TTL, JSON.stringify(result))
      .catch(() => {});

    return result;
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  /** Định dạng: trending:YYYY-MM-DD:HH (giờ local) */
  private getCurrentHourKey(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = now.getHours().toString().padStart(2, "0");
    return `trending:${date}:${hour}`;
  }

  private parseGeoData(list: string[]): GeoEntry[] {
    const result: GeoEntry[] = [];
    for (let i = 0; i < list.length; i += 2) {
      result.push({ id: list[i], value: parseInt(list[i + 1], 10) });
    }
    return result;
  }

  // ── PUBLIC UTILITIES ───────────────────────────────────────────────────────

  /** Dành cho Admin action / unit test */
  async forceFlush(): Promise<void> {
    await this.flushData();
  }

  /** Initialize runtime behavior (timers, shutdown handlers). Call after infra ready */
  async init(): Promise<void> {
    this.startFlushLoop();
    this.registerShutdownHandlers();
  }

  // ── FIX D: GRACEFUL SHUTDOWN ───────────────────────────────────────────────

  /**
   * Lắng nghe SIGTERM / SIGINT để xả buffer trước khi process tắt.
   * Đảm bảo dữ liệu trong RAM không bị mất khi deploy / crash.
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`[Analytics] ${signal} received — flushing buffer...`);

      // copy to local variable to narrow union type before passing to clearInterval
      const timer = this.flushTimer;
      if (timer) {
        clearInterval(timer as any);
        this.flushTimer = null;
      }

      try {
        await this.flushData();
        console.log("[Analytics] Buffer flushed successfully. Exiting.");
      } catch (err) {
        console.error("[Analytics] Final flush failed:", err);
      } finally {
        // Cho phép các handler khác (DB disconnect, v.v.) chạy trước
        // Không gọi process.exit() trực tiếp tại đây — để app.ts quản lý
      }
    };

    // Chỉ đăng ký một lần (tránh duplicate listeners khi hot-reload)
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("beforeExit", () => shutdown("beforeExit"));
  }

  // ── USER-LEVEL ANALYTICS ───────────────────────────────────────────────────

  /** Tổng quan hoạt động của 1 User */
  async getUserMusicSummary(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const stats = await PlayLog.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          playCount: { $sum: 1 },
          uniqueArtists: { $addToSet: "$artistId" },
          totalMinutes: { $sum: "$duration" }, // Dùng field thực tế thay vì hardcode 3.5
        },
      },
    ]);

    const result = stats[0] ?? {
      playCount: 0,
      uniqueArtists: [],
      totalMinutes: 0,
    };

    return {
      playCount: result.playCount,
      artistCount: result.uniqueArtists?.length ?? 0,
      totalMinutes: Math.round(result.totalMinutes ?? 0),
    };
  }

  /** Top bài hát User nghe nhiều nhất */
  async getUserTopTracks(userId: string, limit = 5) {
    return PlayLog.aggregate([
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

  /** Bài hát nghe gần đây (đã gộp trùng, có populate) */
  async getRecentPlayed(userId: string, limit = 10) {
    return PlayLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $sort: { listenedAt: -1 } },
      {
        $group: {
          _id: "$trackId",
          lastListenedAt: { $first: "$listenedAt" },
        },
      },
      { $sort: { lastListenedAt: -1 } },
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
        $lookup: {
          from: "artists",
          localField: "track.artist",
          foreignField: "_id",
          as: "track.artist",
        },
      },
      { $unwind: "$track.artist" },
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

// Singleton — đảm bảo chỉ có 1 buffer và 1 flush loop trong toàn app
export default new AnalyticsService();
