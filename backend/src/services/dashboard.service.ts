import { subDays } from "date-fns";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { cacheRedis, queueRedis } from "../config/redis"; // 🔥 FIX: Sử dụng Dual Redis
import { getB2Health } from "../config/b2";
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
import { audioQueue } from "../queue/transcodeTrack.queue";

// --- CONFIGURATION ---
const DASHBOARD_CACHE_TTL = 600; // 10 phút (Cache data từ DB)
const EXTERNAL_CACHE_TTL = 3600; // 1 tiếng (Cache data từ API thứ 3)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- HELPER: LẤY DỮ LIỆU EXTERNAL (DevOps) ---
const getExternalSystemHealth = async () => {
  const cacheKey = "dashboard:system_health_external";

  try {
    // 🔥 FIX: Lấy từ cacheRedis (Upstash)
    const cached = await cacheRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Redis Cache Get Error (External):", e);
  }

  console.log("🔌 Fetching External APIs (Cloudinary, Upstash, B2)...");

  const [cloudinaryData, upstashData, b2Data] = await Promise.all([
    // A. Cloudinary Usage
    (async () => {
      try {
        const res = await cloudinary.api.usage();
        return {
          plan: res.plan,
          bandwidth: {
            usage: res.bandwidth.usage,
            limit: res.bandwidth.limit,
          },
          storage: {
            usage: res.storage.usage,
            limit: res.storage.limit,
          },
        };
      } catch (err) {
        console.error("Cloudinary API Error:", err);
        return null;
      }
    })(),

    // B. Upstash Redis Quota
    (async () => {
      try {
        if (!process.env.UPSTASH_DB_ID || !process.env.UPSTASH_API_KEY)
          return null;
        const res = await axios.get(
          `https://api.upstash.com/v2/redis/databases/${process.env.UPSTASH_DB_ID}`,
          {
            headers: { Authorization: `Bearer ${process.env.UPSTASH_API_KEY}` },
          },
        );
        return {
          dailyRequests: res.data.daily_request_count,
          monthlyRequests: res.data.monthly_request_count,
          dataSize: res.data.data_size,
        };
      } catch (err) {
        console.error("Upstash API Error:", err);
        return null;
      }
    })(),

    // C. Backblaze B2 Health Check
    getB2Health().catch(() => null),
  ]);

  const result = {
    cloudinary: cloudinaryData,
    upstash: upstashData,
    b2: b2Data,
  };

  // 🔥 FIX: Lưu vào cacheRedis (Upstash)
  await cacheRedis
    .setex(cacheKey, EXTERNAL_CACHE_TTL, JSON.stringify(result))
    .catch((err) => console.error("Redis Cache Set Error (External):", err));

  return result;
};

