import PlayLog from "../models/PlayLog";
import Track from "../models/Track";
import { cacheRedis } from "../config/redis";

const CACHE_KEY = "chart:live:top100";
const CACHE_TTL = 30;

export const getRealtimeChart = async () => {
  // 1. Fast Path: Redis cache
  try {
    const cached = await cacheRedis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Redis Cache GET Error", e);
  }

  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 2. FIX #3 — Unique Listeners: group theo (trackId, userId hoặc ip) trong 1 giờ
  //    Mỗi listener chỉ được tính 1 điểm / bài / giờ, chống cày view
  const realtimeTracks = await PlayLog.aggregate([
    { $match: { listenedAt: { $gte: startTime } } },

    // Dedup: mỗi (trackId, userId|ip, giờ) chỉ tính 1 lần
    {
      $group: {
        _id: {
          trackId: "$trackId",
          // Ưu tiên userId, fallback về ip để cover khách vãng lai
          listener: { $ifNull: ["$userId", "$ip"] },
          hour: { $hour: { date: "$listenedAt", timezone: "+07:00" } },
        },
      },
    },

    // Sau khi dedup, cộng điểm thực sự cho mỗi bài
    {
      $group: {
        _id: "$_id.trackId",
        score: { $sum: 1 },
      },
    },

    { $sort: { score: -1 } },

    // FIX #1 — Lấy buffer 150 để sau khi lọc bài rác vẫn đủ 100 bài
    { $limit: 150 },

    // Lookup Track
    {
      $lookup: {
        from: "tracks",
        localField: "_id",
        foreignField: "_id",
        as: "track",
      },
    },
    { $unwind: "$track" },

    // FIX #2 — Dùng $ne: true để bắt cả bài cũ chưa có field isDeleted
    {
      $match: {
        "track.isDeleted": { $ne: true },
        "track.isPublic": true,
        "track.status": "ready",
      },
    },

    // Cắt đúng 100 bài sau khi đã lọc sạch bài rác
    { $limit: 100 },

    // Lookup Album
    {
      $lookup: {
        from: "albums",
        localField: "track.album",
        foreignField: "_id",
        as: "albumDetails",
      },
    },
    { $unwind: { path: "$albumDetails", preserveNullAndEmptyArrays: true } },

    // Lookup Artist
    {
      $lookup: {
        from: "artists",
        localField: "track.artist",
        foreignField: "_id",
        as: "artistDetails",
      },
    },
    { $unwind: { path: "$artistDetails", preserveNullAndEmptyArrays: true } },

    // Lookup Featuring Artists (Giữ nguyên mảng để $map)
    {
      $lookup: {
        from: "artists",
        localField: "track.featuringArtists",
        foreignField: "_id",
        as: "featuringDetails",
      },
    },

    // FIX #4 — Chỉ project đúng fields cần cho Chart, loại bỏ plainLyrics / lyricPreview / description
    // ── Project Final ──────────────────────────────────
    {
      $project: {
        _id: "$track._id",
        title: "$track.title",
        slug: "$track.slug",
        duration: "$track.duration",
        coverImage: "$track.coverImage",
        playCount: "$track.playCount",
        score: "$score",

        // Map lại mảng feature để lấy đúng fields cần thiết
        featuringArtists: {
          $map: {
            input: "$featuringDetails",
            as: "feat",
            in: {
              _id: "$$feat._id",
              name: "$$feat.name",
              slug: "$$feat.slug",
              avatar: "$$feat.avatar",
            },
          },
        },

        album: {
          _id: "$albumDetails._id",
          title: "$albumDetails.title",
          slug: "$albumDetails.slug",
        },

        artist: {
          _id: "$artistDetails._id",
          name: "$artistDetails.name",
          avatar: "$artistDetails.avatar",
          slug: "$artistDetails.slug",
        },
      },
    },
  ]);

  // 3. Fallback: lấp đầy nếu Realtime chưa đủ 100
  let finalTracks = [...realtimeTracks];

  if (finalTracks.length < 100) {
    const needed = 100 - finalTracks.length;
    const existingIds = finalTracks.map((t) => t._id);

    const fallbackTracks = await Track.find({
      _id: { $nin: existingIds },
      // FIX #2 — nhất quán dùng $ne: true ở cả fallback query
      isDeleted: { $ne: true },
      isPublic: true,
      status: "ready",
    })
      // FIX #4 — Chỉ select fields cần thiết, tránh kéo plainLyrics / lyricPreview lên memory
      .select(
        "title slug duration coverImage hlsUrl featuringArtists playCount artist album",
      )
      .sort({ playCount: -1 })
      .limit(needed)
      .populate("artist", "name avatar _id slug")
      .populate("album", "title slug _id")
      .lean();

    const formattedFallback = fallbackTracks.map((t: any) => ({
      _id: t._id,
      title: t.title,
      slug: t.slug,
      duration: t.duration,
      coverImage: t.coverImage,
      featuringArtists: t.featuringArtists,
      playCount: t.playCount,
      album: t.album
        ? { _id: t.album._id, title: t.album.title, slug: t.album.slug }
        : null,
      artist: t.artist
        ? {
            _id: t.artist._id,
            name: t.artist.name,
            avatar: t.artist.avatar,
            slug: t.artist.slug,
          }
        : null,
      score: 0,
    }));

    finalTracks = [...finalTracks, ...formattedFallback];
  }

  // 4. Chart data cho Top 3
  const top3Ids = finalTracks.slice(0, 3).map((t) => t._id);
  const chartData = await getChartDataForTop3(top3Ids, startTime);

  const responseData = {
    items: finalTracks,
    chart: chartData,
    lastUpdatedAt: new Date().toISOString(),
  };

  cacheRedis
    .setex(CACHE_KEY, CACHE_TTL, JSON.stringify(responseData))
    .catch((err) => console.error("Redis Cache SET Error", err));

  return responseData;
};

