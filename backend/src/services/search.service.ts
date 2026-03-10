import { cacheRedis } from "../config/redis"; // 🔥 FIX 1: Dùng đúng ống Cache Redis
import Album from "../models/Album";
import Artist from "../models/Artist";
import Playlist from "../models/Playlist";
import Track from "../models/Track";

const SEARCH_CACHE_TTL = 300; // 5 phút

class SearchService {
  // 🔥 FIX 2: Hàm chống Hacker tấn công ReDoS qua ô tìm kiếm
  private escapeRegex(text: string) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  // --- HELPER: FALLBACK SEARCH ---
  private async searchCollection(
    Model: any,
    keyword: string,
    limit: number,
    type: "track" | "artist" | "album",
  ) {
    const safeKeyword = this.escapeRegex(keyword);
    const regex = new RegExp(safeKeyword, "i");

    try {
      // 1. Thử dùng ATLAS SEARCH ($search)
      const pipeline: any[] = [
        {
          $search: {
            index: "default",
            text: {
              query: keyword, // Atlas search tự handle string an toàn, không cần escape regex
              path: type === "track" || type === "album" ? "title" : "name",
              fuzzy: { maxEdits: 2 },
            },
          },
        },
      ];

      // 🔥 FIX 3: BỌC BẢO MẬT (DATA LEAK PREVENTION)
      // Chặn ngay các bài hát/album nháp, rác, lỗi trước khi $limit
      if (type === "track") {
        pipeline.push({
          $match: { isDeleted: false, isPublic: true, status: "ready" },
        });
      } else if (type === "album") {
        pipeline.push({
          $match: { isPublic: true },
        });
      }

      // Đặt limit SAU khi đã lọc các bài rác
      pipeline.push({ $limit: limit });

      // Lookup và Format dữ liệu trả về
      if (type === "track") {
        pipeline.push(
          {
            $lookup: {
              from: "artists",
              localField: "artist",
              foreignField: "_id",
              as: "artistData",
            },
          },
          { $unwind: "$artistData" },
          {
            $project: {
              title: 1,
              coverImage: 1,
              duration: 1,
              slug: 1,
              plays: 1, // Tuỳ db của bạn lưu là playCount hay plays
              hlsUrl: 1, // Lấy luôn link để phát nhạc
              artist: { name: "$artistData.name", slug: "$artistData.slug" },
            },
          },
        );
      } else if (type === "artist") {
        pipeline.push({
          $project: { name: 1, avatar: 1, slug: 1, totalFollowers: 1 },
        });
      } else if (type === "album") {
        pipeline.push(
          {
            $lookup: {
              from: "artists",
              localField: "artist",
              foreignField: "_id",
              as: "artistData",
            },
          },
          {
            $unwind: { path: "$artistData", preserveNullAndEmptyArrays: true },
          },
          {
            $project: {
              title: 1,
              coverImage: 1,
              year: 1,
              slug: 1,
              artist: { name: "$artistData.name" },
            },
          },
        );
      }

      return await Model.aggregate(pipeline);
    } catch (error) {
      // 2. NẾU LỖI -> DÙNG REGEX (Fallback)
      console.warn(
        `⚠️ Atlas Search failed for ${type}, falling back to Regex.`,
      );

      // 🔥 FIX 3: Bọc bảo mật cho Fallback Query
      if (type === "track") {
        return await Model.find({
          title: regex,
          isPublic: true,
          isDeleted: false,
          status: "ready", // Chỉ lấy bài đã transcode xong
        })
          .select("title coverImage duration slug playCount hlsUrl artist")
          .populate("artist", "name slug")
          .sort({ playCount: -1 })
          .limit(limit)
          .lean();
      } else if (type === "artist") {
        return await Model.find({ name: regex })
          .select("name avatar slug totalFollowers")
          .sort({ totalFollowers: -1 })
          .limit(limit)
          .lean();
      } else if (type === "album") {
        return await Model.find({ title: regex, isPublic: true })
          .select("title coverImage year slug artist")
          .populate("artist", "name")
          .limit(limit)
          .lean();
      }
      return [];
    }
  }

  // --- MAIN FUNCTION ---
  searchEverything = async (keyword: string, limit: number = 5) => {
    if (!keyword || keyword.trim() === "")
      return {
        topResult: null,
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
      };

    limit = Number(limit) || 5;
    const safeKeyword = keyword.trim();
    const cacheKey = `search:${safeKeyword.toLowerCase()}:${limit}`;

    // 1. Redis Cache
    try {
      const cached = await cacheRedis.get(cacheKey); // 🔥 FIX 1
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis error:", err);
    }

    const regex = new RegExp(this.escapeRegex(safeKeyword), "i"); // 🔥 FIX 2

    // 2. Run Parallel Queries
    const [tracks, artists, albums, playlists] = await Promise.all([
      this.searchCollection(Track, safeKeyword, limit, "track"),
      this.searchCollection(Artist, safeKeyword, limit, "artist"),
      this.searchCollection(Album, safeKeyword, limit, "album"),

      // Playlist dùng Regex thường cho nhẹ
      Playlist.find({ title: regex, isPublic: true })
        .select("title coverImage user slug")
        .populate("user", "fullName")
        .limit(limit)
        .lean(),
    ]);

    // 3. Logic Top Result
    let topResult = null;
    const exactArtist = artists.find(
      (a: any) => a.name.toLowerCase() === safeKeyword.toLowerCase(),
    );

    if (exactArtist) {
      topResult = { type: "artist", ...exactArtist };
    } else if (tracks.length > 0) {
      topResult = { type: "track", ...tracks[0] };
    } else if (artists.length > 0) {
      topResult = { type: "artist", ...artists[0] };
    }

    const result = { topResult, tracks, artists, albums, playlists };

    // 4. Set Cache
    cacheRedis // 🔥 FIX 1
      .setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result))
      .catch((err) => console.error("Redis set error:", err));

    return result;
  };
}

export default new SearchService();
