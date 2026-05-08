import Album from "../models/Album";
import Artist from "../models/Artist";
import Playlist from "../models/Playlist";
import Track from "../models/Track";
import Genre from "../models/Genre";
import { cacheRedis } from "../config/redis";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SEARCH_CACHE_TTL = 300; // 5 phút — full search
const SUGGEST_CACHE_TTL = 60; // 1 phút — autocomplete
const TRENDING_WINDOW = 86400; // 24 giờ — sliding window cho hot-search
const TRENDING_KEY = "trending:searches";
const TRENDING_TOP_N = 10;

// ─────────────────────────────────────────────
// Helper: xử lý highlight trả về từ Atlas
// Chuyển [{path, texts:[{value,type}]}] → chuỗi HTML an toàn
// ─────────────────────────────────────────────
function processHighlights(highlights: any[]): string {
  if (!highlights?.length) return "";
  const hit = highlights[0]; // lấy path đầu tiên
  return (hit.texts as any[])
    .map((t: { value: string; type: string }) => {
      // escape trước khi bọc thẻ → an toàn XSS
      const safe = t.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return t.type === "hit" ? `<mark>${safe}</mark>` : safe;
    })
    .join("");
}

// ─────────────────────────────────────────────
// Helper: escape regex
// ─────────────────────────────────────────────
function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// ─────────────────────────────────────────────
// SearchService
// ─────────────────────────────────────────────
class SearchService {
  // ───────────────────────────────────────────
  // 1. SUGGEST (Autocomplete) — siêu nhanh
  //    Không lookup, không aggregate nặng.
  //    Chỉ trả về id + title/name để FE render dropdown.
  // ───────────────────────────────────────────
  suggest = async (keyword: string, limit = 5) => {
    if (!keyword?.trim()) return [];

    const safe = keyword.trim();
    const cacheKey = `suggest:${safe.toLowerCase()}:${limit}`;

    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { }

    // Atlas $search với prefix — nhanh hơn fuzzy cho autocomplete
    const atlasPipeline = (nameField: string) => [
      {
        $search: {
          index: "default",
          // autocomplete index cần được tạo riêng trong Atlas
          // với field analyzer: lucene.icu hoặc lucene.vietnamese
          autocomplete: {
            query: safe,
            path: nameField,
            tokenOrder: "sequential",
            fuzzy: { maxEdits: 1, prefixLength: 2 },
          },
        },
      },
      { $limit: limit },
      { $project: { _id: 1, [nameField]: 1, slug: 1 } },
    ];

    try {
      const [tracks, artists] = await Promise.all([
        Track.aggregate(atlasPipeline("title")),
        Artist.aggregate(atlasPipeline("name")),
      ]);

      const result = [
        ...tracks.map((t: any) => ({
          id: t._id,
          label: t.title,
          slug: t.slug,
          type: "track",
        })),
        ...artists.map((a: any) => ({
          id: a._id,
          label: a.name,
          slug: a.slug,
          type: "artist",
        })),
      ].slice(0, limit);

      cacheRedis
        .setex(cacheKey, SUGGEST_CACHE_TTL, JSON.stringify(result))
        .catch(() => { });

      return result;
    } catch (err) {
      // fallback regex nhẹ
      const regex = new RegExp(`^${escapeRegex(safe)}`, "i");
      const [tracks, artists] = await Promise.all([
        Track.find({
          title: regex,
          isPublic: true,
          status: "ready",
          isDeleted: false,
        })
          .select("title slug")
          .limit(limit)
          .lean(),
        Artist.find({ name: regex }).select("name slug").limit(limit).lean(),
      ]);
      return [
        ...(tracks as any[]).map((t) => ({
          id: t._id,
          label: t.title,
          slug: t.slug,
          type: "track",
        })),
        ...(artists as any[]).map((a) => ({
          id: a._id,
          label: a.name,
          slug: a.slug,
          type: "artist",
        })),
      ].slice(0, limit);
    }
  };

