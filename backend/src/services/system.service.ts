import mongoose from "mongoose";
import Genre from "../models/Genre";
import Artist from "../models/Artist";
import Album from "../models/Album";
import Track from "../models/Track";
import Playlist from "../models/Playlist";
import Like from "../models/Like";
import Follow from "../models/Follow";
import PlayLog from "../models/PlayLog";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Batch size cân bằng giữa throughput và RAM safety cho MongoDB bulkWrite */
const BATCH_SIZE = 1000;

/**
 * Khoảng thời gian tính monthlyListeners (30 ngày gần nhất).
 * PlayLog có TTL 8 ngày, nên thực tế chỉ cover ~8 ngày —
 * nhưng service vẫn set 30 ngày để tương thích khi TTL tăng lên sau này.
 */
const MONTHLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ghi batch bulkWrite khi đầy, trả về số ops đã flush.
 * Dùng ordered:false để không dừng lại khi 1 document lỗi.
 *
 * NOTE: Dùng `mongoose.Model<mongoose.AnyObject>` (thay vì `Model<any>`)
 * để TypeScript không cố unify concrete document types với Record<string,any>,
 * tránh lỗi "Types of property 'countDocuments' are incompatible".
 */
async function flushBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { bulkWrite: (ops: any[], options?: any) => Promise<any> },
  ops: any[],
): Promise<number> {
  if (ops.length === 0) return 0;
  await model.bulkWrite(ops, { ordered: false });
  return ops.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SyncResult {
  success: boolean;
  count?: number;
  error?: unknown;
}

interface FullSyncResult {
  genreStats: SyncResult;
  artistStats: SyncResult;
  albumStats: SyncResult;
  trackStats: SyncResult;
  playlistStats: SyncResult;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

class StatsService {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. GENRE STATS
  // Fields: trackCount, albumCount, artistCount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Đồng bộ thống kê cho tất cả Genre.
   *
   * Chiến lược:
   * - Aggregate Track/Album/Artist theo $genres field để đếm số lượng liên kết.
   * - Dùng Map để lookup O(1) thay vì query lặp lại từng genre.
   * - Cursor + batch bulkWrite để tránh OOM khi collection lớn.
   */
  async syncGenreStats(): Promise<SyncResult> {
    console.time("⏱️ syncGenreStats");
    let totalUpdated = 0;

    try {
      // A. Tính số Track ready, public thuộc từng genre
      const [trackAgg, albumAgg, artistAgg, likeAgg] = await Promise.all([
        Track.aggregate(
          [
            {
              $match: {
                status: "ready",
                isDeleted: false,
                isPublic: true,
                genres: { $exists: true, $ne: [] },
              },
            },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),

        // Đếm Album có genres field (không bắt buộc có isPublic ở Album schema hiện tại)
        Album.aggregate(
          [
            { $match: { genres: { $exists: true, $ne: [] } } },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),

        Artist.aggregate(
          [
            { $match: { genres: { $exists: true, $ne: [] }, isActive: true } },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),

        // Tổng like của tất cả Track thuộc genre (join qua Track)
        Like.aggregate(
          [
            { $match: { targetType: "track" } },
            {
              $lookup: {
                from: "tracks",
                localField: "targetId",
                foreignField: "_id",
                as: "track",
              },
            },
            { $unwind: "$track" },
            {
              $match: {
                "track.status": "ready",
                "track.isDeleted": false,
                "track.isPublic": true,
              },
            },
            { $unwind: "$track.genres" },
            { $group: { _id: "$track.genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),
      ]);

      // B. Lookup Maps
      const trackMap = new Map<string, number>(
        trackAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const albumMap = new Map<string, number>(
        albumAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const artistMap = new Map<string, number>(
        artistAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const likeMap = new Map<string, number>(
        likeAgg.map((i) => [i._id?.toString(), i.count]),
      );

      // C. Cursor loop + batch write
      const cursor = Genre.find().select("_id").cursor();
      let ops: any[] = [];

      for await (const genre of cursor) {
        const id = genre._id.toString();

        ops.push({
          updateOne: {
            filter: { _id: genre._id },
            update: {
              $set: {
                trackCount: trackMap.get(id) ?? 0,
                albumCount: albumMap.get(id) ?? 0,
                artistCount: artistMap.get(id) ?? 0,
                totalLikes: likeMap.get(id) ?? 0,
              },
            },
          },
        });

        if (ops.length >= BATCH_SIZE) {
          totalUpdated += await flushBatch(Genre, ops);
          ops = [];
        }
      }

      totalUpdated += await flushBatch(Genre, ops);

      console.timeEnd("⏱️ syncGenreStats");
      console.log(`✅ syncGenreStats: ${totalUpdated} genres updated`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ syncGenreStats failed:", error);
      return { success: false, error };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ARTIST STATS
  // Fields: totalTracks, totalAlbums, totalFollowers, monthlyListeners
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Đồng bộ thống kê cho tất cả Artist.
   *
   * monthlyListeners:
   * - Đếm số userId DISTINCT đã nghe track của artist trong 30 ngày qua.
   * - PlayLog → join Track để lấy artist → group by artist → countDistinct userId.
   * - Anonymous play (userId = null) không tính vào monthlyListeners
   *   (consistent với cách Spotify định nghĩa).
   *
   * totalFollowers:
   * - Đếm trực tiếp từ Follow collection, group by artistId.
   */
  async syncArtistStats(): Promise<SyncResult> {
    console.time("⏱️ syncArtistStats");
    let totalUpdated = 0;

    try {
      const since = new Date(Date.now() - MONTHLY_WINDOW_MS);

      const [trackAgg, albumAgg, followAgg, monthlyAgg] = await Promise.all([
        // Tổng track ready của artist
        Track.aggregate(
          [
            {
              $match: {
                status: "ready",
                isDeleted: false,
                isPublic: true,
                artist: { $ne: null },
              },
            },
            { $group: { _id: "$artist", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),

        // Tổng album của artist (public)
        Album.aggregate(
          [
            { $match: { artist: { $ne: null }, isPublic: true } },
            { $group: { _id: "$artist", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),

        // Tổng followers từ Follow collection
        Follow.aggregate(
          [{ $group: { _id: "$artistId", count: { $sum: 1 } } }],
          { allowDiskUse: true },
        ),

        // Monthly listeners: unique userId đã nghe track của artist trong 30 ngày
        PlayLog.aggregate(
          [
            {
              $match: {
                listenedAt: { $gte: since },
                userId: { $ne: null }, // Chỉ đếm logged-in users
              },
            },
            {
              $lookup: {
                from: "tracks",
                localField: "trackId",
                foreignField: "_id",
                as: "track",
              },
            },
            { $unwind: "$track" },
            {
              $match: {
                "track.status": "ready",
                "track.isDeleted": false,
                "track.isPublic": true,
              },
            },
            // Group by (artist, user) để deduplicate — 1 user nghe nhiều lần chỉ tính 1
            {
              $group: {
                _id: { artist: "$track.artist", user: "$userId" },
              },
            },
            // Group by artist để đếm unique listeners
            {
              $group: {
                _id: "$_id.artist",
                monthlyListeners: { $sum: 1 },
              },
            },
          ],
          { allowDiskUse: true },
        ),
      ]);

      // Lookup maps
      const trackMap = new Map<string, number>(
        trackAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const albumMap = new Map<string, number>(
        albumAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const followMap = new Map<string, number>(
        followAgg.map((i) => [i._id?.toString(), i.count]),
      );
      const monthlyMap = new Map<string, number>(
        monthlyAgg.map((i) => [i._id?.toString(), i.monthlyListeners]),
      );

      // Cursor loop
      const cursor = Artist.find().select("_id").cursor();
      let ops: any[] = [];

      for await (const artist of cursor) {
        const id = artist._id.toString();

        ops.push({
          updateOne: {
            filter: { _id: artist._id },
            update: {
              $set: {
                totalTracks: trackMap.get(id) ?? 0,
                totalAlbums: albumMap.get(id) ?? 0,
                totalFollowers: followMap.get(id) ?? 0,
                monthlyListeners: monthlyMap.get(id) ?? 0,
              },
            },
          },
        });

        if (ops.length >= BATCH_SIZE) {
          totalUpdated += await flushBatch(Artist, ops);
          ops = [];
        }
      }

      totalUpdated += await flushBatch(Artist, ops);

      console.timeEnd("⏱️ syncArtistStats");
      console.log(`✅ syncArtistStats: ${totalUpdated} artists updated`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ syncArtistStats failed:", error);
      return { success: false, error };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ALBUM STATS
  // Fields: totalTracks, totalDuration, likeCount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Đồng bộ thống kê cho tất cả Album.
   *
   * - totalTracks / totalDuration: Tính từ Track collection (status=ready, không bị xóa).
   * - likeCount: Đếm từ Like collection với targetType="album".
   */
  async syncAlbumStats(): Promise<SyncResult> {
    console.time("⏱️ syncAlbumStats");
    let totalUpdated = 0;

    try {
      const [trackAgg, likeAgg] = await Promise.all([
        // Track stats per album
        Track.aggregate(
          [
            {
              $match: {
                status: "ready",
                isDeleted: false,
                isPublic: true,
                album: { $ne: null },
              },
            },
            {
              $group: {
                _id: "$album",
                totalTracks: { $sum: 1 },
                totalDuration: { $sum: { $ifNull: ["$duration", 0] } },
              },
            },
          ],
          { allowDiskUse: true },
        ),

        // Like count per album
        Like.aggregate(
          [
            { $match: { targetType: "album" } },
            { $group: { _id: "$targetId", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),
      ]);

      const trackMap = new Map<
        string,
        { totalTracks: number; totalDuration: number }
      >(trackAgg.map((i) => [i._id?.toString(), i]));
      const likeMap = new Map<string, number>(
        likeAgg.map((i) => [i._id?.toString(), i.count]),
      );

      const cursor = Album.find().select("_id").cursor();
      let ops: any[] = [];

      for await (const album of cursor) {
        const id = album._id.toString();
        const stats = trackMap.get(id);

        ops.push({
          updateOne: {
            filter: { _id: album._id },
            update: {
              $set: {
                totalTracks: stats?.totalTracks ?? 0,
                totalDuration: stats?.totalDuration ?? 0,
                likeCount: likeMap.get(id) ?? 0,
              },
            },
          },
        });

        if (ops.length >= BATCH_SIZE) {
          totalUpdated += await flushBatch(Album, ops);
          ops = [];
        }
      }

      totalUpdated += await flushBatch(Album, ops);

      console.timeEnd("⏱️ syncAlbumStats");
      console.log(`✅ syncAlbumStats: ${totalUpdated} albums updated`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ syncAlbumStats failed:", error);
      return { success: false, error };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. TRACK STATS
  // Fields: playCount, likeCount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Đồng bộ thống kê cho tất cả Track.
   *
   * playCount:
   * - Đếm tổng số lượt play từ PlayLog (không giới hạn thời gian).
   * - Note: PlayLog có TTL 8 ngày, nên playCount từ service này chỉ phản ánh
   *   8 ngày gần nhất. Nếu muốn playCount lifetime, cần lưu snapshot riêng
   *   hoặc tắt TTL index trên PlayLog.
   *
   * likeCount:
   * - Đếm từ Like collection với targetType="track".
   */
  async syncTrackStats(): Promise<SyncResult> {
    console.time("⏱️ syncTrackStats");
    let totalUpdated = 0;

    try {
      const [playAgg, likeAgg] = await Promise.all([
        // Total play count per track từ PlayLog
        PlayLog.aggregate(
          [{ $group: { _id: "$trackId", playCount: { $sum: 1 } } }],
          { allowDiskUse: true },
        ),

        // Like count per track
        Like.aggregate(
          [
            { $match: { targetType: "track" } },
            { $group: { _id: "$targetId", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),
      ]);

      const playMap = new Map<string, number>(
        playAgg.map((i) => [i._id?.toString(), i.playCount]),
      );
      const likeMap = new Map<string, number>(
        likeAgg.map((i) => [i._id?.toString(), i.count]),
      );

      const cursor = Track.find({ isDeleted: false }).select("_id").cursor();
      let ops: any[] = [];

      for await (const track of cursor) {
        const id = track._id.toString();

        ops.push({
          updateOne: {
            filter: { _id: track._id },
            update: {
              $set: {
                playCount: playMap.get(id) ?? 0,
                likeCount: likeMap.get(id) ?? 0,
              },
            },
          },
        });

        if (ops.length >= BATCH_SIZE) {
          totalUpdated += await flushBatch(Track, ops);
          ops = [];
        }
      }

      totalUpdated += await flushBatch(Track, ops);

      console.timeEnd("⏱️ syncTrackStats");
      console.log(`✅ syncTrackStats: ${totalUpdated} tracks updated`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ syncTrackStats failed:", error);
      return { success: false, error };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PLAYLIST STATS
  // Fields: totalTracks, totalDuration, likeCount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Đồng bộ thống kê cho tất cả Playlist.
   *
   * Playlist lưu danh sách Track dưới dạng mảng ObjectId (tracks: []).
   * Phải $lookup hoặc $match _id in [...] để lấy duration thực tế.
   *
   * Chiến lược hiệu quả:
   * - Aggregate từ Track side: group by _id, tính duration.
   * - Aggregate từ Playlist side: unwind tracks array → group by playlist._id.
   *   Cách này chính xác vì track có thể xuất hiện trong nhiều playlist.
   */
  async syncPlaylistStats(): Promise<SyncResult> {
    console.time("⏱️ syncPlaylistStats");
    let totalUpdated = 0;

    try {
      const [playlistTrackAgg, likeAgg] = await Promise.all([
        // Unwind tracks array của mỗi playlist → join Track → tính totalTracks + totalDuration
        Playlist.aggregate(
          [
            // Chỉ xử lý playlist có ít nhất 1 track
            { $match: { tracks: { $exists: true, $not: { $size: 0 } } } },
            { $project: { tracks: 1 } },
            { $unwind: "$tracks" },
            {
              $lookup: {
                from: "tracks",
                localField: "tracks",
                foreignField: "_id",
                as: "trackDoc",
              },
            },
            { $unwind: "$trackDoc" },
            // Chỉ tính track hợp lệ (ready, public, chưa bị xóa)
            {
              $match: {
                "trackDoc.status": "ready",
                "trackDoc.isDeleted": false,
                "trackDoc.isPublic": true,
              },
            },
            {
              $group: {
                _id: "$_id",
                totalTracks: { $sum: 1 },
                totalDuration: {
                  $sum: { $ifNull: ["$trackDoc.duration", 0] },
                },
              },
            },
          ],
          { allowDiskUse: true },
        ),

        // Like count per playlist
        Like.aggregate(
          [
            { $match: { targetType: "playlist" } },
            { $group: { _id: "$targetId", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true },
        ),
      ]);

      const statsMap = new Map<
        string,
        { totalTracks: number; totalDuration: number }
      >(playlistTrackAgg.map((i) => [i._id?.toString(), i]));
      const likeMap = new Map<string, number>(
        likeAgg.map((i) => [i._id?.toString(), i.count]),
      );

      const cursor = Playlist.find().select("_id").cursor();
      let ops: any[] = [];

      for await (const playlist of cursor) {
        const id = playlist._id.toString();
        const stats = statsMap.get(id);

        ops.push({
          updateOne: {
            filter: { _id: playlist._id },
            update: {
              $set: {
                // Playlist rỗng hoặc không có track hợp lệ → reset về 0
                totalTracks: stats?.totalTracks ?? 0,
                totalDuration: stats?.totalDuration ?? 0,
                likeCount: likeMap.get(id) ?? 0,
              },
            },
          },
        });

        if (ops.length >= BATCH_SIZE) {
          totalUpdated += await flushBatch(Playlist, ops);
          ops = [];
        }
      }

      totalUpdated += await flushBatch(Playlist, ops);

      console.timeEnd("⏱️ syncPlaylistStats");
      console.log(`✅ syncPlaylistStats: ${totalUpdated} playlists updated`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ syncPlaylistStats failed:", error);
      return { success: false, error };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. SINGLE-ENTITY RECALCULATION
  // Dùng cho realtime update sau khi có thay đổi cụ thể (không cần sync toàn bộ)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tính lại stats cho 1 Album cụ thể (gọi sau khi upload/xóa track).
   */
  async recalcAlbum(albumId: string): Promise<void> {
    await Album.calculateStats(albumId);

    // Cascade lên Artist nếu cần
    const album = await Album.findById(albumId).select("artist").lean();
    if (album?.artist) {
      await Artist.calculateStats(album.artist.toString());
    }
  }

  /**
   * Tính lại stats cho 1 Artist cụ thể.
   */
  async recalcArtist(artistId: string): Promise<void> {
    await Artist.calculateStats(artistId);
  }

  /**
   * Tính lại stats cho 1 Playlist cụ thể (gọi sau khi thêm/xóa track).
   */
  async recalcPlaylist(playlistId: string): Promise<void> {
    await Playlist.calculateStats(playlistId);
  }

  /**
   * Tính lại likeCount cho 1 target (track | album | playlist).
   * Dùng sau khi người dùng like/unlike để cập nhật realtime.
   */
  async recalcLikeCount(
    targetId: string,
    targetType: "track" | "album" | "playlist",
  ): Promise<void> {
    const count = await Like.countDocuments({ targetId, targetType });

    // Cách dùng if/else để TypeScript hiểu rõ kiểu dữ liệu trong từng nhánh
    if (targetType === "track") {
      await Track.findByIdAndUpdate(targetId, { likeCount: count });
    } else if (targetType === "album") {
      await Album.findByIdAndUpdate(targetId, { likeCount: count });
    } else {
      await Playlist.findByIdAndUpdate(targetId, { likeCount: count });
    }
  }

  /**
   * Tính lại totalFollowers cho 1 Artist cụ thể.
   * Gọi ngay sau sự kiện follow/unfollow để cập nhật realtime.
   */
  async recalcFollowerCount(artistId: string): Promise<void> {
    const count = await Follow.countDocuments({ artistId });
    await Artist.findByIdAndUpdate(artistId, { totalFollowers: count });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. FULL SYNC
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Chạy toàn bộ sync theo thứ tự an toàn (sequential để tránh CPU spike).
   *
   * Thứ tự:
   * 1. Track  → 2. Album (phụ thuộc Track) → 3. Artist (phụ thuộc Track + Album)
   *           → 4. Genre (phụ thuộc Track + Album + Artist)
   *           → 5. Playlist (độc lập, phụ thuộc Track)
   */
  async syncAll(): Promise<FullSyncResult> {
    console.log("🚀 Starting Full Stats Sync...");
    console.time("⏱️ Total Sync Duration");

    const trackStats = await this.syncTrackStats();
    const albumStats = await this.syncAlbumStats();
    const artistStats = await this.syncArtistStats();
    const genreStats = await this.syncGenreStats();
    const playlistStats = await this.syncPlaylistStats();

    console.timeEnd("⏱️ Total Sync Duration");
    console.log("✅ Full Stats Sync Complete");

    return {
      genreStats,
      artistStats,
      albumStats,
      trackStats,
      playlistStats,
      timestamp: new Date(),
    };
  }
}

export default new StatsService();