/**
 * Tính lượt nghe theo giờ cho Top 3 (Unique Listeners)
 */
/**
 * Tính lượt nghe theo giờ cho Top 3 (Unique Listeners)
 * Tối ưu hiệu năng O(n) bằng Map tra cứu nhanh
 */
const getChartDataForTop3 = async (top3Ids: any[], startTime: Date) => {
  if (top3Ids.length === 0) return [];

  const rawChart = await PlayLog.aggregate([
    {
      $match: {
        trackId: { $in: top3Ids },
        listenedAt: { $gte: startTime },
      },
    },
    {
      $project: {
        trackId: 1,
        listener: { $ifNull: ["$userId", "$ip"] },
        hour: { $hour: { date: "$listenedAt", timezone: "+07:00" } },
      },
    },
    // Chống cày view trong biểu đồ: 1 người/1 bài/1 giờ = 1 điểm
    {
      $group: {
        _id: { trackId: "$trackId", listener: "$listener", hour: "$hour" },
      },
    },
    {
      $group: {
        _id: { trackId: "$_id.trackId", hour: "$_id.hour" },
        count: { $sum: 1 },
      },
    },
  ]);

  // --- BƯỚC VÍT GA: CHUYỂN ARRAY SANG MAP ---
  // Key format: "trackId-hour" -> Value: count
  const dataMap = new Map<string, number>();

  rawChart.forEach((item) => {
    const key = `${item._id.trackId.toString()}-${item._id.hour}`;
    dataMap.set(key, item.count);
  });

  // Lấy giờ hiện tại UTC+7
  const now = new Date();
  const nowHour = (now.getUTCHours() + 7) % 24;

  // Tạo 24 điểm dữ liệu
  return Array.from({ length: 24 }, (_, i) => {
    // Tính toán targetHour ngược từ hiện tại về quá khứ
    const targetHour = (nowHour - (23 - i) + 24) % 24;
    const point: any = {
      time: `${targetHour}:00`,
      hour: targetHour, // Thêm field này để FE dễ handle nếu cần
    };

    top3Ids.forEach((id, index) => {
      // Tra cứu O(1) - Cực nhanh
      const lookupKey = `${id.toString()}-${targetHour}`;
      point[`top${index + 1}`] = dataMap.get(lookupKey) || 0;
    });

    return point;
  });
};