  // ───────────────────────────────────────────
  // 2. SEARCH EVERYTHING — full search khi nhấn Enter
  // ───────────────────────────────────────────
  searchEverything = async (keyword: string, limit = 5) => {
    if (!keyword?.trim())
      return {
        topResult: null,
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
        genres: [],
      };

    const safe = keyword.trim();
    const cacheKey = `search:${safe.toLowerCase()}:${limit}`;

    // ghi nhận trending (không await — fire & forget)
    this.recordTrending(safe);

    try {
      const cached = await cacheRedis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { }

    const [tracks, artists, albums, playlists, genres] = await Promise.all([
      this.searchCollection(Track, safe, limit, "track"),
      this.searchCollection(Artist, safe, limit, "artist"),
      this.searchCollection(Album, safe, limit, "album"),
      this.searchCollection(Playlist, safe, limit, "playlist"),
      this.searchCollection(Genre, safe, limit, "genre"),
    ]);

    // Xác định topResult
    let topResult: any = null;
    const exactArtist = (artists as any[]).find(
      (a: any) => a.name?.toLowerCase() === safe.toLowerCase(),
    );

    if (exactArtist) {
      topResult = { ...exactArtist, type: "artist" };
    } else {
      const all = [
        ...(tracks as any[]).map((t: any) => ({ ...t, type: "track" })),
        ...(artists as any[]).map((a: any) => ({ ...a, type: "artist" })),
        ...(albums as any[]).map((al: any) => ({ ...al, type: "album" })),
        ...(playlists as any[]).map((pl: any) => ({ ...pl, type: "playlist" })),
        ...(genres as any[]).map((g: any) => ({ ...g, type: "genre" })),
      ].sort((a: any, b: any) => (b._score || 0) - (a._score || 0));

      topResult = all[0] ?? null;
    }

    const result = { topResult, tracks, artists, albums, playlists, genres };

    cacheRedis
      .setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result))
      .catch(() => { });

