import { subDays, format } from "date-fns";
import { cacheRedis, queueRedis } from "../config/redis";
import User from "../models/User";
import Track from "../models/Track";
import Album from "../models/Album";
import { DashboardData } from "../dtos/dashboard.dto";
import {
  calculateGrowth,
  fillMissingDates,
  formatBytes,
  calculatePercent,
} from "../utils/helper";
import { audioQueue } from "../queue/processTrack.queue";
import { getActiveNowCount } from "../socket";

// --- CONFIGURATION ---
const DASHBOARD_CACHE_TTL = 600; // 10 phút
const DASHBOARD_STALE_TTL = 86400; // 24 giờ (stale window)
const CACHE_STALE_KEY_SUFFIX = ":stale";

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 1: STALE-WHILE-REVALIDATE
// Trả về data cũ ngay lập tức, kick off revalidation ngầm ở background.
// Admin không bao giờ phải đợi cold-cache miss.
// ─────────────────────────────────────────────────────────────────────────────
const revalidatingKeys = new Set<string>();

async function getWithSWR<T>(
  cacheKey: string,
  freshTTL: number,
  staleTTL: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; isStale: boolean }> {
  const staleKey = cacheKey + CACHE_STALE_KEY_SUFFIX;

  try {
    // 1. Thử lấy data "fresh" (còn trong TTL chính)
    const fresh = await cacheRedis.get(cacheKey);
    if (fresh) return { data: JSON.parse(fresh), isStale: false };

    // 2. Nếu fresh hết hạn, thử lấy data "stale" (backup window)
    const stale = await cacheRedis.get(staleKey);
    if (stale) {
      // Kick off revalidation trong background (fire-and-forget)
      if (!revalidatingKeys.has(cacheKey)) {
        revalidatingKeys.add(cacheKey);
        fetcher()
          .then(async (newData) => {
            const serialized = JSON.stringify(newData);
            await Promise.all([
              cacheRedis.setex(cacheKey, freshTTL, serialized),
              cacheRedis.setex(staleKey, staleTTL, serialized),
            ]);
          })
          .catch((err) =>
            console.error(
              `[SWR] Background revalidation failed for ${cacheKey}:`,
              err,
            ),
          )
          .finally(() => revalidatingKeys.delete(cacheKey));
      }
      return { data: JSON.parse(stale), isStale: true };
    }
  } catch (err) {
    console.error("[SWR] Cache read error:", err);
  }

  // 3. Cache miss hoàn toàn → fetch mới và lưu cả hai key
  console.log(`[SWR] Full cache miss for ${cacheKey}`);
  const freshData = await fetcher();
  const serialized = JSON.stringify(freshData);

  await Promise.all([
    cacheRedis.setex(cacheKey, freshTTL, serialized).catch(() => {}),
    cacheRedis.setex(staleKey, staleTTL, serialized).catch(() => {}),
  ]);

  return { data: freshData, isStale: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 2: COUNTER PATTERN (đọc từ Redis thay vì COUNT DB)
// Được update bởi counter.helper.ts mỗi khi có event xảy ra.
// ─────────────────────────────────────────────────────────────────────────────
const COUNTER_KEYS = {
  totalUsers: "stats:total_users",
  totalTracks: "stats:total_tracks",
  totalAlbums: "stats:total_albums",
  totalPlays: "stats:total_plays",
  audioBytes: "stats:storage:audio_bytes",
  imageBytes: "stats:storage:image_bytes",
} as const;

async function getCounters() {
  const vals = await cacheRedis.mget(
    COUNTER_KEYS.totalUsers,
    COUNTER_KEYS.totalTracks,
    COUNTER_KEYS.totalAlbums,
    COUNTER_KEYS.totalPlays,
    COUNTER_KEYS.audioBytes,
    COUNTER_KEYS.imageBytes,
  );

  const parse = (v: string | null, fallback = 0) =>
    v ? parseInt(v, 10) : fallback;

  return {
    totalUsers: parse(vals[0]),
    totalTracks: parse(vals[1]),
    totalAlbums: parse(vals[2]),
    totalPlays: parse(vals[3]),
    audioBytes: parse(vals[4]),
    imageBytes: parse(vals[5]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 3: STORAGE VELOCITY (tính tốc độ tăng trưởng dung lượng)
// Mỗi ngày lưu snapshot -> tính avg bytes/day -> dự báo ngày đầy.
// ─────────────────────────────────────────────────────────────────────────────
const VELOCITY_WINDOW = 7; // Nhìn lại 7 ngày để tính velocity

interface StorageVelocity {
  avgBytesPerDay: number;
  avgReadablePerDay: string;
  daysUntilFull: number | null; // null nếu không có limit hoặc không tính được
  projectedFullDate: string | null;
}

async function getStorageVelocity(
  currentBytes: number,
  limitBytes: number | null,
): Promise<StorageVelocity> {
  const today = format(new Date(), "yyyy-MM-dd");
  const snapshotKey = `stats:storage:snapshot:${today}`;

  // Lưu snapshot hôm nay (chỉ lần đầu mỗi ngày)
  await cacheRedis
    .set(
      snapshotKey,
      currentBytes.toString(),
      "EX",
      86400 * (VELOCITY_WINDOW + 2),
      "NX",
    )
    .catch(() => {});

  // Lấy snapshots của N ngày qua
  const keys = Array.from({ length: VELOCITY_WINDOW }, (_, i) => {
    const date = subDays(new Date(), i);
    return `stats:storage:snapshot:${format(date, "yyyy-MM-dd")}`;
  });

  const snapshots = await cacheRedis.mget(...keys).catch(() => []);
  const validSnapshots = snapshots
    .map((v, i) => (v ? { index: i, bytes: parseInt(v, 10) } : null))
    .filter(Boolean) as { index: number; bytes: number }[];

  if (validSnapshots.length < 2) {
    return {
      avgBytesPerDay: 0,
      avgReadablePerDay: "0B",
      daysUntilFull: null,
      projectedFullDate: null,
    };
  }

  // Tính avg growth/day bằng linear regression đơn giản
  const oldest = validSnapshots[validSnapshots.length - 1];
  const newest = validSnapshots[0];
  const daysDiff = oldest.index - newest.index || 1;
  const avgBytesPerDay = Math.max(0, (newest.bytes - oldest.bytes) / daysDiff);

  let daysUntilFull: number | null = null;
  let projectedFullDate: string | null = null;

  if (limitBytes && avgBytesPerDay > 0) {
    const remainingBytes = limitBytes - currentBytes;
    if (remainingBytes > 0) {
      daysUntilFull = Math.floor(remainingBytes / avgBytesPerDay);
      const fullDate = subDays(new Date(), -daysUntilFull);
      projectedFullDate = format(fullDate, "yyyy-MM-dd");
    } else {
      daysUntilFull = 0;
    }
  }

  return {
    avgBytesPerDay,
    avgReadablePerDay: formatBytes(avgBytesPerDay),
    daysUntilFull,
    projectedFullDate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: REDIS CONNECTED CLIENTS & MEMORY INFO
// ─────────────────────────────────────────────────────────────────────────────
interface RedisServerInfo {
  memoryUsed: string;
  connectedClients: number;
  uptimeSeconds: number;
  opsPerSecond: number;
  hitRate: number | null;
}

async function getQueueRedisInfo(): Promise<RedisServerInfo> {
  const defaults: RedisServerInfo = {
    memoryUsed: "0B",
    connectedClients: 0,
    uptimeSeconds: 0,
    opsPerSecond: 0,
    hitRate: null,
  };

  try {
    const [memInfo, statsInfo, clientsInfo] = await Promise.all([
      queueRedis.info("memory"),
      queueRedis.info("stats"),
      queueRedis.info("clients"),
    ]);

    const extract = (info: string, key: string): string => {
      const match = info.match(new RegExp(`${key}:(.+)`));
      return match ? match[1].trim() : "0";
    };

    const memoryUsed = extract(memInfo, "used_memory_human");
    const connectedClients = parseInt(
      extract(clientsInfo, "connected_clients"),
      10,
    );
    const uptimeSeconds =
      parseInt(extract(statsInfo, "uptime_in_seconds"), 10) || 0;
    const opsPerSecond =
      parseFloat(extract(statsInfo, "instantaneous_ops_per_sec")) || 0;

    const hits = parseInt(extract(statsInfo, "keyspace_hits"), 10) || 0;
    const misses = parseInt(extract(statsInfo, "keyspace_misses"), 10) || 0;
    const hitRate =
      hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : null;

    return {
      memoryUsed,
      connectedClients,
      uptimeSeconds,
      opsPerSecond,
      hitRate,
    };
  } catch (e) {
    console.warn("[Redis] Could not retrieve Queue Redis info:", e);
    return defaults;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE: getDashboardData
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardData = async (
  range: "7d" | "30d" | "90d",
): Promise<DashboardData & { _meta: { isStale: boolean } }> => {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;

  const { data, isStale } = await getWithSWR(
    `dashboard:analytics:${range}`,
    DASHBOARD_CACHE_TTL,
    DASHBOARD_STALE_TTL,
    () => buildDashboardData(days),
  );

  return { ...data, _meta: { isStale } };
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: buildDashboardData (chạy khi cache miss hoặc revalidate)
// ─────────────────────────────────────────────────────────────────────────────
async function buildDashboardData(days: number): Promise<DashboardData> {
  const today = new Date();
  const startDate = subDays(today, days);

  console.log(`⚠️  Building dashboard data for ${days}d range...`);

  const [
    counters,
    prevTotalUsers,
    prevTotalTracks,
    prevTotalPlaysAgg,
    userGrowthAgg,
    trackGrowthAgg,
    topTracks,
    topArtistsAgg,
    trackStatusStats,
    activeUsersCount,
    queueStats,
    redisInfo,
    externalHealth, // Đọc từ cache, không gọi API trực tiếp (xem external.job.ts)
  ] = await Promise.all([
    // PATTERN 2: Dùng Counter thay vì COUNT (O(1) thay vì O(n))
    getCounters(),

    // Snapshots for growth calculation
    User.countDocuments({ createdAt: { $lt: startDate } }),
    Track.countDocuments({ createdAt: { $lt: startDate }, isDeleted: false }),
    Track.aggregate([
      { $match: { createdAt: { $lt: startDate }, isDeleted: false } },
      {
        $group: { _id: null, total: { $sum: { $ifNull: ["$playCount", 0] } } },
      },
    ]),

    // Charts (aggregation theo ngày - vẫn cần query DB nhưng indexed tốt)
    User.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: today } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Track.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: today },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Top lists
    Track.find({ isPublic: true, isDeleted: false })
      .sort({ playCount: -1 })
      .limit(5)
      .select("title coverImage playCount artist")
      .populate("artist", "name avatar")
      .lean(),
    Track.aggregate([
      { $match: { isPublic: true, isDeleted: false } },
      {
        $group: {
          _id: "$artist",
          playCount: { $sum: { $ifNull: ["$playCount", 0] } },
        },
      },
      { $sort: { playCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "artists",
          localField: "_id",
          foreignField: "_id",
          as: "artistInfo",
        },
      },
      { $unwind: "$artistInfo" },
      {
        $project: {
          _id: "$artistInfo._id",
          name: "$artistInfo.name",
          avatar: "$artistInfo.avatar",
          playCount: 1,
        },
      },
    ]),

    // System stats
    Track.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.countDocuments({ updatedAt: { $gte: subDays(new Date(), 1) } }),

    // Queue
    audioQueue
      .getJobCounts("waiting", "active", "completed", "failed", "delayed")
      .then((counts) => ({
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      }))
      .catch(() => ({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      })),

    // Redis deep info (memory, clients, hit rate)
    getQueueRedisInfo(),

    // External health: ĐỌC TỪ CACHE (được populate bởi external.job.ts)
    cacheRedis
      .get("dashboard:system_health_external")
      .then((v) => (v ? JSON.parse(v) : null))
      .catch(() => null),
  ]);

  // ── Storage breakdown (audio vs image, dùng Counter từ Redis) ──
  const totalStorageBytes = counters.audioBytes + counters.imageBytes;

  // ── Storage Velocity ──
  const cloudinaryLimit = externalHealth?.cloudinary?.storage?.limit ?? null;
  const storageVelocity = await getStorageVelocity(
    totalStorageBytes,
    cloudinaryLimit,
  );

  // ── Format Cloudinary data ──
  let cloudinaryFormatted = null;
  if (externalHealth?.cloudinary) {
    const c = externalHealth.cloudinary;
    const bandwidthLimit =
      c.bandwidth.limit > 0 ? c.bandwidth.limit : 26843545600;
    const storageLimit = c.storage.limit > 0 ? c.storage.limit : 26843545600;

    cloudinaryFormatted = {
      plan: c.plan,
      bandwidth: {
        usage: c.bandwidth.usage,
        usageReadable: formatBytes(c.bandwidth.usage),
        limit: bandwidthLimit,
        limitReadable: formatBytes(bandwidthLimit),
        percent: calculatePercent(c.bandwidth.usage, bandwidthLimit),
      },
      storage: {
        usage: c.storage.usage,
        usageReadable: formatBytes(c.storage.usage),
        limit: storageLimit,
        limitReadable: formatBytes(storageLimit),
        percent: calculatePercent(c.storage.usage, storageLimit),
      },
      velocity: storageVelocity, // 🆕 Storage velocity ngay trong Cloudinary block
    };
  }

  // ── Upstash info ──
  let upstashFormatted = null;
  if (externalHealth?.upstash) {
    upstashFormatted = {
      ...externalHealth.upstash,
      dataSizeReadable: formatBytes(externalHealth.upstash.dataSize),
    };
  }

  // ── Track status ──
  const systemStatusObj = trackStatusStats.reduce(
    (acc: any, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    },
    { ready: 0, failed: 0, pending: 0, processing: 0 },
  );

  // ── Growth calculations (counter vs prev snapshots) ──
  const prevTotalPlays = prevTotalPlaysAgg?.[0]?.total ?? 0;

  return {
    overview: {
      users: {
        value: counters.totalUsers,
        growth: calculateGrowth(counters.totalUsers, prevTotalUsers),
      },
      tracks: {
        value: counters.totalTracks,
        growth: calculateGrowth(counters.totalTracks, prevTotalTracks),
      },
      albums: { value: counters.totalAlbums, growth: 0 },
      plays: {
        value: counters.totalPlays,
        growth: calculateGrowth(counters.totalPlays, prevTotalPlays),
      },
      activeUsers24h: activeUsersCount,
      activeNow: getActiveNowCount(),
    },
    systemHealth: {
      storage: {
        // 🆕 Tách biệt audio vs image
        audioBytes: counters.audioBytes,
        audioReadable: formatBytes(counters.audioBytes),
        imageBytes: counters.imageBytes,
        imageReadable: formatBytes(counters.imageBytes),
        totalBytes: totalStorageBytes,
        totalReadable: formatBytes(totalStorageBytes),
        velocity: storageVelocity, // 🆕 Dự báo
        b2Status: externalHealth?.b2 || null,
        cloudinary: cloudinaryFormatted,
      },
      queue: queueStats as any,
      trackStatus: systemStatusObj,
      redis: {
        // 🆕 Thông tin đầy đủ: memory, clients, hit rate
        queueWorker: {
          memory: redisInfo.memoryUsed,
          connectedClients: redisInfo.connectedClients,
          uptimeSeconds: redisInfo.uptimeSeconds,
          opsPerSecond: redisInfo.opsPerSecond,
          hitRate: redisInfo.hitRate,
        },
        upstash: upstashFormatted,
      },
    },
    charts: {
      userGrowth: fillMissingDates(userGrowthAgg, days),
      trackGrowth: fillMissingDates(trackGrowthAgg, days),
    },
    topLists: {
      topTracks: topTracks as any,
      topArtists: topArtistsAgg,
    },
  } as DashboardData;
}
