// ─────────────────────────────────────────────────────────────────────────────
// services/recommendation.service.ts
//
// Hybrid Recommendation Engine – "Bài hát bạn có thể thích"
//
// Chiến lược nghe:
//   Quen thuộc  → khoảng 40% bài đã thích / nghe nhiều
//   Cùng gu     → khoảng 40% bài cùng nghệ sĩ, thể loại, tâm trạng
//   Mới         → khoảng 20% bài mới phát hành
//   Khách / mới → trending + bài mới, không ép ObjectId
//
// Cache: Redis, TTL 1 giờ (+ jitter) per userId
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Types } from "mongoose";
import Track from "../models/Track";
import Album from "../models/Album";
import Playlist from "../models/Playlist";
import Like from "../models/Like";
import PlayLog from "../models/PlayLog";
import { cacheRedis } from "../config/redis";
import { withCacheTimeout } from "../utils/cacheHelper";
import { APP_CONFIG, TRACK_POPULATE, TRACK_SELECT } from "../config/constants";
import {
  lifetimePlayCountSort,
  lifetimePlayCountWithReleaseSort,
} from "./playCount";

export { lifetimePlayCountSort, lifetimePlayCountWithReleaseSort };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Ngưỡng tối thiểu PlayLog để kích hoạt Tier 1 */
const PERSONALIZED_THRESHOLD = 5;

/** Trọng số: 1 Like tương đương N lượt nghe */
const LIKE_WEIGHT = 5;

/** Trending stays a week. PlayLog retention is 30 days and is not this window. */
export const TRENDING_WINDOW_DAYS = 7;

/** Tỉ lệ bài "mới phát hành" trong danh sách cuối (Tier 3 Discovery Mix) */
const DISCOVERY_RATIO = 0.2;

/** Tỉ lệ bài đã thích hoặc đã nghe trong danh sách cá nhân hóa */
const FAMILIAR_RATIO = 0.4;

/** Một lần lấy thêm của phiên Dành cho tôi */
const FOR_ME_BATCH_MAX = 20;
const FOR_ME_SESSION_TTL = 6 * 60 * 60;
const FOR_ME_SKIP_TTL = 7 * 24 * 60 * 60;
const FOR_ME_SESSION_CAP = 300;
const RECOMMEND_SELECT = `${TRACK_SELECT} aiMetadata`;

type ForMeMood = "focus" | "sad" | "energy";

interface ForMeTaste {
  mix?: number;
  genreIds?: string[];
  mood?: ForMeMood;
}

interface ForMeSessionState {
  served: string[];
  genreIds?: string[];
  mix?: number;
  mood?: ForMeMood;
}

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
  /** Bài đã phát trong phiên hoặc đã bỏ qua */
  excludeIds?: string[];
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
  aiMetadata?: any;
  score?: number; // computed field, chỉ có sau re-scoring
  reason?: string;
  reasonCode?: RecommendReasonCode;
}

type RecommendReasonCode =
  | "artist"
  | "genre"
  | "mood"
  | "familiar"
  | "new_release"
  | "trending";

type TasteScores = {
  scoreMap: Map<string, number>;
  likedIds: Set<string>;
};

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
  return `recommend:tracks:${userId}:v2:limit${limit}`;
}

function isRecommendationUserId(
  userId: string | null | undefined,
): userId is string {
  return Boolean(userId && userId !== "guest" && Types.ObjectId.isValid(userId));
}

function tagTracks(
  tracks: TrackDoc[],
  reasonCode: RecommendReasonCode,
  reason: string,
): TrackDoc[] {
  return tracks.map((track) => ({
    ...track,
    reasonCode: track.reasonCode ?? reasonCode,
    reason: track.reason ?? reason,
  }));
}

function artistKeyOf(track: TrackDoc): string {
  const artist = track.artist as
    | { _id?: { toString(): string } | string }
    | string
    | undefined;
  if (artist && typeof artist === "object") {
    return artist._id?.toString() ?? "unknown";
  }
  if (typeof artist === "string" && artist) return artist;
  return "unknown";
}

function artistNameOf(track: TrackDoc): string | undefined {
  const artist = track.artist as { name?: string } | undefined;
  if (artist && typeof artist === "object" && artist.name) return artist.name;
  return undefined;
}

function mixRatios(mix?: number): { familiar: number; discovery: number } {
  if (mix === undefined || Number.isNaN(mix)) {
    return { familiar: FAMILIAR_RATIO, discovery: DISCOVERY_RATIO };
  }
  const t = Math.min(1, Math.max(0, mix));
  return {
    familiar: 0.7 - 0.6 * t,
    discovery: 0.1 + 0.5 * t,
  };
}

