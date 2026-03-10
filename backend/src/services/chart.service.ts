import PlayLog from "../models/PlayLog";
import Track from "../models/Track";
import { cacheRedis } from "../config/redis"; // Giả sử bạn dùng cacheRedis từ setup trước

const CACHE_KEY = "chart:live:top100";
const CACHE_TTL = 30; // Cache 30 giây cho Realtime

export const getRealtimeChart = async () => {
  // 1. Lấy từ Redis (Fast Path)
  try {
    const cached = await cacheRedis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached); // Bây giờ đã an toàn vì ta cache toàn bộ response
  } catch (e) {
    console.error("Redis Cache GET Error", e);
  }

  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 2. QUERY REALTIME TRACKS (Có bọc chống bài rác)
  const realtimeTracks = await PlayLog.aggregate([
    { $match: { listenedAt: { $gte: startTime } } },
    { $group: { _id: "$trackId", score: { $sum: 1 } } },
    { $sort: { score: -1 } },
    { $limit: 100 },

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

    // Lọc bài rác
    {
      $match: {
        "track.isDeleted": false,
        "track.isPublic": true,
        "track.status": "ready",
      },
    },

    // 🔥 FIX CHI TIẾT ALBUM: Lookup bảng albums
    {
      $lookup: {
        from: "albums", // Tên collection chứa album
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
        as: "artist",
      },
    },
    { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },

    // Format Output
    {
      $project: {
        _id: "$track._id",
        title: "$track.title",
        slug: "$track.slug",
        duration: "$track.duration",
        // Lấy từ albumDetails vừa lookup được
        album: {
          _id: "$albumDetails._id",
          title: "$albumDetails.title", // Thường album dùng field 'title' thay vì 'name'
          slug: "$albumDetails.slug",
        },
        coverImage: "$track.coverImage",
        hlsUrl: "$track.hlsUrl",
        featuringArtists: "$track.featuringArtists",
        playCount: "$track.playCount",
        artist: {
          name: "$artist.name",
          _id: "$artist._id",
          avatar: "$artist.avatar",
          slug: "$artist.slug",
        },
        score: "$score",
      },
    },
  ]);

  // 3. LOGIC FALLBACK (Lấp đầy nếu thiếu)
  let finalTracks = [...realtimeTracks];

  if (finalTracks.length < 100) {
    const needed = 100 - finalTracks.length;
    const existingIds = finalTracks.map((t) => t._id);

    const fallbackTracks = await Track.find({
      _id: { $nin: existingIds },
      isDeleted: false,
      isPublic: true,
      status: "ready", // 🔥 Bắt buộc bài phải sẵn sàng
    })
      .sort({ playCount: -1 })
      .limit(needed)
      .populate("artist", "name avatar _id")
      .lean();

    const formattedFallback = fallbackTracks.map((t: any) => ({
      _id: t._id,
      title: t.title,
      slug: t.slug,
      duration: t.duration,
      album: {
        name: t.album?.name,
        slug: t.album?.slug,
        _id: t.album?._id,
      },
      coverImage: t.coverImage,
      hlsUrl: t.hlsUrl,
      trackUrl: t.trackUrl,
      featuringArtists: t.featuringArtists,
      playCount: t.playCount,
      artist: {
        name: t.artist?.name,
        _id: t.artist?._id,
        avatar: t.artist?.avatar,
      },
      score: 0,
    }));

    finalTracks = [...finalTracks, ...formattedFallback];
  }

  // 4. GET CHART DATA CHO TOP 3
  const top3Ids = finalTracks.slice(0, 3).map((t) => t._id);
  const chartData = await getChartDataForTop3(top3Ids, startTime);

  const responseData = {
    items: finalTracks,
    chart: chartData,
  };

  // 🔥 FIX 1: Cache TOÀN BỘ responseData, không chỉ finalTracks
  cacheRedis
    .setex(CACHE_KEY, CACHE_TTL, JSON.stringify(responseData))
    .catch((err) => console.error("Redis Cache SET Error", err));

  return responseData;
};

/**
 * Helper: Tính lượt nghe theo giờ cho Top 3
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
        // Ép múi giờ về +07:00 trong Database
        hour: { $hour: { date: "$listenedAt", timezone: "+07:00" } },
      },
    },
    {
      $group: {
        _id: { trackId: "$trackId", hour: "$hour" },
        count: { $sum: 1 },
      },
    },
  ]);

  const chartPoints = [];

  // 🔥 FIX 2: Bắt buộc lấy giờ hiện tại theo UTC+7, bất chấp server đang ở đâu
  const now = new Date();
  const nowHour = (now.getUTCHours() + 7) % 24;

  for (let i = 0; i < 24; i++) {
    const targetHour = (nowHour - (23 - i) + 24) % 24;
    const point: any = { time: `${targetHour}:00` };

    top3Ids.forEach((id, index) => {
      const found = rawChart.find(
        (item) =>
          item._id.trackId.toString() === id.toString() &&
          item._id.hour === targetHour,
      );
      point[`top${index + 1}`] = found ? found.count : 0;
    });

    chartPoints.push(point);
  }

  return chartPoints;
};
