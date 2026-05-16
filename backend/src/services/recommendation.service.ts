// ─────────────────────────────────────────────────────────────────────────────
// services/recommendation.service.ts
//
// Hybrid Recommendation Engine – "Bài hát bạn có thể thích"
//
// Chiến lược 3 tầng:
//   Tier 1  → Personalized   (User có đủ lịch sử PlayLog + Like)
//   Tier 2  → Trending       (User mới / cold-start)
//   Tier 3  → Discovery Mix  (Luôn trộn 20% bài mới phát hành)
//
// Cache: Redis, TTL 1 giờ (+ jitter) per userId
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Types } from "mongoose";
import Track from "../models/Track";
import Like from "../models/Like";
import PlayLog from "../models/PlayLog";
import { cacheRedis } from "../config/redis";
import { withCacheTimeout } from "../utils/cacheHelper";
import { APP_CONFIG, TRACK_POPULATE, TRACK_SELECT } from "../config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Ngưỡng tối thiểu PlayLog để kích hoạt Tier 1 */
const PERSONALIZED_THRESHOLD = 5;

/** Trọng số: 1 Like tương đương N lượt nghe */
const LIKE_WEIGHT = 5;

/** Tỉ lệ bài "mới phát hành" trong danh sách cuối (Tier 3 Discovery Mix) */
const DISCOVERY_RATIO = 0.2;

/** TTL base 1 giờ + jitter tối đa 10 phút */
const CACHE_TTL_BASE = 3600;
const CACHE_TTL_JITTER = 600;

const HOT_TODAY_KEY = "chart:hot:today";

/** TTL rebuild HOT_TODAY_KEY — 60s là đủ tươi, tránh ZUNIONSTORE liên tục */
const HOT_TODAY_TTL = 60;

/**
 * Persistent sorted set cho lượt thích.
 * Được cập nhật real-time bởi onTrackLiked / onTrackUnliked.
 * KHÔNG set TTL — tồn tại vĩnh viễn, chỉ thay đổi khi có like/unlike.
 */
const FAV_KEY = "chart:favourites";

/** Cache hydrated track data để tránh query DB lặp lại */
const HYDRATE_TTL = 30; // giây

/** Tối đa số bài lấy từ Redis trước khi cần fallback DB */
const REDIS_POOL_LIMIT = 1000;
interface RecommendOptions {
  limit?: number;
  /** Nếu cung cấp, sẽ loại bài này khỏi danh sách (vd: bài đang phát) */
  excludeTrackId?: string;
}

// TrackDoc phản ánh shape thực tế sau khi .lean() + .select() trả về.
// Tất cả fields đều optional vì .select() có thể bỏ bất kỳ field nào,
// và ITrack có nhiều field optional (album, moodVideo...) nên lean() type
// không guarantee chúng luôn tồn tại.
interface TrackDoc {
  _id: Types.ObjectId;
  title?: string;
  slug?: string;
  artist?: any;
  featuringArtists?: any[];
  album?: any; // optional – bài đơn không có album
  genres?: any[];
  coverImage?: string;
  duration?: number;
  hlsUrl?: string;
  lyricType?: string;
  isExplicit?: boolean;
  playCount?: number;
  releaseDate?: Date;
  moodVideo?: any;
  score?: number; // computed field, chỉ có sau re-scoring
}

// ─────────────────────────────────────────────────────────────────────────────
// POPULATE CONFIG (tái sử dụng ở nhiều query)
// ─────────────────────────────────────────────────────────────────────────────

/** Các field cần thiết cho card bài hát – loại bỏ data nhạy cảm */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mongoose .lean() trả về kiểu intersection phức tạp không tương thích với
 * TrackDoc[] do ITrack có field optional (album, moodVideo...).
 * Helper này tập trung toàn bộ cast tại một chỗ thay vì lặp "as unknown as".
 */
function castLean(docs: unknown): TrackDoc[] {
  return docs as TrackDoc[];
}

