import mongoose from "mongoose";
import geoip from "geoip-lite";
import { cacheRedis } from "../config/redis";
import PlayLog from "../models/PlayLog";
import Track from "../models/Track";
import logger from "../utils/logger";

const SESSION_TTL_SECONDS = 60;
const HOUR_TTL_SECONDS = 26 * 60 * 60;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const SOCKETS_KEY = "analytics:sockets";
const ONLINE_KEY = "online_users";

const PRIVATE_IP_RE =
  /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::ffff:127\.|fe80:)/i;

const isValidMongoId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const isValidUserId = (id: string) =>
  isValidMongoId(id) || id.startsWith("guest_");

export function trendingHourKey(now = new Date()): string {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  const date = shifted.toISOString().slice(0, 10);
  const hour = shifted.toISOString().slice(11, 13);
  return `trending:${date}-${hour}`;
}

function sessionKey(socketId: string): string {
  return `analytics:session:${socketId}`;
}

function userSocketsKey(userId: string): string {
  return `analytics:user-sockets:${userId}`;
}

function resolveCountry(ip: string): string {
  if (!ip || PRIVATE_IP_RE.test(ip)) return "";
  const geo = geoip.lookup(ip);
  return geo?.country ?? "";
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["vi"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export interface AnalyticsTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist: { _id: string; name: string; avatar?: string } | null;
  score: number;
}

export interface AnalyticsGeo {
  id: string;
  name: string;
  value: number;
}

export interface AnalyticsStats {
  activeUsers: number;
  activeGuests: number;
  listeningNow: number;
  playsThisHour: number;
  nowListening: AnalyticsTrack[];
  trending: AnalyticsTrack[];
  geoData: AnalyticsGeo[];
  snapshotAt: string;
}

export interface AnalyticsSessionInput {
  socketId: string;
  userId: string;
  trackId?: string;
  ip: string;
}

interface LiveSession {
  socketId: string;
  userId: string;
  trackId: string;
  country: string;
}

interface PopulatedTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist: AnalyticsTrack["artist"];
}

function readArtist(artist: unknown): AnalyticsTrack["artist"] {
  if (!artist || typeof artist !== "object") return null;
  const row = artist as { _id?: { toString(): string } | string; name?: string; avatar?: string };
  if (!row.name || row._id == null) return null;
  const id = typeof row._id === "string" ? row._id : row._id.toString();
  return { _id: id, name: row.name, avatar: row.avatar };
}

class AnalyticsService {
  /**
   * Presence lives on Redis session hashes. This method does not start a
   * process-local flush loop.
   */
  async init(): Promise<void> {}

  async touchSession(input: AnalyticsSessionInput): Promise<void> {
    const { socketId, userId } = input;
    if (!socketId || !userId || !isValidUserId(userId)) return;

    const trackId =
      input.trackId && isValidMongoId(input.trackId) ? input.trackId : "";
    const country = resolveCountry(input.ip);
    const key = sessionKey(socketId);

    try {
      const previousUserId = await cacheRedis.hget(key, "userId");
      const pipeline = cacheRedis.pipeline();
      pipeline.hset(key, {
        userId,
        trackId,
        seenAt: Date.now().toString(),
      });
      if (country) pipeline.hset(key, "country", country);
      pipeline.expire(key, SESSION_TTL_SECONDS);
      pipeline.sadd(SOCKETS_KEY, socketId);
      pipeline.sadd(userSocketsKey(userId), socketId);
      pipeline.zadd(ONLINE_KEY, Date.now(), userId);
      if (previousUserId && previousUserId !== userId) {
        pipeline.srem(userSocketsKey(previousUserId), socketId);
      }
      await pipeline.exec();
      if (previousUserId && previousUserId !== userId) {
        await this.releaseUserIfNoLiveSockets(previousUserId);
      }
    } catch (error) {
      logger.error("[Analytics] session update failed", { error });
    }
  }