function objectIds(ids: string[] | undefined, max = 5): Types.ObjectId[] {
  return (ids ?? [])
    .filter((id) => Types.ObjectId.isValid(id))
    .slice(0, max)
    .map((id) => new Types.ObjectId(id));
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
   * Danh sách "Dành cho tôi".
   * User đủ lịch sử: bài quen, bài cùng gu, bài mới.
   * Khách và user mới: trending và bài mới. Chuỗi "guest" không được coi là userId.
   */
  async getRecommendedTracks(
    userId: string | undefined | null,
    options: RecommendOptions = {},
  ): Promise<TrackDoc[]> {
    const { limit = APP_CONFIG.PAGINATION_LIMIT, excludeTrackId } = options;
    const realUserId = isRecommendationUserId(userId) ? userId : null;
    const cacheKey = buildRecommendCacheKey(realUserId ?? "guest", limit);

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

    const mixed = realUserId
      ? await this.mixForListener(realUserId, limit, excludeTrackId)
      : await this.mixColdStart(null, limit, excludeTrackId);

    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(mixed), "EX", ttl),
    ).catch(() => {});

    if (excludeTrackId) {
      return mixed.filter((t) => t._id.toString() !== excludeTrackId);
    }
    return mixed;
  }

  /**
   * Lô tiếp theo của phiên nghe. Redis giữ bài đã đưa và bài bỏ qua.
   * Khách không có session: chỉ loại excludeIds của request hiện tại.
   */
  async getForMeContinuation(
    userId: string | null | undefined,
    options: {
      limit?: number;
      session?: boolean;
      excludeIds?: string[];
      genreIds?: string[];
      mix?: number;
      mood?: ForMeMood;
    } = {},
  ): Promise<{ tracks: TrackDoc[]; needsTaste: boolean }> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), FOR_ME_BATCH_MAX);
    const requested = (options.excludeIds ?? [])
      .filter((id) => Types.ObjectId.isValid(id))
      .slice(0, 80);
    const realUserId = isRecommendationUserId(userId) ? userId : null;
    const session = realUserId ? await this.readForMeSession(realUserId) : { served: [] };
    const taste = this.resolveTaste(options, session);
    const needsTaste = await this.needsTaste(realUserId, taste);

    if (options.session && realUserId) {
      const skips = await this.readSkipIds(realUserId);
      const exclude = new Set<string>([...skips, ...session.served, ...requested]);
      const batch = await this.collectFreshTracks(realUserId, limit, exclude, taste);
      session.served = [...session.served, ...batch.map((track) => track._id.toString())].slice(
        -FOR_ME_SESSION_CAP,
      );
      session.genreIds = taste.genreIds;
      session.mix = taste.mix;
      session.mood = taste.mood;
      await this.writeForMeSession(realUserId, session);
      return { tracks: batch, needsTaste };
    }

    if (requested.length === 0 && !this.hasTasteConstraint(taste)) {
      return {
        tracks: await this.getRecommendedTracks(realUserId, { limit }),
        needsTaste,
      };
    }
    return {
      tracks: await this.collectFreshTracks(realUserId, limit, new Set(requested), taste),
      needsTaste,
    };
  }

  async resetForMeSession(userId: string): Promise<void> {
    if (!isRecommendationUserId(userId)) return;
    await withCacheTimeout(() => cacheRedis.del(`recommend:session:${userId}`));
    this.invalidateUserRecommendCache(userId);
  }

  /** Ghi bài bỏ qua hoặc "Không quan tâm". Không tăng playCount. */
  async recordForMeFeedback(userId: string, trackId: string): Promise<boolean> {
    if (!isRecommendationUserId(userId) || !Types.ObjectId.isValid(trackId)) {
      return false;
    }
    const key = `recommend:skip:${userId}`;
    const saved = await withCacheTimeout(async () => {
      await cacheRedis.sadd(key, trackId);
      await cacheRedis.expire(key, FOR_ME_SKIP_TTL);
      return true;
    });
    this.invalidateUserRecommendCache(userId);
    return saved === true;
  }

  private async readSkipIds(userId: string): Promise<Set<string>> {
    const ids = await withCacheTimeout(() => cacheRedis.smembers(`recommend:skip:${userId}`));
    return new Set(ids ?? []);
  }

  private async readForMeSession(userId: string): Promise<ForMeSessionState> {
    const raw = await withCacheTimeout(() => cacheRedis.get(`recommend:session:${userId}`));
    if (!raw) return { served: [] };
    try {
      const parsed = JSON.parse(raw) as {
        served?: unknown;
        genreIds?: unknown;
        mix?: unknown;
        mood?: unknown;
      };
      const served = Array.isArray(parsed.served)
        ? parsed.served.filter((id): id is string => typeof id === "string")
        : [];
      const genreIds = Array.isArray(parsed.genreIds)
        ? parsed.genreIds.filter((id): id is string => typeof id === "string" && Types.ObjectId.isValid(id)).slice(0, 5)
        : undefined;
      const mix = typeof parsed.mix === "number" ? parsed.mix : undefined;
      const mood = parsed.mood === "focus" || parsed.mood === "sad" || parsed.mood === "energy"
        ? parsed.mood
        : undefined;
      return { served, genreIds, mix, mood };
    } catch {
      return { served: [] };
    }
  }

  private resolveTaste(
    options: { genreIds?: string[]; mix?: number; mood?: ForMeMood },
    session: ForMeSessionState,
  ): ForMeTaste {
    const genreIds = options.genreIds?.length ? options.genreIds.slice(0, 5) : session.genreIds;
    return {
      genreIds,
      mix: options.mix ?? session.mix,
      mood: options.mood ?? session.mood,
    };
  }

  private hasTasteConstraint(taste?: ForMeTaste): boolean {
    return Boolean(taste && (taste.genreIds?.length || taste.mood || taste.mix !== undefined));
  }

  private async needsTaste(userId: string | null, taste: ForMeTaste): Promise<boolean> {
    if (taste.genreIds?.length) return false;
    if (!userId) return true;
    const playLogCount = await PlayLog.countDocuments({ userId });
    return playLogCount < PERSONALIZED_THRESHOLD;
  }

  private async writeForMeSession(
    userId: string,
    session: ForMeSessionState,
  ): Promise<void> {
    await withCacheTimeout(() =>
      cacheRedis.set(
        `recommend:session:${userId}`,
        JSON.stringify(session),
        "EX",
        FOR_ME_SESSION_TTL,
      ),
    );
  }

  private async collectFreshTracks(
    userId: string | null,
    limit: number,
    exclude: Set<string>,
    taste?: ForMeTaste,
  ): Promise<TrackDoc[]> {
    if (this.hasTasteConstraint(taste)) {
      const picked = await this.findByTaste(Math.max(limit, 20), exclude, taste);
      const more = userId
        ? await this.mixForListener(userId, Math.max(limit, 20), undefined, exclude, taste)
        : await this.mixColdStart(null, Math.max(limit, 20), undefined, exclude, taste);
      const fresh = [...picked];
      const seen = new Set(fresh.map((track) => track._id.toString()));
      for (const track of more) {
        const id = track._id.toString();
        if (exclude.has(id) || seen.has(id) || !this.matchesTaste(track, taste)) continue;
        fresh.push(track);
        seen.add(id);
        if (fresh.length >= limit) break;
      }
      return fresh.slice(0, limit);
    }

    const pool = await this.getRecommendedTracks(userId, { limit: 50 });
    const fresh = pool.filter((track) => !exclude.has(track._id.toString()));
    if (fresh.length >= limit) return fresh.slice(0, limit);

    const more = userId
      ? await this.mixForListener(userId, Math.max(limit, 20), undefined, exclude)
      : await this.mixColdStart(null, Math.max(limit, 20), undefined, exclude);
    const seen = new Set(fresh.map((track) => track._id.toString()));
    for (const track of more) {
      const id = track._id.toString();
      if (exclude.has(id) || seen.has(id)) continue;
      fresh.push(track);
      seen.add(id);
      if (fresh.length >= limit) break;
    }
    return fresh.slice(0, limit);
  }

  private async mixForListener(
    userId: string,
    limit: number,
    excludeTrackId?: string,
    blocked?: Set<string>,
    taste?: ForMeTaste,
  ): Promise<TrackDoc[]> {
    const playLogCount = await PlayLog.countDocuments({ userId });
    if (playLogCount < PERSONALIZED_THRESHOLD) {
      return this.mixColdStart(userId, limit, excludeTrackId, blocked, taste);
    }

    const tasteScores = await this.loadTasteScores(userId);
    if (tasteScores.scoreMap.size === 0) {
      return this.mixColdStart(userId, limit, excludeTrackId, blocked, taste);
    }

    const ratios = mixRatios(taste?.mix);
    const discoveryCount = Math.ceil(limit * ratios.discovery);
    const familiarCount = Math.floor(limit * ratios.familiar);
    const similarCount = Math.max(0, limit - familiarCount - discoveryCount);

    const familiar = await this.getFamiliarTracks(
      userId,
      familiarCount,
      excludeTrackId,
      tasteScores,
      blocked,
    );
    const similarNeed = similarCount + (familiarCount - familiar.length);
    const similar = await this.getPersonalizedTracks(
      userId,
      similarNeed,
      excludeTrackId,
      tasteScores,
      blocked,
    );

    const familiarIds = new Set(familiar.map((track) => track._id.toString()));
    const similarFiltered = similar.filter(
      (track) =>
        !familiarIds.has(track._id.toString()) &&
        !blocked?.has(track._id.toString()),
    );
    const existingIds = new Set<string>([
      ...familiarIds,
      ...similarFiltered.map((track) => track._id.toString()),
    ]);
    if (excludeTrackId) existingIds.add(excludeTrackId);
    blocked?.forEach((id) => existingIds.add(id));

    const discovery = tagTracks(
      await this.getDiscoveryTracks(discoveryCount, existingIds),
      "new_release",
      "Bài mới dành cho bạn",
    );

    let mixed = this.arrangeForMe(
      familiar,
      similarFiltered.slice(0, similarNeed),
      discovery,
    ).slice(0, limit);

    if (mixed.length < limit) {
      const have = new Set(mixed.map((track) => track._id.toString()));
      if (excludeTrackId) have.add(excludeTrackId);
      const extra = tagTracks(
        await this.getTrendingTracks(limit, userId),
        "trending",
        "Đang được nghe nhiều",
      ).filter(
        (track) =>
          !have.has(track._id.toString()) && !blocked?.has(track._id.toString()),
      );
      mixed = this.capArtistSpread([...mixed, ...extra]).slice(0, limit);
    }

    return mixed.filter((track) => this.matchesTaste(track, taste)).slice(0, limit);
  }

  private async mixColdStart(
    userId: string | null,
    limit: number,
    excludeTrackId?: string,
    blocked?: Set<string>,
    taste?: ForMeTaste,
  ): Promise<TrackDoc[]> {
    const ratios = mixRatios(taste?.mix);
    const discoveryCount = Math.ceil(limit * ratios.discovery);
    const trending = tagTracks(
      await this.getTrendingTracks(limit, userId ?? undefined),
      "trending",
      "Đang được nghe nhiều",
    ).filter(
      (track) => !blocked?.has(track._id.toString()) && this.matchesTaste(track, taste),
    );
    const existingIds = new Set(trending.map((track) => track._id.toString()));
    if (excludeTrackId) existingIds.add(excludeTrackId);
    blocked?.forEach((id) => existingIds.add(id));
    const discovery = tagTracks(
      await this.getDiscoveryTracks(discoveryCount, existingIds),
      "new_release",
      "Bài mới dành cho bạn",
    );
    const matchedDiscovery = discovery.filter((track) => this.matchesTaste(track, taste));
    const mainCount = Math.max(0, limit - matchedDiscovery.length);
    return this.arrangeForMe(trending.slice(0, mainCount), [], matchedDiscovery)
      .filter((track) => this.matchesTaste(track, taste))
      .slice(0, limit);
  }

  private async findByTaste(
    limit: number,
    exclude: Set<string>,
    taste?: ForMeTaste,
  ): Promise<TrackDoc[]> {
    if (!taste || (!taste.genreIds?.length && !taste.mood)) return [];
    const clauses: Record<string, unknown>[] = [];
    const genreObjectIds = objectIds(taste.genreIds);
    if (genreObjectIds.length) clauses.push({ genres: { $in: genreObjectIds } });
    if (taste.mood === "focus") {
      clauses.push({
        $or: [
          { "aiMetadata.contexts": { $in: ["study", "meditation"] } },
          { "aiMetadata.moods": { $in: ["chill", "peaceful"] } },
        ],
      });
    } else if (taste.mood === "sad") {
      clauses.push({ "aiMetadata.moods": { $in: ["sad", "melancholic"] } });
    } else if (taste.mood === "energy") {
      clauses.push({
        $or: [
          { "aiMetadata.moods": { $in: ["energetic", "uplifting"] } },
          { "aiMetadata.contexts": "gym" },
        ],
      });
    }
    const blockedIds = objectIds([...exclude], 80);
    if (blockedIds.length) clauses.push({ _id: { $nin: blockedIds } });

    const tracks = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
        ...(clauses.length ? { $and: clauses } : {}),
      })
        .select(RECOMMEND_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort(lifetimePlayCountWithReleaseSort())
        .limit(Math.max(limit, 1))
        .lean(),
    );
    const reason = this.tasteReason(taste);
    return tagTracks(tracks, reason.code, reason.text);
  }

  private matchesTaste(track: TrackDoc, taste?: ForMeTaste): boolean {
    if (!taste || (!taste.genreIds?.length && !taste.mood)) return true;
    if (taste.genreIds?.length) {
      const wanted = new Set(taste.genreIds);
      const ids = (track.genres ?? []).map((genre) =>
        typeof genre === "object" ? (genre._id?.toString() ?? "") : String(genre),
      );
      if (!ids.some((id) => wanted.has(id))) return false;
    }
    if (!taste.mood) return true;
    const moods: string[] = track.aiMetadata?.moods ?? [];
    const contexts: string[] = track.aiMetadata?.contexts ?? [];
    if (taste.mood === "focus") {
      return moods.some((mood) => mood === "chill" || mood === "peaceful")
        || contexts.some((context) => context === "study" || context === "meditation");
    }
    if (taste.mood === "sad") {
      return moods.some((mood) => mood === "sad" || mood === "melancholic");
    }
    return moods.some((mood) => mood === "energetic" || mood === "uplifting")
      || contexts.includes("gym");
  }

  private tasteReason(taste: ForMeTaste): { code: RecommendReasonCode; text: string } {
    if (taste.mood === "focus") return { code: "mood", text: "Để tập trung" };
    if (taste.mood === "sad") return { code: "mood", text: "Khi bạn buồn" };
    if (taste.mood === "energy") return { code: "mood", text: "Năng lượng cao" };
    return { code: "genre", text: "Cùng thể loại bạn chọn" };
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
    taste?: TasteScores,
    blocked?: Set<string>,
  ): Promise<TrackDoc[]> {
    if (limit <= 0) return [];
    const { scoreMap } = taste ?? (await this.loadTasteScores(userId));

    if (scoreMap.size === 0) {
      return tagTracks(
        await this.getTrendingTracks(limit, userId),
        "trending",
        "Đang được nghe nhiều",
      ).filter((track) => !blocked?.has(track._id.toString()));
    }

    // ── Step B: Lookup genres & artists từ các track đã tương tác ────────────
    const interactedIds = [...scoreMap.keys()]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const interactedTracks: Array<{
      _id: Types.ObjectId;
      genres: Types.ObjectId[];
      artist: Types.ObjectId;
      aiMetadata?: any;
    }> = await Track.find({ _id: { $in: interactedIds }, isDeleted: false })
      .select("genres artist aiMetadata")
      .lean();

    // ── Step C: Tổng hợp top genres & top artists & top moods ──────────────
    const genreWeight = new Map<string, number>();
    const artistWeight = new Map<string, number>();
    const moodWeight = new Map<string, number>();
    let totalEnergy = 0;
    let energyWeightSum = 0;

    for (const track of interactedTracks) {
      const weight = scoreMap.get(track._id.toString()) ?? 1;

      for (const genreId of track.genres ?? []) {
        const gid = genreId.toString();
        genreWeight.set(gid, (genreWeight.get(gid) ?? 0) + weight);
      }

      const aid = track.artist.toString();
      artistWeight.set(aid, (artistWeight.get(aid) ?? 0) + weight);

      for (const mood of track.aiMetadata?.moods ?? []) {
        moodWeight.set(mood, (moodWeight.get(mood) ?? 0) + weight);
      }

      if (typeof track.aiMetadata?.energy === "number") {
        totalEnergy += track.aiMetadata.energy * weight;
        energyWeightSum += weight;
      }
    }

    const avgEnergy = energyWeightSum > 0 ? totalEnergy / energyWeightSum : 0.5;

    // Lấy top 5 genres, top 3 artists, top 5 moods
    const topGenreIds = this.topEntries(genreWeight, 5).map(
      (id) => new Types.ObjectId(id),
    );
    const topArtistIds = this.topEntries(artistWeight, 3).map(
      (id) => new Types.ObjectId(id),
    );
    const topMoods = this.topEntries(moodWeight, 5);

    // ── Step D: Tìm candidates ────────────────────────────────────────────────
    // Loại bỏ:
    //   - Bài đã tương tác (đã nghe / đã like)
    //   - Bài đang bị xóa hoặc chưa ready
    //   - excludeTrackId (nếu có)
    const excludeIds: Types.ObjectId[] = [...interactedIds];
    if (excludeTrackId && Types.ObjectId.isValid(excludeTrackId)) {
      excludeIds.push(new Types.ObjectId(excludeTrackId));
    }
    blocked?.forEach((id) => {
      if (Types.ObjectId.isValid(id)) excludeIds.push(new Types.ObjectId(id));
    });

    if (
      topGenreIds.length === 0 &&
      topArtistIds.length === 0 &&
      topMoods.length === 0
    ) {
      return [];
    }

    // Lấy nhiều hơn limit để còn chỗ cho Discovery Mix
    const fetchLimit = Math.min(Math.max(limit, 1) * 4, 200);

    const candidates = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
        _id: { $nin: excludeIds },
        $or: [
          { genres: { $in: topGenreIds } },
          { artist: { $in: topArtistIds } },
          { "aiMetadata.moods": { $in: topMoods } },
        ],
      })
        .select(RECOMMEND_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(fetchLimit)
        .lean(),
    );

    // ── Step E: Re-score candidates theo mức độ overlap genre/artist/mood ─────────
    const genreWeightTotal = [...genreWeight.values()].reduce(
      (a, b) => a + b,
      0,
    );
    const artistWeightTotal = [...artistWeight.values()].reduce(
      (a, b) => a + b,
      0,
    );
    const moodWeightTotal = [...moodWeight.values()].reduce(
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

      // Mood match bonus
      for (const mood of track.aiMetadata?.moods ?? []) {
        const w = moodWeight.get(mood) ?? 0;
        relevance += moodWeightTotal > 0 ? (w / moodWeightTotal) * 0.4 : 0;
      }

      // Energy similarity bonus
      if (typeof track.aiMetadata?.energy === 'number' && energyWeightSum > 0) {
        const energyDiff = Math.abs(track.aiMetadata.energy - avgEnergy);
        relevance += (1 - energyDiff) * 0.2; // Bonus up to 0.2 for close energy
      }

      // Context time-aware bonus
      const currentHour = new Date().getHours();
      if (track.aiMetadata?.contexts?.length) {
        if (currentHour >= 22 || currentHour < 5) {
          if (track.aiMetadata.contexts.includes('sleep') || track.aiMetadata.contexts.includes('chill')) {
            relevance += 0.15;
          }
        } else if (currentHour >= 5 && currentHour < 9) {
          if (track.aiMetadata.contexts.includes('morning') || track.aiMetadata.contexts.includes('energetic')) {
            relevance += 0.15;
          }
        }
      }

      // Popularity boost (log scale để tránh bias quá lớn)
      const popularityBonus = Math.log1p(track.playCount ?? 0) * 0.01;
      const explanation = this.explainCandidate(
        track,
        genreWeight,
        artistWeight,
        moodWeight,
      );

      return {
        ...track,
        score: relevance + popularityBonus,
        reason: explanation.reason,
        reasonCode: explanation.reasonCode,
      };
    });

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Dedup & slice
    return deduplicateTracks(scored).slice(0, limit);
  }

  private async loadTasteScores(userId: string): Promise<TasteScores> {
    const userObjId = new Types.ObjectId(userId);
    const playLogScores: Array<{ trackId: Types.ObjectId; score: number }> =
      await PlayLog.aggregate([
        { $match: { userId: userObjId } },
        {
          $addFields: {
            daysAgo: {
              $divide: [
                { $subtract: [new Date(), "$listenedAt"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $addFields: {
            decayWeight: { $exp: { $multiply: [-0.1, "$daysAgo"] } },
          },
        },
        {
          $group: {
            _id: "$trackId",
            score: { $sum: "$decayWeight" },
          },
        },
        {
          $project: {
            trackId: "$_id",
            score: 1,
            _id: 0,
          },
        },
      ]);

    const likedTracks: Array<{ targetId: Types.ObjectId }> = await Like.find({
      userId: userObjId,
      targetType: "track",
    })
      .select("targetId")
      .lean();

    const scoreMap = new Map<string, number>();
    for (const { trackId, score } of playLogScores) {
      scoreMap.set(trackId.toString(), score);
    }
    const likedIds = new Set<string>();
    for (const { targetId } of likedTracks) {
      const id = targetId.toString();
      likedIds.add(id);
      scoreMap.set(id, (scoreMap.get(id) ?? 0) + LIKE_WEIGHT);
    }
    return { scoreMap, likedIds };
  }

  private async getFamiliarTracks(
    userId: string,
    limit: number,
    excludeTrackId?: string,
    taste?: TasteScores,
    blocked?: Set<string>,
  ): Promise<TrackDoc[]> {
    if (limit <= 0) return [];
    const { scoreMap, likedIds } = taste ?? (await this.loadTasteScores(userId));
    if (scoreMap.size === 0) return [];

    const rankedIds = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .filter(
        (id) =>
          id !== excludeTrackId &&
          !blocked?.has(id) &&
          Types.ObjectId.isValid(id),
      )
      .slice(0, Math.max(limit * 4, limit));

    if (rankedIds.length === 0) return [];

    const tracks = castLean(
      await Track.find({
        _id: { $in: rankedIds.map((id) => new Types.ObjectId(id)) },
        isDeleted: false,
        isPublic: true,
        status: "ready",
      })
        .select(RECOMMEND_SELECT)
        .populate(TRACK_POPULATE as any)
        .lean(),
    );

    const order = new Map(rankedIds.map((id, index) => [id, index]));
    tracks.sort(
      (a, b) =>
        (order.get(a._id.toString()) ?? 999) -
        (order.get(b._id.toString()) ?? 999),
    );

    return tracks.slice(0, limit).map((track) => {
      const liked = likedIds.has(track._id.toString());
      return {
        ...track,
        reasonCode: "familiar" as const,
        reason: liked ? "Vì bạn đã thích" : "Vì bạn nghe gần đây",
      };
    });
  }

  private explainCandidate(
    track: TrackDoc,
    genreWeight: Map<string, number>,
    artistWeight: Map<string, number>,
    moodWeight: Map<string, number>,
  ): { reason: string; reasonCode: RecommendReasonCode } {
    const artistW = artistWeight.get(artistKeyOf(track)) ?? 0;
    let bestGenre = 0;
    for (const genre of track.genres ?? []) {
      const genreId =
        typeof genre === "object" ? (genre._id?.toString() ?? "") : String(genre);
      bestGenre = Math.max(bestGenre, genreWeight.get(genreId) ?? 0);
    }
    let bestMood = 0;
    for (const mood of track.aiMetadata?.moods ?? []) {
      bestMood = Math.max(bestMood, moodWeight.get(mood) ?? 0);
    }

    if (artistW > 0 && artistW >= bestGenre && artistW >= bestMood) {
      const name = artistNameOf(track);
      return {
        reasonCode: "artist",
        reason: name ? `Vì bạn nghe ${name}` : "Vì nghệ sĩ bạn hay nghe",
      };
    }
    if (bestMood > 0 && bestMood >= bestGenre) {
      return { reasonCode: "mood", reason: "Cùng tâm trạng bạn hay nghe" };
    }
    return { reasonCode: "genre", reason: "Cùng thể loại bạn hay nghe" };
  }

  private arrangeForMe(
    familiar: TrackDoc[],
    similar: TrackDoc[],
    discovery: TrackDoc[],
  ): TrackDoc[] {
    const interleaved: TrackDoc[] = [];
    const span = Math.max(familiar.length, similar.length);
    for (let i = 0; i < span; i += 1) {
      if (i < familiar.length) interleaved.push(familiar[i]);
      if (i < similar.length) interleaved.push(similar[i]);
    }
    return this.capArtistSpread(
      deduplicateTracks(this.injectDiscovery(interleaved, discovery)),
    );
  }

  /** Tối đa 2 bài liên tiếp cùng nghệ sĩ, và một nghệ sĩ không quá 20% danh sách. */
  private capArtistSpread(tracks: TrackDoc[]): TrackDoc[] {
    const maxConsecutive = 2;
    const maxShare = Math.max(maxConsecutive, Math.ceil(tracks.length * 0.2));
    const result: TrackDoc[] = [];
    const pending = [...tracks];
    const counts = new Map<string, number>();

    const canPlace = (track: TrackDoc) => {
      const key = artistKeyOf(track);
      if ((counts.get(key) ?? 0) >= maxShare) return false;
      let run = 0;
      for (let i = result.length - 1; i >= 0 && run < maxConsecutive; i -= 1) {
        if (artistKeyOf(result[i]) !== key) break;
        run += 1;
      }
      return run < maxConsecutive;
    };

    let guard = pending.length * pending.length + 1;
    while (pending.length > 0 && guard > 0) {
      guard -= 1;
      const index = pending.findIndex((track) => canPlace(track));
      if (index === -1) break;
      const [track] = pending.splice(index, 1);
      result.push(track);
      const key = artistKeyOf(track);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return result;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TIER 2 – TRENDING (Cold-start / Guest)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Trả về các bài hát trending trong 7 ngày gần đây.
   * PlayLog giữ 30 ngày cho thống kê tháng. Trending không lấy cả cửa sổ đó.
   *
   * Nếu userId được cung cấp, sẽ loại bỏ các bài user đã nghe.
   */
  private async getTrendingTracks(
    limit: number,
    userId?: string,
  ): Promise<TrackDoc[]> {
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

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
          .select(RECOMMEND_SELECT)
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
        .select(RECOMMEND_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort(lifetimePlayCountWithReleaseSort())
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
        .select(RECOMMEND_SELECT)
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
   *   1. Lấy genres, artist, và aiMetadata (moods, energy) của track gốc.
   *   2. Tìm các bài hát có cùng artist, hoặc chung genres, hoặc chung moods.
   *   3. Chấm điểm (re-score) các bài hát ứng viên dựa trên độ tương đồng:
   *      - Trùng artist: +0.3
   *      - Trùng thể loại: cộng điểm theo tỉ lệ trùng khớp
   *      - Trùng mood: cộng điểm theo tỉ lệ trùng khớp
   *      - Energy: thưởng điểm nếu energy gần nhau
   *      - Độ phổ biến: thưởng điểm nhẹ dựa vào playCount
   *   4. Sắp xếp và trả về danh sách.
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
      .select("genres artist aiMetadata")
      .lean();

    if (!source) return [];

    const artistId = source.artist;
    const genreIds = source.genres ?? [];
    const sourceMoods = source.aiMetadata?.moods ?? [];
    const sourceEnergy = source.aiMetadata?.energy;
    
    const excludeId = new Types.ObjectId(trackId);

    // Lấy pool ứng viên (nhiều hơn limit để re-score)
    const fetchLimit = limit * 5;

    const orConditions: any[] = [];
    if (artistId) orConditions.push({ artist: artistId });
    if (genreIds.length > 0) orConditions.push({ genres: { $in: genreIds } });
    if (sourceMoods.length > 0) orConditions.push({ "aiMetadata.moods": { $in: sourceMoods } });

    // Nếu không có điều kiện nào (bài hát không có artist, genre, mood), fallback về bài hot
    if (orConditions.length === 0) {
       return this.getTrendingTracks(limit);
    }

    const candidates = castLean(
      await Track.find({
        isDeleted: false,
        isPublic: true,
        status: "ready",
        _id: { $ne: excludeId },
        $or: orConditions,
      })
        .select(RECOMMEND_SELECT)
        .populate(TRACK_POPULATE as any)
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(fetchLimit)
        .lean()
    );

    // Re-score candidates
    const scored = candidates.map((track) => {
      let relevance = 0;

      // 1. Artist Match
      const tArtistId = track.artist && typeof track.artist === "object"
          ? (track.artist._id?.toString() ?? "")
          : (track.artist?.toString() ?? "");
      const sArtistId = artistId?.toString() ?? "";
      if (sArtistId && tArtistId === sArtistId) {
        relevance += 0.3;
      }

      // 2. Genre Overlap
      const tGenres = track.genres?.map(g => typeof g === "object" ? (g._id?.toString() ?? "") : g.toString()) ?? [];
      const sGenres = genreIds.map((g: any) => g.toString());
      if (sGenres.length > 0 && tGenres.length > 0) {
        const overlap = sGenres.filter(g => tGenres.includes(g)).length;
        relevance += (overlap / Math.max(sGenres.length, tGenres.length)) * 0.25;
      }

      // 3. Mood Overlap
      const tMoods = track.aiMetadata?.moods ?? [];
      if (sourceMoods.length > 0 && tMoods.length > 0) {
        const overlap = sourceMoods.filter((m: string) => tMoods.includes(m)).length;
        relevance += (overlap / Math.max(sourceMoods.length, tMoods.length)) * 0.25;
      }

      // 4. Energy Similarity
      if (typeof sourceEnergy === 'number' && typeof track.aiMetadata?.energy === 'number') {
        const diff = Math.abs(sourceEnergy - track.aiMetadata.energy);
        relevance += (1 - diff) * 0.15;
      }

      // 5. Popularity Boost
      const popularityBonus = Math.log1p(track.playCount ?? 0) * 0.01;

      return { ...track, score: relevance + popularityBonus };
    });

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const combined = deduplicateTracks(scored).slice(0, limit);

    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(combined), "EX", ttl),
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
      .select(RECOMMEND_SELECT)
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
          .sort(lifetimePlayCountSort())
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GET RECOMMENDED ALBUMS
  // ─────────────────────────────────────────────────────────────────────────────

  async getRecommendedAlbums(userId: string | null, limit: number): Promise<any[]> {
    if (!isRecommendationUserId(userId)) return this.getTrendingAlbums(limit);
    const cacheKey = `recommend:albums:${userId}:limit${limit}`;
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const userObjId = new mongoose.Types.ObjectId(userId);

    const playLogScores = await PlayLog.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: "$trackId", score: { $sum: 1 } } },
    ]);
    const likedTracks = await Like.find({
      userId: userObjId,
      targetType: "track",
    })
      .select("targetId")
      .lean();

    const scoreMap = new Map<string, number>();
    for (const { _id, score } of playLogScores)
      scoreMap.set(_id.toString(), score);
    for (const { targetId } of likedTracks)
      scoreMap.set(
        targetId.toString(),
        (scoreMap.get(targetId.toString()) ?? 0) + LIKE_WEIGHT,
      );

    const interactedIds = [...scoreMap.keys()].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const interactedTracks = await Track.find({
      _id: { $in: interactedIds },
      isDeleted: false,
    })
      .select("genres artist")
      .lean();

    const artistWeight = new Map<string, number>();

    for (const track of interactedTracks) {
      const weight = scoreMap.get(track._id.toString()) ?? 1;
      if (track.artist) {
        const aid = track.artist.toString();
        artistWeight.set(aid, (artistWeight.get(aid) ?? 0) + weight);
      }
    }

    const topArtistIds = this.topEntries(artistWeight, 5).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const likedAlbums = await Like.find({
      userId: userObjId,
      targetType: "album",
    })
      .select("targetId")
      .lean();
    const excludeIds = likedAlbums.map((l) => l.targetId);

    let candidates = await Album.find({
      isDeleted: false,
      isPublic: true,
      _id: { $nin: excludeIds },
      artist: { $in: topArtistIds },
    })
      .sort({ playCount: -1, releaseDate: -1 })
      .limit(limit * 2)
      .populate("artist", "name slug avatar")
      .lean();

    if (candidates.length < limit) {
      const needed = limit - candidates.length;
      const extra = await Album.find({
        isDeleted: false,
        isPublic: true,
        _id: { $nin: [...excludeIds, ...candidates.map((c) => c._id)] },
      })
        .sort({ playCount: -1, releaseDate: -1 })
        .limit(needed)
        .populate("artist", "name slug avatar")
        .lean();
      candidates = [...candidates, ...extra];
    }

    const result = shuffleArray(candidates).slice(0, limit);
    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch(() => {});
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. GET RECOMMENDED PLAYLISTS
  // ─────────────────────────────────────────────────────────────────────────────

  async getRecommendedPlaylists(userId: string | null, limit: number): Promise<any[]> {
    if (!isRecommendationUserId(userId)) return this.getTrendingPlaylists(limit);
    const cacheKey = `recommend:playlists:${userId}:limit${limit}`;
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const userObjId = new mongoose.Types.ObjectId(userId);
    const likedPlaylists = await Like.find({
      userId: userObjId,
      targetType: "playlist",
    })
      .select("targetId")
      .lean();
    const excludeIds = likedPlaylists.map((l) => l.targetId);

    const result = await Playlist.find({
      visibility: "public",
      isDeleted: false,
      user: { $ne: userObjId },
      _id: { $nin: excludeIds },
    })
      .sort({ playCount: -1 })
      .limit(limit)
      .populate("user", "username displayName avatar")
      .lean();

    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch(() => {});
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. TRENDING ALBUMS & PLAYLISTS
  // ─────────────────────────────────────────────────────────────────────────────

  async getTrendingAlbums(limit: number): Promise<any[]> {
    const cacheKey = `chart:trending:albums:limit${limit}`;
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const result = await Album.find({ isPublic: true, isDeleted: false })
      .sort({ playCount: -1, releaseDate: -1 })
      .limit(limit)
      .populate("artist", "name slug avatar")
      .lean();

    const ttl = 3600;
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch(() => {});
    return result;
  }

  async getTrendingPlaylists(limit: number): Promise<any[]> {
    const cacheKey = `chart:trending:playlists:limit${limit}`;
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const result = await Playlist.find({
      visibility: "public",
      isDeleted: false,
    })
      .sort({ playCount: -1 })
      .limit(limit)
      .populate("user", "username displayName avatar")
      .lean();

    const ttl = 3600;
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(result), "EX", ttl),
    ).catch(() => {});
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. GET FOR YOU FEED (70% Tracks, 15% Albums, 15% Playlists)
  // ─────────────────────────────────────────────────────────────────────────────

  async getForYouFeed(
    userId: string | undefined | null,
    limit: number = 20,
  ): Promise<any[]> {
    const realUserId = isRecommendationUserId(userId) ? userId : null;
    const cacheKey = `recommend:foryou:${realUserId ?? "guest"}:v2:limit${limit}`;
    try {
      const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
      if (cached) return JSON.parse(cached as string);
    } catch {}

    const numTracks = Math.ceil(limit * 0.7);
    const numAlbums = Math.floor(limit * 0.15);
    const numPlaylists = limit - numTracks - numAlbums;

    const [tracks, albums, playlists] = await Promise.all([
      this.getRecommendedTracks(realUserId, { limit: numTracks }),
      realUserId
        ? this.getRecommendedAlbums(realUserId, numAlbums)
        : this.getTrendingAlbums(numAlbums),
      realUserId
        ? this.getRecommendedPlaylists(realUserId, numPlaylists)
        : this.getTrendingPlaylists(numPlaylists),
    ]);

    const feed: any[] = [];

    tracks.forEach((t) =>
      feed.push({
        type: "track",
        data: t,
        reason: t.reason || "Đang được nghe nhiều",
      }),
    );
    albums.forEach((a) =>
      feed.push({
        type: "album",
        data: a,
        reason: "Album gợi ý cho bạn",
      }),
    );
    playlists.forEach((p) =>
      feed.push({
        type: "playlist",
        data: p,
        reason: "Playlist nổi bật",
      }),
    );

    const shuffledFeed = shuffleArray(feed);

    const ttl = CACHE_TTL_BASE + Math.floor(Math.random() * CACHE_TTL_JITTER);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(shuffledFeed), "EX", ttl),
    ).catch(() => {});

    return shuffledFeed;
  }
}

export default new RecommendationService();