/** Xây cache key theo userId (hoặc "guest") */
function buildRecommendCacheKey(userId: string, limit: number): string {
  return `recommend:tracks:${userId}:limit${limit}`;
}

/**
 * Fisher-Yates shuffle để trộn mảng.
 * Dùng để đảm bảo Tier 3 discovery tracks được chèn ngẫu nhiên
 * thay vì luôn xuất hiện ở cuối danh sách.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Loại bỏ duplicate theo _id, giữ thứ tự phần tử đầu tiên xuất hiện.
 */
function deduplicateTracks(tracks: TrackDoc[]): TrackDoc[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const id = t._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASS
// ─────────────────────────────────────────────────────────────────────────────

class RecommendationService {
  // ────────────────────────────────────────────────────────────────────────────
  // PUBLIC ENTRY POINT
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Hàm chính – trả về danh sách bài hát gợi ý cho một user.
   *
   * Luồng xử lý:
   *   1. Kiểm tra Redis cache → trả ngay nếu có.
   *   2. Đếm PlayLog để quyết định Tier.
   *   3. Chạy thuật toán tương ứng.
   *   4. Trộn 20% Discovery Mix (Tier 3).
   *   5. Lưu cache và trả kết quả.
   */
  async getRecommendedTracks(
    userId: string | undefined | null,
    options: RecommendOptions = {},
  ): Promise<TrackDoc[]> {
    const { limit = APP_CONFIG.PAGINATION_LIMIT, excludeTrackId } = options;
    const resolvedUserId = userId ?? "guest";

    // ── 1. Cache check ────────────────────────────────────────────────────────
    const cacheKey = buildRecommendCacheKey(resolvedUserId, limit);
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) {
        let tracks: TrackDoc[] = JSON.parse(cached as string);
        if (excludeTrackId) {
          tracks = tracks.filter((t) => t._id.toString() !== excludeTrackId);
        }
        return tracks;
      }
    } catch {
      // Cache miss hoặc lỗi Redis → tiếp tục query DB
    }

    // ── 2. Quyết định Tier ────────────────────────────────────────────────────
    let recommendations: TrackDoc[] = [];

    if (!userId) {
      // Guest → thẳng Tier 2
      recommendations = await this.getTrendingTracks(limit);
    } else {
      const playLogCount = await PlayLog.countDocuments({ userId });

      if (playLogCount >= PERSONALIZED_THRESHOLD) {
        // Tier 1: Cá nhân hóa
        recommendations = await this.getPersonalizedTracks(
          userId,
          limit,
          excludeTrackId,
        );
      } else {
        // Tier 2: Trending (cold-start)
        recommendations = await this.getTrendingTracks(limit, userId);
      }
    }

    // ── 3. Tier 3: Discovery Mix (trộn 20% bài mới) ───────────────────────────
    const discoveryCount = Math.ceil(limit * DISCOVERY_RATIO);
    const existingIds = new Set(recommendations.map((t) => t._id.toString()));
    if (excludeTrackId) existingIds.add(excludeTrackId);

    const discoveryTracks = await this.getDiscoveryTracks(
      discoveryCount,
      existingIds,
    );

    // Cắt bớt mainList để tổng = limit, rồi xen discoveryTracks vào ngẫu nhiên
    const mainCount = limit - discoveryTracks.length;
    const mainList = recommendations.slice(0, mainCount);
    const mixed = this.injectDiscovery(mainList, discoveryTracks);

    // ── 4. Cache & trả kết quả ────────────────────────────────────────────────
    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(mixed), "EX", ttl),
    ).catch(() => {});

    // Loại excludeTrackId khỏi kết quả cuối cùng (sau khi cache đã lưu toàn bộ)
    if (excludeTrackId) {
      return mixed.filter((t) => t._id.toString() !== excludeTrackId);
    }
    return mixed;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TIER 1 – PERSONALIZED
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Collaborative + Content-based Filtering sử dụng MongoDB Aggregation.
   *
   * Pipeline:
   *   Step A → Tính "User Preference Profile" từ PlayLog + Like.
   *            Mỗi trackId có score = (playCount × 1) + (likeCount × LIKE_WEIGHT).
   *   Step B → Lookup Track để lấy genres & artists.
   *   Step C → Tổng hợp top genres & top artists.
   *   Step D → Tìm candidate tracks cùng genre/artist.
   *   Step E → Loại bỏ đã nghe / đã like / đã xóa.
   *   Step F → Score & Sort candidates, lấy top-N.
   */
  private async getPersonalizedTracks(
    userId: string,
    limit: number,
    excludeTrackId?: string,
  ): Promise<TrackDoc[]> {
    const userObjId = new Types.ObjectId(userId);

    // ── Step A: Tính preference score từ PlayLog ─────────────────────────────
    const playLogScores: Array<{ trackId: Types.ObjectId; score: number }> =
      await PlayLog.aggregate([
        { $match: { userId: userObjId } },
        {
          $group: {
            _id: "$trackId",
            playCount: { $sum: 1 },
          },
        },
        {
          $project: {
            trackId: "$_id",
            score: "$playCount", // score = số lần nghe
            _id: 0,
          },
        },
      ]);

    // ── Step A2: Cộng thêm Like score ────────────────────────────────────────
    const likedTracks: Array<{ targetId: Types.ObjectId }> = await Like.find({
      userId: userObjId,
      targetType: "track",
    })
      .select("targetId")
      .lean();

    const likedSet = new Set(likedTracks.map((l) => l.targetId.toString()));

    // Merge: nếu track đã like → cộng thêm LIKE_WEIGHT
    const scoreMap = new Map<string, number>();
    for (const { trackId, score } of playLogScores) {
      scoreMap.set(trackId.toString(), score);
    }
    for (const { targetId } of likedTracks) {
      const id = targetId.toString();
      scoreMap.set(id, (scoreMap.get(id) ?? 0) + LIKE_WEIGHT);
    }

    if (scoreMap.size === 0) {
      // Không đủ dữ liệu → fallback Tier 2
      return this.getTrendingTracks(limit, userId);
    }

    // ── Step B: Lookup genres & artists từ các track đã tương tác ────────────
    const interactedIds = [...scoreMap.keys()].map(
      (id) => new Types.ObjectId(id),
    );

    const interactedTracks: Array<{
      _id: Types.ObjectId;
      genres: Types.ObjectId[];
      artist: Types.ObjectId;
    }> = await Track.find({ _id: { $in: interactedIds }, isDeleted: false })
      .select("genres artist")
      .lean();

    // ── Step C: Tổng hợp top genres & top artists (có trọng số) ──────────────
    const genreWeight = new Map<string, number>();
    const artistWeight = new Map<string, number>();

    for (const track of interactedTracks) {
      const weight = scoreMap.get(track._id.toString()) ?? 1;

      for (const genreId of track.genres ?? []) {
        const gid = genreId.toString();
        genreWeight.set(gid, (genreWeight.get(gid) ?? 0) + weight);
      }

      const aid = track.artist.toString();
      artistWeight.set(aid, (artistWeight.get(aid) ?? 0) + weight);
    }

    // Lấy top 5 genres & top 3 artists (đủ để candidate đa dạng)
    const topGenreIds = this.topEntries(genreWeight, 5).map(
      (id) => new Types.ObjectId(id),
    );
    const topArtistIds = this.topEntries(artistWeight, 3).map(
      (id) => new Types.ObjectId(id),
    );

    // ── Step D: Tìm candidates ────────────────────────────────────────────────
    // Loại bỏ:
    //   - Bài đã tương tác (đã nghe / đã like)
    //   - Bài đang bị xóa hoặc chưa ready
    //   - excludeTrackId (nếu có)
    const excludeIds: Types.ObjectId[] = [
      ...interactedIds,
      ...likedTracks.map((l) => new Types.ObjectId(l.targetId)),
    ];
    if (excludeTrackId && Types.ObjectId.isValid(excludeTrackId)) {
      excludeIds.push(new Types.ObjectId(excludeTrackId));
    }

    // Lấy nhiều hơn limit để còn chỗ cho Discovery Mix
    const fetchLimit = Math.min(limit * 4, 200);

    const candidates = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
        _id: { $nin: excludeIds },
        $or: [
          { genres: { $in: topGenreIds } },
          { artist: { $in: topArtistIds } },
        ],
      })
        .select(TRACK_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(fetchLimit)
        .lean(),
    );

    // ── Step E: Re-score candidates theo mức độ overlap genre/artist ─────────
    const genreWeightTotal = [...genreWeight.values()].reduce(
      (a, b) => a + b,
      0,
    );
    const artistWeightTotal = [...artistWeight.values()].reduce(
      (a, b) => a + b,
      0,
    );

    const scored = candidates.map((track) => {
      let relevance = 0;

      // Genre overlap score (normalized)
      for (const g of track.genres ?? []) {
        const gid =
          typeof g === "object" ? (g._id?.toString() ?? "") : g.toString();
        const w = genreWeight.get(gid) ?? 0;
        relevance += genreWeightTotal > 0 ? w / genreWeightTotal : 0;
      }

      // Artist match bonus
      const aid =
        track.artist && typeof track.artist === "object"
          ? (track.artist._id?.toString() ?? "")
          : (track.artist?.toString() ?? "");
      const artistW = artistWeight.get(aid) ?? 0;
      relevance +=
        artistWeightTotal > 0 ? (artistW / artistWeightTotal) * 0.5 : 0;

      // Popularity boost (log scale để tránh bias quá lớn)
      const popularityBonus = Math.log1p(track.playCount ?? 0) * 0.01;

      return { ...track, score: relevance + popularityBonus };
    });

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Dedup & slice
    return deduplicateTracks(scored).slice(0, limit);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TIER 2 – TRENDING (Cold-start / Guest)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Trả về các bài hát trending (nhiều lượt nghe nhất) trong 8 ngày gần đây
   * (phù hợp với TTL của PlayLog).
   *
   * Nếu userId được cung cấp, sẽ loại bỏ các bài user đã nghe.
   */
  private async getTrendingTracks(
    limit: number,
    userId?: string,
  ): Promise<TrackDoc[]> {
    // Tính top tracks trong window PlayLog (8 ngày)
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const topTrackIds: Array<{ _id: Types.ObjectId; count: number }> =
      await PlayLog.aggregate([
        { $match: { listenedAt: { $gte: since } } },
        { $group: { _id: "$trackId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit * 3 }, // lấy buffer để sau khi loại bỏ vẫn đủ
      ]);

    let excludeIds: Types.ObjectId[] = [];
    if (userId) {
      const listened = await PlayLog.distinct("trackId", {
        userId: new Types.ObjectId(userId),
      });
      excludeIds = listened.map((id: any) => new Types.ObjectId(id));
    }

    const candidateIds = topTrackIds
      .map((t) => t._id)
      .filter((id) => !excludeIds.some((ex) => ex.equals(id)));

    if (candidateIds.length > 0) {
      const tracks = castLean(
        await Track.find({
          _id: { $in: candidateIds },
          isDeleted: false,
          isPublic: true,
          status: "ready",
        })
          .select(TRACK_SELECT)
          .populate(TRACK_POPULATE as any)
          .lean(),
      );

      // Giữ thứ tự theo trending score
      const orderMap = new Map(candidateIds.map((id, i) => [id.toString(), i]));
      tracks.sort(
        (a, b) =>
          (orderMap.get(a._id.toString()) ?? 999) -
          (orderMap.get(b._id.toString()) ?? 999),
      );

      if (tracks.length >= limit) {
        return tracks.slice(0, limit);
      }
    }

    // Fallback: playCount tổng nếu PlayLog window không đủ
    const fallback = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
        _id: { $nin: excludeIds },
      })
        .select(TRACK_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(limit)
        .lean(),
    );

    return fallback;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TIER 3 – DISCOVERY (Bài mới phát hành)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Lấy các bài hát mới nhất (releaseDate gần đây) chưa có trong danh sách chính.
   * Mục đích: giữ cho danh sách gợi ý luôn "tươi" và có yếu tố bất ngờ.
   */
  private async getDiscoveryTracks(
    count: number,
    excludeIds: Set<string>,
  ): Promise<TrackDoc[]> {
    if (count <= 0) return [];

    // Lấy gấp đôi để đảm bảo đủ sau khi lọc
    const recent = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
      })
        .select(TRACK_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ releaseDate: -1 })
        .limit(count * 3)
        .lean(),
    );

    return recent
      .filter((t) => !excludeIds.has(t._id.toString()))
      .slice(0, count);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MIXING STRATEGY
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Chèn discovery tracks vào các vị trí ngẫu nhiên trong mainList.
   * Điều này tạo cảm giác "tự nhiên" thay vì luôn đặt bài mới ở cuối.
   */
  private injectDiscovery(main: TrackDoc[], discovery: TrackDoc[]): TrackDoc[] {
    if (discovery.length === 0) return main;

    const result = [...main];
    for (const track of discovery) {
      const pos = Math.floor(Math.random() * (result.length + 1));
      result.splice(pos, 0, track);
    }

    return deduplicateTracks(result);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SIMILAR TRACKS (Context-aware – dùng cho "Nghe tiếp / Up next")
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Tìm các bài hát tương tự với một track cụ thể.
   * Dùng cho widget "Bài hát liên quan" hoặc autoplay queue.
   *
   * Thuật toán:
   *   1. Lấy genres & artist của track gốc.
   *   2. Tìm bài cùng genre hoặc artist, sắp theo playCount.
   *   3. Ưu tiên: cùng artist > cùng genre.
   */
  async getSimilarTracks(
    trackId: string,
    options: RecommendOptions = {},
  ): Promise<TrackDoc[]> {
    const { limit = 10 } = options;
    const cacheKey = `recommend:similar:${trackId}:limit${limit}`;

    // Cache check
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const source = await Track.findById(trackId)
      .select("genres artist album")
      .lean();

    if (!source) return [];

    const artistId = source.artist;
    const genreIds = source.genres ?? [];
    const excludeId = new Types.ObjectId(trackId);

    const [sameArtist, sameGenre] = await Promise.all([
      // Same artist – up to 5 bài
      Track.find({
        artist: artistId,
        _id: { $ne: excludeId },
        isDeleted: false,
        isPublic: true,
        status: "ready",
      })
        .select(TRACK_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(5)
        .lean()
        .then(castLean),

      // Same genre – fill phần còn lại
      genreIds.length > 0
        ? Track.find({
            genres: { $in: genreIds },
            artist: { $ne: artistId }, // Tránh trùng với sameArtist
            _id: { $ne: excludeId },
            isDeleted: false,
            isPublic: true,
            status: "ready",
          })
            .select(TRACK_SELECT)
            .populate(TRACK_POPULATE as any)
            .sort({ playCount: -1, releaseDate: -1 })
            .limit(limit)
            .lean()
            .then(castLean)
        : Promise.resolve([] as TrackDoc[]),
    ]);

    const combined = deduplicateTracks([...sameArtist, ...sameGenre]).slice(
      0,
      limit,
    );

    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(combined), { ex: ttl } as any),
    ).catch(() => {});

    return combined;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CACHE INVALIDATION
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Gọi khi user thực hiện hành động (Like, Play) để xóa cache gợi ý cũ.
   * Không cần await – fire and forget.
   */
  invalidateUserRecommendCache(userId: string): void {
    // Dùng SCAN thay vì KEYS để tránh blocking Redis trong production
    const pattern = `recommend:tracks:${userId}:*`;
    withCacheTimeout(async () => {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await (cacheRedis as any).scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await (cacheRedis as any).del(...keys);
        }
      } while (cursor !== "0");
    }).catch(() => {});
  }

  /**
   * Xóa cache Similar Tracks của một bài cụ thể (vd: khi track bị cập nhật genre).
   */
  invalidateSimilarCache(trackId: string): void {
    withCacheTimeout(() =>
      (cacheRedis as any).del(`recommend:similar:${trackId}:*`),
    ).catch(() => {});
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UTILITY
  // ────────────────────────────────────────────────────────────────────────────

  /** Trả về top-N keys theo value cao nhất từ một Map. */
  private topEntries(map: Map<string, number>, n: number): string[] {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key]) => key);
  }
  /**
   * Lấy chi tiết track theo danh sách ID, có cache Redis 30s.
   * Giữ nguyên thứ tự của pageIds (quan trọng cho ranking).
   *
   * Tại sao cache theo pageIds?
   *  - Trang 1 với limit 20 sẽ được 100 user xem → chỉ 1 DB query / 30s.
   *  - Key ngắn, không va chạm giữa các page vì ID set khác nhau.
   */
  async hydratePagedTracks(pageIds: string[]): Promise<any[]> {
    if (pageIds.length === 0) return [];

    // Cache key: sort để cùng tập ID dù thứ tự khác vẫn hit cache,
    // nhưng sau đó vẫn sắp xếp lại theo pageIds gốc.
    const cacheKey = `track:hydrated:${[...pageIds].sort().join(",")}`;

    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached) {
        const cachedData: any[] = JSON.parse(cached);
        // Sắp xếp lại theo thứ tự pageIds (ranking order)
        return pageIds
          .map((id) => cachedData.find((t) => t._id?.toString() === id))
          .filter(Boolean);
      }
    } catch {
      /* cache miss — fall through to DB */
    }

    const data = await Track.find({ _id: { $in: pageIds } })
      .populate(TRACK_POPULATE as any)
      .select(TRACK_SELECT)
      .lean();

    // Sắp xếp theo thứ tự ranking (không phải thứ tự DB trả về)
    const sorted = pageIds
      .map((id) => data.find((t: any) => t._id?.toString() === id))
      .filter(Boolean);

    // Lưu cache — không block nếu Redis lỗi
    cacheRedis
      .setex(cacheKey, HYDRATE_TTL, JSON.stringify(sorted))
      .catch(() => {});

    return sorted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. GET TOP HOT TRACKS TODAY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách bài hát hot nhất hôm nay, có phân trang.
   *
   * LUỒNG XỬ LÝ (Fast → Slow):
   *
   * ① Redis HOT_TODAY_KEY còn sống (TTL chưa hết)?
   *    └─ YES → ZREVRANGE để lấy IDs theo ranking → hydratePagedTracks → done
   *    └─ NO  → ZUNIONSTORE rebuild từ hourly trending keys của analyticsService
   *
   * ② Hourly keys tồn tại (analyticsService đã flush ít nhất 1 lần)?
   *    └─ YES → rebuild HOT_TODAY_KEY → về ①
   *    └─ NO  → Cold start: PlayLog aggregate → seed HOT_TODAY_KEY → về ①
   *
   * ③ Vẫn chưa đủ bài cho trang yêu cầu?
   *    └─ Fallback: Track.find sorted by playCount → ghép vào cuối list
   *
   * TẠI SAO DÙNG analyticsService's trending keys?
   *  - analyticsService flush mỗi 10s → data luôn tươi
   *  - ZUNIONSTORE O(N log N) trên Redis, nhanh hơn MongoDB aggregate rất nhiều
   *  - Không cần dedup unique listener ở đây (đó là việc của chart:live:top100)
   *    vì "hot today" chỉ cần trending score, không cần anti-cheat strictness
   *
   * @param filter - { page?: number, limit?: number }
   */
  async getTopHotTracksToday(filter: any) {
    const { page = 1, limit = 20 } = filter;
    const page_ = Number(page);
    const limit_ = Number(limit);
    const skip = (page_ - 1) * limit_;
    const totalNeeded = skip + limit_;

    try {
      // ── BƯỚC 1: Rebuild HOT_TODAY_KEY nếu cần ──────────────────────────────

      const hotKeyExists = await cacheRedis.exists(HOT_TODAY_KEY);

      if (!hotKeyExists) {
        // Lấy tất cả hourly trending keys của hôm nay từ analyticsService
        // Format: trending:YYYY-MM-DD:HH  (UTC giờ server, nhất quán với analyticsService)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const currentHour = now.getHours();

        const todayHourKeys = Array.from(
          { length: currentHour + 1 },
          (_, h) => `trending:${dateStr}:${h.toString().padStart(2, "0")}`,
        );

        // Kiểm tra xem có hourly key nào thực sự tồn tại không
        // (tránh ZUNIONSTORE với keys rỗng gây lỗi trên một số Redis versions)
        const existingKeys = (
          await Promise.all(
            todayHourKeys.map((k) =>
              cacheRedis.exists(k).then((e) => (e ? k : null)),
            ),
          )
        ).filter(Boolean) as string[];

        if (existingKeys.length > 0) {
          // ZUNIONSTORE: gộp tất cả hourly view scores thành daily hot score
          // Weighted UNION (mặc định weight=1) → bài nào nghe nhiều giờ, nhiều lượt đều được cộng
          await (cacheRedis as any).zunionstore(
            HOT_TODAY_KEY,
            existingKeys.length,
            ...existingKeys,
          );
          await cacheRedis.expire(HOT_TODAY_KEY, HOT_TODAY_TTL);
        } else {
          // ── BƯỚC 2: Cold start — analyticsService chưa kịp flush ─────────
          // Fallback về PlayLog aggregate (giống logic cũ nhưng chỉ chạy 1 lần)
          // Sau đó seed ngược lên Redis để các lần sau không cần query DB nữa
          const start = new Date();
          start.setHours(0, 0, 0, 0);

          const hotTrackLogs = await PlayLog.aggregate([
            { $match: { listenedAt: { $gte: start } } },
            {
              $project: {
                trackId: 1,
                listener: { $ifNull: ["$userId", "$ip"] },
              },
            },
            {
              $group: {
                _id: { trackId: "$trackId", listener: "$listener" },
              },
            },
            { $group: { _id: "$_id.trackId", score: { $sum: 1 } } },
            { $sort: { score: -1 } },
            { $limit: REDIS_POOL_LIMIT },
          ]);

          if (hotTrackLogs.length > 0) {
            // Seed HOT_TODAY_KEY với unique-listener scores từ DB
            const pipeline = cacheRedis.pipeline();
            hotTrackLogs.forEach((t) =>
              pipeline.zadd(HOT_TODAY_KEY, t.score, t._id.toString()),
            );
            pipeline.expire(HOT_TODAY_KEY, HOT_TODAY_TTL);
            await pipeline.exec();
          }
        }
      }

      // ── BƯỚC 3: Đọc IDs từ Redis (O(log N + M)) ───────────────────────────

      const totalFromRedis = await cacheRedis.zcard(HOT_TODAY_KEY);
      let hotIds: string[] =
        totalFromRedis > 0
          ? await cacheRedis.zrevrange(HOT_TODAY_KEY, 0, REDIS_POOL_LIMIT - 1)
          : [];

      // ── BƯỚC 4: Fallback nếu chưa đủ bài cho trang yêu cầu ───────────────

      if (hotIds.length < totalNeeded) {
        const extra = await Track.find({
          _id: { $nin: hotIds },
          isDeleted: { $ne: true },
          isPublic: true,
          status: "ready",
        })
          .sort({ playCount: -1 })
          .limit(totalNeeded - hotIds.length)
          .select("_id")
          .lean();

        hotIds = [...hotIds, ...extra.map((t: any) => t._id.toString())];
      }

      // ── BƯỚC 5: Phân trang + Hydrate ──────────────────────────────────────

      const pageIds = hotIds.slice(skip, skip + limit_);
      const data = await this.hydratePagedTracks(pageIds);

      const totalItems = Math.max(totalFromRedis, hotIds.length);

      return {
        data,
        meta: {
          totalItems,
          page: page_,
          pageSize: limit_,
          totalPages: Math.ceil(totalItems / limit_),
          hasNextPage: totalNeeded < totalItems,
        },
      };
    } catch (error) {
      console.error("[Chart] Error in getTopHotTracksToday:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET TOP FAVOURITE TRACKS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách bài hát được yêu thích nhiều nhất, có phân trang.
   *
   * LUỒNG XỬ LÝ (Fast → Slow):
   *
   * ① chart:favourites tồn tại trong Redis?
   *    └─ YES → ZREVRANGE → hydratePagedTracks → done (P99 < 5ms)
   *    └─ NO  → Cold start: Like aggregate → seed chart:favourites → về ①
   *
   * ② Vẫn chưa đủ bài?
   *    └─ Track.find sorted by likeCount → ghép vào cuối
   *
   * TẠI SAO KHÔNG SET TTL CHO FAV_KEY?
   *  - chart:favourites được cập nhật real-time bởi onTrackLiked / onTrackUnliked
   *  - Set TTL sẽ làm mất thông tin, gây cold start không cần thiết
   *  - Nếu Redis restart → cold start 1 lần từ Like aggregate → tự heal
   *
   * INVARIANT: FAV_KEY luôn nhất quán với Like collection vì mọi like/unlike
   * đều gọi onTrackLiked / onTrackUnliked (xem phần cuối file).
   *
   * @param filter - { page?: number, limit?: number }
   */
  async getTopFavouriteTracks(filter: any) {
    const { page = 1, limit = 20 } = filter;
    const page_ = Number(page);
    const limit_ = Number(limit);
    const skip = (page_ - 1) * limit_;
    const totalNeeded = skip + limit_;

    try {
      // ── BƯỚC 1: Kiểm tra Redis ─────────────────────────────────────────────

      const totalFromRedis = await cacheRedis.zcard(FAV_KEY);
      let favIds: string[] =
        totalFromRedis > 0
          ? await cacheRedis.zrevrange(FAV_KEY, 0, REDIS_POOL_LIMIT - 1)
          : [];

      // ── BƯỚC 2: Cold start — seed từ Like collection ──────────────────────

      if (favIds.length === 0) {
        const favLogs = await Like.aggregate([
          { $match: { targetType: "track" } },
          { $group: { _id: "$targetId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: REDIS_POOL_LIMIT },
        ]);

        if (favLogs.length > 0) {
          // Seed FAV_KEY — pipeline để atomic và nhanh nhất có thể
          const pipeline = cacheRedis.pipeline();
          favLogs.forEach((l) =>
            pipeline.zadd(FAV_KEY, l.count, l._id.toString()),
          );
          await pipeline.exec();

          favIds = favLogs.map((l) => l._id.toString());
        }
      }

      // ── BƯỚC 3: Fallback nếu chưa đủ bài cho trang yêu cầu ───────────────

      if (favIds.length < totalNeeded) {
        const extra = await Track.find({
          _id: { $nin: favIds },
          isDeleted: { $ne: true },
          isPublic: true,
          status: "ready",
        })
          .sort({ likeCount: -1 })
          .limit(totalNeeded - favIds.length)
          .select("_id")
          .lean();

        favIds = [...favIds, ...extra.map((t: any) => t._id.toString())];
      }

      // ── BƯỚC 4: Phân trang + Hydrate ──────────────────────────────────────

      const pageIds = favIds.slice(skip, skip + limit_);
      const data = await this.hydratePagedTracks(pageIds);

      const totalItems = Math.max(totalFromRedis, favIds.length);

      return {
        data,
        meta: {
          totalItems,
          page: page_,
          pageSize: limit_,
          totalPages: Math.ceil(totalItems / limit_),
          hasNextPage: totalNeeded < totalItems,
        },
      };
    } catch (error) {
      console.error("[Chart] Error in getTopFavouriteTracks:", error);
      // Trả về trang trống thay vì crash app
      return {
        data: [],
        meta: {
          totalItems: 0,
          page: page_,
          pageSize: limit_,
          totalPages: 0,
          hasNextPage: false,
        },
      };
    }
  }
}

export default new RecommendationService();