  async endSession(socketId: string, userId?: string): Promise<void> {
    if (!socketId) return;
    const key = sessionKey(socketId);
    try {
      const stored =
        userId || (await cacheRedis.hget(key, "userId")) || "";
      const pipeline = cacheRedis.pipeline();
      pipeline.del(key);
      pipeline.srem(SOCKETS_KEY, socketId);
      if (stored) pipeline.srem(userSocketsKey(stored), socketId);
      await pipeline.exec();
      if (stored) await this.releaseUserIfNoLiveSockets(stored);
    } catch (error) {
      logger.error("[Analytics] session end failed", { error });
    }
  }

  async recordHourPlay(trackId: string, now = new Date()): Promise<void> {
    if (!trackId || !isValidMongoId(trackId)) return;
    const key = trendingHourKey(now);
    const pipeline = cacheRedis.pipeline();
    pipeline.zincrby(key, 1, trackId);
    pipeline.expire(key, HOUR_TTL_SECONDS);
    await pipeline.exec();
  }

  async getStats(now = new Date()): Promise<AnalyticsStats> {
    const sessions = await this.readLiveSessions();
    const hourKey = trendingHourKey(now);
    const hourRaw = (await cacheRedis.zrevrange(
      hourKey,
      0,
      -1,
      "WITHSCORES",
    )) as string[];
    const hourScores = parseScoreList(hourRaw);
    const playsThisHour = hourScores.reduce((sum, row) => sum + row.score, 0);

    const users = new Map<string, { trackIds: Set<string>; country: string }>();
    for (const session of sessions) {
      if (!isValidUserId(session.userId)) continue;
      let entry = users.get(session.userId);
      if (!entry) {
        entry = { trackIds: new Set(), country: "" };
        users.set(session.userId, entry);
      }
      if (session.trackId && isValidMongoId(session.trackId)) {
        entry.trackIds.add(session.trackId);
      }
      if (!entry.country && session.country) entry.country = session.country;
    }

    let activeUsers = 0;
    let activeGuests = 0;
    let listeningNow = 0;
    const nowListening = new Map<string, Set<string>>();
    const geo = new Map<string, Set<string>>();

    for (const [userId, entry] of users) {
      if (userId.startsWith("guest_")) activeGuests += 1;
      else activeUsers += 1;
      if (entry.trackIds.size > 0) listeningNow += 1;
      for (const trackId of entry.trackIds) {
        let listeners = nowListening.get(trackId);
        if (!listeners) {
          listeners = new Set();
          nowListening.set(trackId, listeners);
        }
        listeners.add(userId);
      }
      if (entry.country) {
        let countries = geo.get(entry.country);
        if (!countries) {
          countries = new Set();
          geo.set(entry.country, countries);
        }
        countries.add(userId);
      }
    }

    const nowRows = topCounts(nowListening, 5);
    const trendRows = hourScores.slice(0, 5);
    const populated = await this.populateTracks([
      ...new Map(
        [...nowRows, ...trendRows].map((row) => [row.id, row.score]),
      ).entries(),
    ].map(([id, score]) => ({ id, score })));

    return {
      activeUsers,
      activeGuests,
      listeningNow,
      playsThisHour,
      nowListening: attachScores(populated, nowRows),
      trending: attachScores(populated, trendRows),
      geoData: [...geo.entries()]
        .map(([id, set]) => ({
          id,
          name: countryName(id),
          value: set.size,
        }))
        .sort((a, b) => b.value - a.value),
      snapshotAt: new Date().toISOString(),
    };
  }

  private async readLiveSessions(): Promise<LiveSession[]> {
    const socketIds = await cacheRedis.smembers(SOCKETS_KEY);
    if (socketIds.length === 0) return [];

    const pipeline = cacheRedis.pipeline();
    for (const socketId of socketIds) {
      pipeline.hgetall(sessionKey(socketId));
    }
    const results = await pipeline.exec();
    const live: LiveSession[] = [];
    const stale: string[] = [];

    socketIds.forEach((socketId, index) => {
      const hash = (results?.[index]?.[1] ?? null) as Record<string, string> | null;
      if (!hash?.userId) {
        stale.push(socketId);
        return;
      }
      live.push({
        socketId,
        userId: hash.userId,
        trackId: hash.trackId ?? "",
        country: hash.country ?? "",
      });
    });

    if (stale.length > 0) {
      await cacheRedis.srem(SOCKETS_KEY, ...stale);
    }
    return live;
  }

