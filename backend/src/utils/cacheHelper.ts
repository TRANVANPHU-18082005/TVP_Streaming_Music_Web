// utils/cacheHelper.ts
//
// Cache key format (verified):
//   buildCacheKey("track:detail:abc123", "admin", {}) → "track:detail:abc123:admin:{}"
//   buildCacheKey("track:list", "guest", {page:1})    → "track:list:guest:{\"page\":1}"
//
// Invalidation patterns use SCAN glob:
//   "track:detail:abc123:*"  matches all roles + empty filter for that id/slug
//   "track:list:*"           matches all roles + all filters
//
// Track invalidation must cover BOTH id AND slug variants of track:detail
// because getTrackById caches with whichever form the caller used.

import mongoose from "mongoose";
import { cacheRedis } from "../config/redis";

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CACHE KEY
// ─────────────────────────────────────────────────────────────────────────────

export const buildCacheKey = (
  prefix: string,
  role: string,
  filter: Record<string, unknown>,
): string => {
  const clean = Object.fromEntries(
    Object.entries(filter)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${prefix}:${role}:${JSON.stringify(clean)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export const withCacheTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs = 2_000,
): Promise<T | null> => {
  try {
    return await Promise.race([
      fn(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Cache timeout")), timeoutMs),
      ),
    ]);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCAN-BASED PATTERN DELETE (non-blocking, Upstash-safe)
// ─────────────────────────────────────────────────────────────────────────────

async function scanAndDelete(pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = (await (cacheRedis as any).scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      200,
    )) as [string, string[]];

    cursor = nextCursor;

    if (keys.length > 0) {
      await cacheRedis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}

async function scanAndDeleteMany(patterns: Iterable<string>): Promise<number> {
  const unique = Array.from(new Set(patterns)).filter(Boolean);
  if (!unique.length) return 0;

  const counts = await Promise.allSettled(unique.map(scanAndDelete));
  return counts.reduce((sum, r) => {
    return sum + (r.status === "fulfilled" ? r.value : 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK METADATA FETCHER (internal)
// ─────────────────────────────────────────────────────────────────────────────

interface TrackRelations {
  _id: string;
  slug: string;
  artist: string | null;
  album: string | null;
  genres: string[];
}

async function fetchTrackRelations(
  trackId: string,
): Promise<TrackRelations | null> {
  try {
    const Track = mongoose.model("Track");
    const t = (await Track.findById(trackId)
      .select("slug artist album genres")
      .lean()) as any;

    if (!t) return null;

    return {
      _id: t._id.toString(),
      slug: t.slug ?? "",
      artist: t.artist?.toString() ?? null,
      album: t.album?.toString() ?? null,
      genres: (t.genres ?? []).map((g: any) => g.toString()),
    };
  } catch {
    return null;
  }
}

async function fetchManyTrackRelations(
  trackIds: string[],
): Promise<TrackRelations[]> {
  try {
    const Track = mongoose.model("Track");
    const tracks = (await Track.find({ _id: { $in: trackIds } })
      .select("slug artist album genres")
      .lean()) as any[];

    return tracks.map((t: any) => ({
      _id: t._id.toString(),
      slug: t.slug ?? "",
      artist: t.artist?.toString() ?? null,
      album: t.album?.toString() ?? null,
      genres: (t.genres ?? []).map((g: any) => g.toString()),
    }));
  } catch {
    return [];
  }
}

async function fetchAffectedPlaylistIds(trackIds: string[]): Promise<string[]> {
  try {
    const Playlist = mongoose.model("Playlist");
    const playlists = (await Playlist.find({
      tracks: { $in: trackIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("_id")
      .lean()) as any[];

    return playlists.map((p: any) => p._id.toString());
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PATTERNS (pure — testable)
// ─────────────────────────────────────────────────────────────────────────────

function buildPatternsForTrack(
  rel: TrackRelations,
  affectedPlaylistIds: string[] = [],
): Set<string> {
  const p = new Set<string>();

  p.add(`track:detail:${rel._id}:*`);
  if (rel.slug) p.add(`track:detail:${rel.slug}:*`);

  p.add("track:list:*");
  p.add("track:search:*");

  if (rel.artist) p.add(`artist:tracks:${rel.artist}:*`);
  if (rel.album) p.add(`album:tracks:${rel.album}:*`);
  rel.genres.forEach((gId) => p.add(`genre:tracks:${gId}:*`));

  affectedPlaylistIds.forEach((pid) => p.add(`playlist:tracks:${pid}:*`));

  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INVALIDATION — 1 TRACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate toàn bộ cache liên quan đến 1 track.
 *
 * Tự động truy vết quan hệ (artist, album, genres, playlists) từ DB
 * và xóa sạch tất cả cache có thể chứa data của track này.
 *
 * Covers:
 *   track:detail:{id}:*       — detail theo MongoId
 *   track:detail:{slug}:*     — detail theo slug
 *   track:list:*              — mọi list/filter
 *   track:search:*            — search cache
 *   artist:tracks:{artist}:*  — artist page tracks
 *   album:tracks:{album}:*    — album page tracks
 *   genre:tracks:{gId}:*      — từng genre của track
 *   playlist:tracks:{pid}:*   — playlists chứa track
 */
export async function invalidateTrackCache(trackId: string): Promise<void> {
  try {
    const [rel, playlistIds] = await Promise.all([
      fetchTrackRelations(trackId),
      fetchAffectedPlaylistIds([trackId]),
    ]);

    const patterns = rel
      ? buildPatternsForTrack(rel, playlistIds)
      : new Set([
          `track:detail:${trackId}:*`,
          "track:list:*",
          "track:search:*",
        ]);

    const deleted = await scanAndDeleteMany(patterns);

    if (deleted > 0) {
      console.log(
        `[Cache] Invalidated ${deleted} keys for track ${rel?.slug ?? trackId}` +
          (playlistIds.length ? ` (${playlistIds.length} playlists)` : ""),
      );
    }
  } catch (err) {
    console.error("[Cache] invalidateTrackCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INVALIDATION — NHIỀU TRACKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate cache cho nhiều tracks trong 1 pass.
 *
 * Tối ưu:
 *   - Fetch quan hệ tất cả tracks trong 1 DB query
 *   - Gom patterns vào 1 Set (tự dedup — tránh scan trùng)
 *   - Scan & delete song song
 *
 * Dùng sau: bulkUpdateTracks, deleteAlbum (unlink tracks),
 *           retryFailedTracks, physicalCleanupExpiredTracks.
 */
export async function invalidateTracksCache(trackIds: string[]): Promise<void> {
  if (!trackIds?.length) return;

  try {
    const [relations, playlistIds] = await Promise.all([
      fetchManyTrackRelations(trackIds),
      fetchAffectedPlaylistIds(trackIds),
    ]);

    const allPatterns = new Set<string>();

    allPatterns.add("track:list:*");
    allPatterns.add("track:search:*");

    // Detail patterns cho tracks không còn trong DB (đã hard-delete)
    const foundIds = new Set(relations.map((r) => r._id));
    trackIds
      .filter((id) => !foundIds.has(id))
      .forEach((id) => allPatterns.add(`track:detail:${id}:*`));

    // Gom từ mọi track
    relations.forEach((rel) => {
      buildPatternsForTrack(rel, playlistIds).forEach((p) =>
        allPatterns.add(p),
      );
    });

    const deleted = await scanAndDeleteMany(allPatterns);

    console.log(
      `[Cache] Bulk invalidated ${deleted} keys` +
        ` for ${trackIds.length} tracks` +
        ` (${allPatterns.size} patterns, ${playlistIds.length} playlists)`,
    );
  } catch (err) {
    console.error("[Cache] invalidateTracksCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────
interface AlbumRelations {
  _id: string;
  slug: string;
  artist: string | null;
  genres: string[];
}

async function fetchAlbumRelations(
  albumId: string,
): Promise<AlbumRelations | null> {
  try {
    const Album = mongoose.model("Album");
    const a = (await Album.findById(albumId)
      .select("slug artist genres")
      .lean()) as any;

    if (!a) return null;

    return {
      _id: a._id.toString(),
      slug: a.slug ?? "",
      artist: a.artist?.toString() ?? null,
      genres: (a.genres ?? []).map((g: any) => g.toString()),
    };
  } catch {
    return null;
  }
}
/**
 * Invalidate toàn bộ cache liên quan đến 1 Album.
 * * Tự động dọn dẹp:
 * - album:detail:{id/slug}:* -> Trang chi tiết album
 * - album:tracks:{id}:* -> Danh sách bài hát trong album (Virtual Scroll source)
 * - artist:albums:{artist}:* -> Danh sách album của nghệ sĩ đó
 * - album:list:* -> Các danh sách album chung (New, Top...)
 */
export async function invalidateAlbumCache(albumId: string): Promise<void> {
  try {
    const rel = await fetchAlbumRelations(albumId);
    const p = new Set<string>();

    // 1. Luôn xóa các list tổng và search
    p.add("album:list:*");
    p.add("album:search:*");

    if (rel) {
      // 2. Xóa chi tiết Album (ID & Slug)
      p.add(`album:detail:${rel._id}:*`);
      if (rel.slug) p.add(`album:detail:${rel.slug}:*`);

      // 3. Xóa nguồn dữ liệu cho Virtual Scroll bài hát trong Album
      p.add(`album:tracks:${rel._id}:*`);

      // 4. Xóa cache danh sách Album của Artist sở hữu
      if (rel.artist) p.add(`artist:albums:${rel.artist}:*`);
    } else {
      // Fallback nếu Album đã bị xóa khỏi DB
      p.add(`album:detail:${albumId}:*`);
      p.add(`album:tracks:${albumId}:*`);
    }

    const deleted = await scanAndDeleteMany(p);

    if (deleted > 0) {
      console.log(
        `[Cache] Invalidated ${deleted} keys for album: ${rel?.slug ?? albumId}`,
      );
    }
  } catch (err) {
    console.error("[Cache] invalidateAlbumCache error:", err);
  }
}
export async function invalidateAlbumListCache(): Promise<void> {
  try {
    const deleted = await scanAndDelete("album:list:*");
    if (deleted > 0)
      console.log(`[Cache] Invalidated ${deleted} album:list keys`);
  } catch (err) {
    console.error("[Cache] invalidateAlbumListCache error:", err);
  }
}

export async function invalidateAlbumTracksCache(
  albumId: string,
): Promise<void> {
  try {
    const deleted = await scanAndDelete(`album:tracks:${albumId}:*`);
    if (deleted > 0)
      console.log(
        `[Cache] Invalidated ${deleted} album:tracks:${albumId} keys`,
      );
  } catch (err) {
    console.error("[Cache] invalidateAlbumTracksCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────
interface ArtistRelations {
  _id: string;
  slug: string;
}

async function fetchArtistRelations(
  artistId: string,
): Promise<ArtistRelations | null> {
  try {
    const Artist = mongoose.model("Artist");
    const a = (await Artist.findById(artistId).select("slug").lean()) as any;
    if (!a) return null;

    return {
      _id: a._id.toString(),
      slug: a.slug ?? "",
    };
  } catch {
    return null;
  }
}
/**
 * Invalidate toàn bộ cache liên quan đến 1 Nghệ sĩ.
 * * Tự động dọn dẹp:
 * - artist:detail:{id/slug}:* -> Trang profile/biography của nghệ sĩ
 * - artist:tracks:{id}:* -> Danh sách bài hát (Virtual Scroll source)
 * - artist:albums:{id}:* -> Danh sách album của nghệ sĩ
 * - artist:list:* -> Danh sách nghệ sĩ (trang Explore/Top Artists)
 * - track:list:* -> Vì track list thường populate tên/avatar artist
 */
export async function invalidateArtistCache(artistId: string): Promise<void> {
  try {
    const rel = await fetchArtistRelations(artistId);
    const p = new Set<string>();

    // 1. Luôn xóa các list tổng và tìm kiếm nghệ sĩ
    p.add("artist:list:*");
    p.add("artist:search:*");

    // Khi info Artist đổi, các list track chung cũng nên refresh để cập nhật avatar/name mới
    p.add("track:list:*");

    if (rel) {
      // 2. Xóa chi tiết Artist (ID & Slug)
      p.add(`artist:detail:${rel._id}:*`);
      if (rel.slug) p.add(`artist:detail:${rel.slug}:*`);

      // 3. Xóa các danh sách thực thể "con" của Artist này
      p.add(`artist:tracks:${rel._id}:*`);
      p.add(`artist:albums:${rel._id}:*`);
    } else {
      // Fallback
      p.add(`artist:detail:${artistId}:*`);
      p.add(`artist:tracks:${artistId}:*`);
      p.add(`artist:albums:${artistId}:*`);
    }

    const deleted = await scanAndDeleteMany(p);

    if (deleted > 0) {
      console.log(
        `[Cache] Invalidated ${deleted} keys for artist: ${rel?.slug ?? artistId}`,
      );
    }
  } catch (err) {
    console.error("[Cache] invalidateArtistCache error:", err);
  }
}
export async function invalidateArtistListCache(): Promise<void> {
  try {
    const deleted = await scanAndDelete("artist:list:*");
    if (deleted > 0)
      console.log(`[Cache] Invalidated ${deleted} artist:list keys`);
  } catch (err) {
    console.error("[Cache] invalidateArtistListCache error:", err);
  }
}

export async function invalidateArtistTracksCache(
  artistId: string,
): Promise<void> {
  try {
    const deleted = await scanAndDelete(`artist:tracks:${artistId}:*`);
    if (deleted > 0)
      console.log(
        `[Cache] Invalidated ${deleted} artist:tracks:${artistId} keys`,
      );
  } catch (err) {
    console.error("[Cache] invalidateArtistTracksCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENRE CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────
interface GenreRelations {
  _id: string;
  slug: string;
}

async function fetchGenreRelations(
  genreId: string,
): Promise<GenreRelations | null> {
  try {
    const Genre = mongoose.model("Genre");
    const g = (await Genre.findById(genreId).select("slug").lean()) as any;
    if (!g) return null;

    return {
      _id: g._id.toString(),
      slug: g.slug ?? "",
    };
  } catch {
    return null;
  }
}
/**
 * Invalidate toàn bộ cache liên quan đến 1 Thể loại.
 * * Tự động dọn dẹp:
 * - genre:list:* -> Danh sách tất cả các thể loại (trang Discover/Explore)
 * - genre:detail:{id/slug}:* -> Thông tin chi tiết 1 thể loại
 * - genre:tracks:{id}:* -> Danh sách bài hát thuộc thể loại (Virtual Scroll source)
 
 */
export async function invalidateGenreCache(genreId: string): Promise<void> {
  try {
    const rel = await fetchGenreRelations(genreId);
    const p = new Set<string>();

    // 1. Luôn xóa các list tổng (trang Khám phá)
    p.add("genre:list:*");
    p.add("genre:search:*");

    if (rel) {
      // 2. Xóa chi tiết Genre (ID & Slug)
      p.add(`genre:detail:${rel._id}:*`);
      if (rel.slug) p.add(`genre:detail:${rel.slug}:*`);

      // 3. Xóa các danh sách thực thể thuộc Genre này
      p.add(`genre:tracks:${rel._id}:*`);
    } else {
      // Fallback cho ID
      p.add(`genre:detail:${genreId}:*`);
      p.add(`genre:tracks:${genreId}:*`);
    }

    const deleted = await scanAndDeleteMany(p);

    if (deleted > 0) {
      console.log(
        `[Cache] Invalidated ${deleted} keys for genre: ${rel?.slug ?? genreId}`,
      );
    }
  } catch (err) {
    console.error("[Cache] invalidateGenreCache error:", err);
  }
}
export async function invalidateGenreListCache(): Promise<void> {
  try {
    const deleted = await scanAndDelete("genre:list:*");
    if (deleted > 0)
      console.log(`[Cache] Invalidated ${deleted} genre:list keys`);
  } catch (err) {
    console.error("[Cache] invalidateGenreListCache error:", err);
  }
}

export async function invalidateGenreTracksCache(
  genreId: string,
): Promise<void> {
  try {
    const deleted = await scanAndDelete(`genre:tracks:${genreId}:*`);
    if (deleted > 0)
      console.log(
        `[Cache] Invalidated ${deleted} genre:tracks:${genreId} keys`,
      );
  } catch (err) {
    console.error("[Cache] invalidateGenreTracksCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────
interface PlaylistRelations {
  _id: string;
  owner: string | null;
}

async function fetchPlaylistRelations(
  playlistId: string,
): Promise<PlaylistRelations | null> {
  try {
    const Playlist = mongoose.model("Playlist");
    const p = (await Playlist.findById(playlistId)
      .select("owner")
      .lean()) as any;

    if (!p) return null;

    return {
      _id: p._id.toString(),
      owner: p.owner?.toString() ?? null,
    };
  } catch {
    return null;
  }
}
/**
 * Invalidate toàn bộ cache liên quan đến 1 Playlist.
 * * Tự động dọn dẹp:
 * - playlist:detail:{id}:* -> Trang chi tiết playlist
 * - playlist:tracks:{id}:* -> Nguồn bài hát cho Virtual Scroll trong playlist
 * - playlist:list:owner:{uid}:* -> Danh sách playlist của người tạo
 * - playlist:list:* -> Các danh sách playlist công khai/gợi ý
 */
export async function invalidatePlaylistCache(
  playlistId: string,
): Promise<void> {
  try {
    const rel = await fetchPlaylistRelations(playlistId);
    const p = new Set<string>();

    // 1. Luôn xóa các list tổng và search playlist
    p.add("playlist:list:*");
    p.add("playlist:search:*");

    if (rel) {
      // 2. Xóa chi tiết Playlist
      p.add(`playlist:detail:${rel._id}:*`);

      // 3. Xóa nguồn dữ liệu bài hát trong Playlist (Dành cho Virtual Scroll)
      p.add(`playlist:tracks:${rel._id}:*`);

      // 4. Xóa danh sách playlist của Owner (trang Library/Profile)
      if (rel.owner) {
        // Lưu ý: Escaping dấu hai chấm nếu buildCacheKey của Phú dùng định dạng này
        p.add(`playlist:list:owner\\:${rel.owner}:*`);
      }
    } else {
      // Fallback nếu đã xóa Playlist khỏi DB
      p.add(`playlist:detail:${playlistId}:*`);
      p.add(`playlist:tracks:${playlistId}:*`);
    }

    const deleted = await scanAndDeleteMany(p);

    if (deleted > 0) {
      console.log(
        `[Cache] Invalidated ${deleted} keys for playlist: ${playlistId}`,
      );
    }
  } catch (err) {
    console.error("[Cache] invalidatePlaylistCache error:", err);
  }
}
export async function invalidatePlaylistListCache(
  userId?: string,
): Promise<void> {
  try {
    const tasks = [scanAndDelete("playlist:list:*")];
    if (userId) tasks.push(scanAndDelete(`playlist:list:owner\\:${userId}:*`));
    const counts = await Promise.all(tasks);
    const total = counts.reduce((s, n) => s + n, 0);
    if (total > 0)
      console.log(`[Cache] Invalidated ${total} playlist:list keys`);
  } catch (err) {
    console.error("[Cache] invalidatePlaylistListCache error:", err);
  }
}

export async function invalidatePlaylistTracksCache(
  playlistId: string,
): Promise<void> {
  try {
    const deleted = await scanAndDelete(`playlist:tracks:${playlistId}:*`);
    if (deleted > 0)
      console.log(
        `[Cache] Invalidated ${deleted} playlist:tracks:${playlistId} keys`,
      );
  } catch (err) {
    console.error("[Cache] invalidatePlaylistTracksCache error:", err);
  }
}
/**
 * Invalidate Playlist cá nhân của 1 User.
 * Dùng khi: Tạo mới, xóa, đổi tên, đổi cover 1 playlist cá nhân.
 */
export async function invalidateUserPlaylistCache(
  playlistId: string,
  userId: string,
  isSystem: boolean = false,
): Promise<void> {
  const p = new Set<string>();

  // 1. Luôn xóa chi tiết Playlist này
  p.add(`playlist:detail:${playlistId}:*`);
  p.add(`playlist:tracks:${playlistId}:*`);

  // 2. Chỉ xóa list của RIÊNG người đó (User-specific)
  p.add(`playlist:list:owner\\:${userId}:*`);

  // 3. Nếu là System Playlist, mới xóa list hệ thống/toàn cục
  if (isSystem) {
    p.add("playlist:list:system:*");
    p.add("playlist:list:public:*");
  }

  const deleted = await scanAndDeleteMany(p);
  console.log(
    `[Cache] Invalidated ${deleted} keys for playlist ${playlistId} (Owner: ${userId})`,
  );
}

/**
 * Hàm chuyên biệt để chỉ xóa list của 1 User (Ví dụ: Khi user tạo playlist mới)
 */
export async function invalidateUserPlaylistListCache(
  userId: string,
): Promise<void> {
  const deleted = await scanAndDelete(`playlist:list:owner\\:${userId}:*`);
  if (deleted > 0)
    console.log(`[Cache] Invalidated ${deleted} keys for user list: ${userId}`);
}