// --- MAIN SERVICE ---
export const getDashboardData = async (
  range: "7d" | "30d" | "90d",
): Promise<DashboardData> => {
  const cacheKey = `dashboard:analytics:${range}`;

  // A. Check Main Redis Cache
  try {
    // 🔥 FIX: Lấy từ cacheRedis
    const cachedData = await cacheRedis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {
    console.error("Redis Error:", err);
  }

  console.log("⚠️ Cache Miss: Aggregating Dashboard Data...");

  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const today = new Date();
  const startDate = subDays(today, days);

  // B. Run All Queries in Parallel
  const [
    totalUsers,
    totalTracks,
    totalAlbums,
    totalPlaysAgg,
    prevTotalUsers,
    prevTotalTracks,
    prevTotalPlaysAgg,
    userGrowthAgg,
    trackGrowthAgg,
    topTracks,
    topArtistsAgg,
    storageStats,
    trackStatusStats,
    activeUsersCount,
    queueStats,
    externalHealth,
  ] = await Promise.all([
    // 1-3. Basic Counts
    User.countDocuments(),
    Track.countDocuments({ isDeleted: false }),
    Album.countDocuments(),

    // 4. Plays (Current)
    Track.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: { _id: null, total: { $sum: { $ifNull: ["$playCount", 0] } } },
      },
    ]),

    // 5-7. Snapshots (Previous)
    User.countDocuments({ createdAt: { $lt: startDate } }),
    Track.countDocuments({ createdAt: { $lt: startDate }, isDeleted: false }),
    Track.aggregate([
      { $match: { createdAt: { $lt: startDate }, isDeleted: false } },
      {
        $group: { _id: null, total: { $sum: { $ifNull: ["$playCount", 0] } } },
      },
    ]),

    // 8-9. Charts
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

    // 10. Top Tracks
    Track.find({ isPublic: true, isDeleted: false })
      .sort({ playCount: -1 })
      .limit(5)
      .select("title coverImage playCount artist")
      .populate("artist", "name avatar")
      .lean(),

    // 11. Top Artists
    Track.aggregate([
      { $match: { isPublic: true, isDeleted: false } },
      {
        $group: {
          _id: "$artist",
          totalPlays: { $sum: { $ifNull: ["$playCount", 0] } },
        },
      },
      { $sort: { totalPlays: -1 } },
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
          totalPlays: 1,
        },
      },
    ]),

    // 12. Internal Storage (Sum fileSize from DB)
    Track.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalBytes: { $sum: "$fileSize" } } },
    ]),

    // 13. Track Status
    Track.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // 14. Active Users
    User.countDocuments({ updatedAt: { $gte: subDays(new Date(), 1) } }),

    // 15. Queue Stats (BullMQ)
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

    // 16. External Health
    getExternalSystemHealth(),
  ]);

  // --- C. DATA PROCESSING (BFF Logic) ---

  const dbStorageBytes = storageStats?.[0]?.totalBytes ?? 0;

  let cloudinaryFormatted = null;
  if (externalHealth?.cloudinary) {
    const c = externalHealth.cloudinary;
    const bandwidthLimit =
      c.bandwidth.limit > 0 ? c.bandwidth.limit : 26843545600; // 25GB fallback
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
      },
    };
  }

  let upstashFormatted = null;
  if (externalHealth?.upstash) {
    upstashFormatted = {
      ...externalHealth.upstash,
      dataSizeReadable: formatBytes(externalHealth.upstash.dataSize),
    };
  }

  // 🔥 FIX QUAN TRỌNG: Lấy memory của queueRedis thay vì cacheRedis.
  // Lý do: Upstash (Serverless) thường chặn lệnh INFO. Trong khi đó, queueRedis
  // (Redis Cloud / Local) hỗ trợ đầy đủ lệnh INFO và là nơi chứa nhiều dữ liệu nặng nhất.
  let redisMemoryHuman = "0B";
  try {
    const info = await queueRedis.info("memory");
    const match = info.match(/used_memory_human:(.+)/);
    if (match) redisMemoryHuman = match[1].trim();
  } catch (e) {
    console.warn("Could not retrieve Queue Redis Memory Info");
  }

  const systemStatusObj = trackStatusStats.reduce(
    (acc: any, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    },
    { ready: 0, failed: 0, pending: 0, processing: 0 },
  );

  const totalPlays = totalPlaysAgg?.[0]?.total ?? 0;
  const prevTotalPlays = prevTotalPlaysAgg?.[0]?.total ?? 0;

  // --- D. CONSTRUCT RESPONSE ---
  const result: DashboardData = {
    overview: {
      users: {
        value: totalUsers,
        growth: calculateGrowth(totalUsers, prevTotalUsers),
      },
      tracks: {
        value: totalTracks,
        growth: calculateGrowth(totalTracks, prevTotalTracks),
      },
      albums: { value: totalAlbums, growth: 0 },
      plays: {
        value: totalPlays,
        growth: calculateGrowth(totalPlays, prevTotalPlays),
      },
      activeUsers24h: activeUsersCount,
    },
    systemHealth: {
      storage: {
        dbTotalBytes: dbStorageBytes,
        dbReadable: formatBytes(dbStorageBytes),
        b2Status: externalHealth?.b2 || null,
        cloudinary: cloudinaryFormatted,
      },
      queue: queueStats as any,
      trackStatus: systemStatusObj,
      redis: {
        memory: redisMemoryHuman, // RAM của Queue Worker
        upstash: upstashFormatted, // Thông số quota của Upstash Cache
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
  };

  // E. Save to Cache
  try {
    // 🔥 FIX: Lưu cache tổng hợp vào cacheRedis (Upstash)
    await cacheRedis.setex(
      cacheKey,
      DASHBOARD_CACHE_TTL,
      JSON.stringify(result),
    );
  } catch (err) {
    console.error("Redis Set Error:", err);
  }

  return result;
};