  private async releaseUserIfNoLiveSockets(userId: string): Promise<void> {
    const sockets = await cacheRedis.smembers(userSocketsKey(userId));
    if (sockets.length === 0) {
      await cacheRedis.del(userSocketsKey(userId));
      await cacheRedis.zrem(ONLINE_KEY, userId);
      return;
    }

    const pipeline = cacheRedis.pipeline();
    for (const socketId of sockets) pipeline.exists(sessionKey(socketId));
    const results = await pipeline.exec();
    const dead: string[] = [];
    sockets.forEach((socketId, index) => {
      const exists = Number(results?.[index]?.[1] ?? 0);
      if (exists === 0) dead.push(socketId);
    });
    if (dead.length > 0) {
      await cacheRedis.srem(userSocketsKey(userId), ...dead);
    }
    if (dead.length === sockets.length) {
      await cacheRedis.del(userSocketsKey(userId));
      await cacheRedis.zrem(ONLINE_KEY, userId);
    }
  }

  private async populateTracks(
    rows: Array<{ id: string; score: number }>,
  ): Promise<Map<string, PopulatedTrack>> {
    const ids = rows.map((row) => row.id).filter(isValidMongoId);
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const tracks = await Track.find({ _id: { $in: unique } })
      .select("title coverImage artist")
      .populate("artist", "name avatar")
      .lean<Array<{
        _id: { toString(): string };
        title?: string;
        coverImage?: string;
        artist?: unknown;
      }>>();

    const populated = new Map<string, PopulatedTrack>();
    for (const track of tracks) {
      const id = track._id.toString();
      populated.set(id, {
        _id: id,
        title: track.title ?? "",
        coverImage: track.coverImage ?? "",
        artist: readArtist(track.artist),
      });
    }
    return populated;
  }

  async getUserMusicSummary(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const stats = await PlayLog.aggregate([
      { $match: { userId: userObjectId } },
      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track",
        },
      },
      { $unwind: { path: "$track", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          playCount: { $sum: 1 },
          uniqueArtists: { $addToSet: "$track.artist" },
          totalSeconds: { $sum: { $ifNull: ["$track.duration", 0] } },
        },
      },
    ]);

    const result = stats[0] ?? {
      playCount: 0,
      uniqueArtists: [],
      totalSeconds: 0,
    };
    const artists = Array.isArray(result.uniqueArtists) ? result.uniqueArtists : [];
    const artistCount = artists.filter(Boolean).length;

    return {
      playCount: result.playCount,
      artistCount,
      totalMinutes: Math.round((result.totalSeconds ?? 0) / 60),
    };
  }

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

function parseScoreList(list: string[]): Array<{ id: string; score: number }> {
  const rows: Array<{ id: string; score: number }> = [];
  for (let i = 0; i < list.length; i += 2) {
    const id = list[i];
    if (!id || !isValidMongoId(id)) continue;
    rows.push({ id, score: Number.parseInt(list[i + 1], 10) || 0 });
  }
  return rows;
}

function topCounts(
  groups: Map<string, Set<string>>,
  limit: number,
): Array<{ id: string; score: number }> {
  return [...groups.entries()]
    .map(([id, set]) => ({ id, score: set.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function attachScores(
  populated: Map<string, PopulatedTrack>,
  rows: Array<{ id: string; score: number }>,
): AnalyticsTrack[] {
  const result: AnalyticsTrack[] = [];
  for (const row of rows) {
    const track = populated.get(row.id);
    if (!track) continue;
    result.push({ ...track, score: row.score });
  }
  return result;
}

const analyticsService = new AnalyticsService();
export default analyticsService;
