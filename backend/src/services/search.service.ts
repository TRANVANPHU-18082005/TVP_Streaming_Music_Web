import Album from "../models/Album";
import Artist from "../models/Artist";
import Playlist from "../models/Playlist";
import Track from "../models/Track";
import { cacheRedis } from "../config/redis";

const SEARCH_CACHE_TTL = 300; // 5 phút

class SearchService {
  private escapeRegex(text: string) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  private async searchCollection(
    Model: any,
    keyword: string,
    limit: number,
    type: "track" | "artist" | "album",
  ) {
    const safeKeyword = keyword.trim();

    try {
      const pipeline: any[] = [
        {
          $search: {
            index: "default",
            text: {
              query: safeKeyword,
              path: type === "track" || type === "album" ? "title" : "name",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 2,
              },
            },
            highlight: {
              path: type === "track" || type === "album" ? "title" : "name",
            },
          },
        },
        {
          $addFields: {
            score: { $meta: "searchScore" },
            highlights: { $meta: "searchHighlights" },
          },
        },
      ];

      if (type === "track") {
        pipeline.push({
          $match: { isDeleted: false, isPublic: true, status: "ready" },
        });
      } else if (type === "album") {
        pipeline.push({ $match: { isPublic: true } });
      }

      pipeline.push({ $limit: limit });

      if (type === "track" || type === "album") {
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
        );
      }

      pipeline.push({ $project: this.getProjection(type) });

      const results = await Model.aggregate(pipeline);

      if (results.length === 0) {
        return this.fallbackRegex(Model, safeKeyword, limit, type);
      }

      return results;
    } catch (error: any) {
      // 🔥 FIX 1: Ép kiểu 'any' cho error để truy cập .message
      console.warn(
        `[Search] Falling back to Regex for ${type}:`,
        error?.message || error,
      );
      return this.fallbackRegex(Model, safeKeyword, limit, type);
    }
  }

  private getProjection(type: string) {
    const base = { slug: 1, score: 1, highlights: 1 };
    if (type === "track")
      return {
        ...base,
        title: 1,
        coverImage: 1,
        duration: 1,
        plays: 1,
        hlsUrl: 1,
        artist: { name: "$artistData.name", slug: "$artistData.slug" },
      };
    if (type === "artist")
      return { ...base, name: 1, avatar: 1, totalFollowers: 1 };
    return {
      ...base,
      title: 1,
      coverImage: 1,
      year: 1,
      artist: { name: "$artistData.name" },
    };
  }

  private async fallbackRegex(
    Model: any,
    keyword: string,
    limit: number,
    type: string,
  ) {
    const regex = new RegExp(this.escapeRegex(keyword), "i");
    const query: any =
      type === "artist" ? { name: regex } : { title: regex, isPublic: true };

    if (type === "track") {
      query.isDeleted = false;
      query.status = "ready";
    }

    const baseQuery = Model.find(query);

    if (type === "track") {
      return baseQuery
        .populate("artist", "name slug")
        .sort({ plays: -1 })
        .limit(limit)
        .lean();
    }
    if (type === "artist") {
      return baseQuery.sort({ totalFollowers: -1 }).limit(limit).lean();
    }
    return baseQuery.populate("artist", "name").limit(limit).lean();
  }

  searchEverything = async (keyword: string, limit: number = 5) => {
    if (!keyword?.trim())
      return {
        topResult: null,
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
      };

    const safeKeyword = keyword.trim();
    const cacheKey = `search:v3:${safeKeyword.toLowerCase()}:${limit}`;

    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis Get Error:", err);
    }

    const [tracks, artists, albums, playlists] = await Promise.all([
      this.searchCollection(Track, safeKeyword, limit, "track"),
      this.searchCollection(Artist, safeKeyword, limit, "artist"),
      this.searchCollection(Album, safeKeyword, limit, "album"),
      Playlist.find({
        title: new RegExp(this.escapeRegex(safeKeyword), "i"),
        isPublic: true,
      })
        .select("title coverImage slug")
        .limit(limit)
        .lean(),
    ]);

    let topResult = null;

    const exactArtist = (artists as any[]).find(
      (a: any) => a.name.toLowerCase() === safeKeyword.toLowerCase(),
    );

    if (exactArtist) {
      topResult = { ...exactArtist, type: "artist" };
    } else {
      // 🔥 FIX 2: Định nghĩa kiểu 'any' trong các hàm callback map và sort
      const allResults = [
        ...(tracks as any[]).map((t: any) => ({ ...t, type: "track" })),
        ...(artists as any[]).map((a: any) => ({ ...a, type: "artist" })),
        ...(albums as any[]).map((al: any) => ({ ...al, type: "album" })),
      ].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

      if (allResults.length > 0) {
        topResult = allResults[0];
      }
    }

    const result = { topResult, tracks, artists, albums, playlists };

    cacheRedis
      .setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result))
      .catch((err) => console.error("Redis Set Error:", err));

    return result;
  };
}

export default new SearchService();