    return result;
  };

  // ───────────────────────────────────────────
  // 3. TRENDING — top từ khóa được search nhiều nhất
  //    Dùng Redis Sorted Set: ZINCRBY + ZREVRANGE
  // ───────────────────────────────────────────

  /** Ghi nhận keyword vào sorted set trending */
  private recordTrending(keyword: string) {
    const normalized = keyword.toLowerCase().trim();
    // ZINCRBY tăng score lên 1; TTL reset mỗi 24h bằng EXPIRE
    cacheRedis
      .zincrby(TRENDING_KEY, 1, normalized)
      .then(() => cacheRedis.expire(TRENDING_KEY, TRENDING_WINDOW))
      .catch(() => { });
  }

  /** Lấy top trending keywords */
  getTrending = async (topN = TRENDING_TOP_N): Promise<string[]> => {
    try {
      // ZREVRANGE trả về mảng string từ cao đến thấp
      const results: string[] = await cacheRedis.zrevrange(
        TRENDING_KEY,
        0,
        topN - 1,
      );
      return results;
    } catch {
      return [];
    }
  };

  // ───────────────────────────────────────────
  // 4. SEARCH COLLECTION (core)
  //    Atlas Search + Weighted Scoring + Highlight
  //    Sau $search chỉ lấy _id, rồi populate ở ngoài → giảm tải aggregate
  // ───────────────────────────────────────────
  private async searchCollection(
    Model: any,
    keyword: string,
    limit: number,
    type: "track" | "artist" | "album" | "playlist" | "genre",
  ) {
    const nameField = ["track", "album", "playlist"].includes(type) ? "title" : "name";

    try {
      /**
       * Pipeline chiến lược:
       * 1. $search với analyzer lucene.icu (hỗ trợ không dấu TV)
       * 2. $addFields: tính _score có "buff" từ plays/followers
       * 3. $match filter theo loại
       * 4. $sort theo _score
       * 5. $limit
       * 6. $project chỉ lấy _id + highlight → sau đó populate ngoài
       */
      const pipeline: any[] = [
        {
          $search: {
            index: "default",
            // lucene.icu / lucene.vietnamese cần được set trong Atlas Index Definition
            // Nó xử lý: "Son Tung" == "Sơn Tùng", "nguoi" == "người"
            text: {
              query: keyword,
              path: nameField,
              fuzzy: { maxEdits: 1, prefixLength: 2 },
            },
            highlight: { path: nameField },
          },
        },
        // ── Weighted Scoring ──────────────────────────────────
        // Công thức: _score = atlasScore * 10 + log(plays + 1) * popularityWeight
        // Điều này đảm bảo bài hát phổ biến nổi lên nhưng relevance vẫn chiếm ưu thế
        {
          $addFields: {
            _atlasScore: { $meta: "searchScore" },
            _highlights: { $meta: "searchHighlights" },
            _popularityScore: (() => {
              if (type === "track" || type === "album" || type === "playlist" || type === "genre") {
                return {
                  $multiply: [
                    { $log: [{ $add: [{ $ifNull: ["$playCount", 0] }, 1] }, 10] },
                    0.5, // weight = 0.5 (có thể tune)
                  ],
                };
              }
              if (type === "artist") {
                return {
                  $multiply: [
                    { $log: [{ $add: [{ $ifNull: ["$totalFollowers", 0] }, 1] }, 10] },
                    0.5,
                  ],
                };
              }
              return 0;
            })(),
          },
        },
        {
          $addFields: {
            _score: {
              $add: [{ $multiply: ["$_atlasScore", 10] }, "$_popularityScore"],
            },
          },
        },
      ];

      // Filter theo type
      if (type === "track") {
        pipeline.push({
          $match: { isDeleted: false, isPublic: true, status: "ready" },
        });
      } else if (type === "album") {
        pipeline.push({ $match: { isPublic: true, isDeleted: false } });
      } else if (type === "artist") {
        // có thể thêm filter nếu cần, hiện tại trả về tất cả artist matching
        pipeline.push({ $match: { isActive: true, isDeleted: false } });
      } else if (type === "playlist") {
        pipeline.push({
          $match: { visibility: "public", isDeleted: false, isSystem: true },
        });
      } else if (type === "genre") {
        pipeline.push({
          $match: { isDeleted: false, isActive: true },
        });
      }

      pipeline.push({ $sort: { _score: -1 } }, { $limit: limit });

      // Chỉ lấy _id + score + highlight tại bước aggregate
      // Populate sẽ thực hiện ngoài để tách concern & dễ cache
      pipeline.push({
        $project: {
          _id: 1,
          slug: 1,
          _score: 1,
          _highlightRaw: "$_highlights",
          // giữ thêm fields cần thiết để không cần query lại
          ...(type === "track" && {
            title: 1,
            coverImage: 1,
            duration: 1,
            playCount: 1,
            artist: 1,
            featuringArtists: 1,
          }),
          ...(type === "artist" && { name: 1, avatar: 1, totalFollowers: 1 }),
          ...(type === "album" && {
            title: 1,
            coverImage: 1,
            releaseYear: 1,
            artist: 1,
            totalTracks: 1,
          }),
          ...(type === "genre" && {
            name: 1,
            image: 1,
            trackCount: 1,
          }),
          ...(type === "playlist" && {
            title: 1,
            coverImage: 1,
            totalTracks: 1,
          }),
        },
      });

      const docs = await Model.aggregate(pipeline);

      if (!docs.length) {
        return this.fallbackRegex(Model, keyword, limit, type);
      }

      // Populate artist ở ngoài aggregate (nhẹ hơn $lookup trong aggregate)
      let populated: any[] = docs;
      if (type === "track" || type === "album") {
        populated = await Model.populate(docs, {
          path: "artist",
          select: "name slug",
        });
      }
      if (type === "track") {
        populated = await Model.populate(populated, {
          path: "featuringArtists",
          select: "name slug",
        });
      }
      // Xử lý highlight ở backend → FE chỉ việc render innerHTML
      return populated.map((doc: any) => ({
        ...doc,
        highlightHtml: processHighlights(doc._highlightRaw),
        _highlightRaw: undefined, // không trả raw ra client
      }));
    } catch (error: any) {
      console.warn(`[Search] Fallback to Regex for ${type}:`, error?.message);
      return this.fallbackRegex(Model, keyword, limit, type);
    }
  }

  // ───────────────────────────────────────────
  // 5. FALLBACK REGEX — khi Atlas không khả dụng
  // ───────────────────────────────────────────
  private async fallbackRegex(
    Model: any,
    keyword: string,
    limit: number,
    type: string,
  ) {
    const regex = new RegExp(escapeRegex(keyword), "i");
    const nameField = ["track", "album", "playlist"].includes(type) ? "title" : "name";
    const query: any = { [nameField]: regex };

    if (type === "track") {
      query.isDeleted = false;
      query.status = "ready";
      query.isPublic = true;
    } else if (type === "album") {
      query.isPublic = true;
      query.isDeleted = false;
    } else if (type === "artist") {
      query.isActive = true;
      query.isDeleted = false;
    } else if (type === "playlist") {
      query.visibility = "public";
      query.isDeleted = false;
    } else if (type === "genre") {
      query.isActive = true;
      query.isDeleted = false;
    }

    const base = Model.find(query);

    let result: any[] = [];

    if (type === "track") {
      result = await base
        .populate("artist", "name slug")
        .populate("featuringArtists", "name slug")
        .sort({ playCount: -1 })
        .limit(limit)
        .lean();
    } else if (type === "artist") {
      result = await base.sort({ totalFollowers: -1 }).limit(limit).lean();
    } else if (type === "album") {
      result = await base.populate("artist", "name slug").sort({ playCount: -1 }).limit(limit).lean();
    } else if (type === "playlist") {
      result = await base.sort({ playCount: -1 }).limit(limit).lean();
    } else if (type === "genre") {
      result = await base.sort({ trackCount: -1 }).limit(limit).lean();
    } else {
      result = await base.limit(limit).lean();
    }

    return result.map((doc: any) => {
      const fieldVal = doc[nameField] || "";
      const escapedQuery = escapeRegex(keyword);
      const highlightRegex = new RegExp(`(${escapedQuery})`, "gi");
      const highlightHtml = fieldVal.replace(highlightRegex, "<mark>$1</mark>");
      return { ...doc, highlightHtml };
    });
  }
}

export default new SearchService