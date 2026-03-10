import { Types } from "mongoose";
import Genre from "../models/Genre";
import Artist from "../models/Artist";
import Album from "../models/Album";
import Track from "../models/Track";

/**
 * Cấu hình Batch Size
 * 1000 là con số cân bằng tốt giữa tốc độ và độ an toàn cho MongoDB
 */
const BATCH_SIZE = 1000;

class SystemService {
  /**
   * 1. SYNC GENRE STATS
   * Tính toán lại số lượng Track, Album, Artist thuộc về mỗi Genre
   */
  async syncGenreStats() {
    console.time("⏱️ Sync Genre Stats");
    let totalUpdated = 0;

    try {
      // A. Aggregation: Tính toán số liệu (Dùng allowDiskUse để tránh lỗi 100MB limit)
      const [trackAgg, albumAgg, artistAgg] = await Promise.all([
        Track.aggregate(
          [
            {
              $match: {
                status: "ready",
                isDeleted: false,
                genres: { $exists: true, $ne: [] },
              },
            },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true }
        ),
        Album.aggregate(
          [
            { $match: { genres: { $exists: true, $ne: [] } } },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true }
        ),
        Artist.aggregate(
          [
            { $match: { genres: { $exists: true, $ne: [] } } },
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true }
        ),
      ]);

      // B. Map dữ liệu để tra cứu nhanh (O(1))
      // Map<GenreID_String, Count>
      const trackMap = new Map(
        trackAgg.map((i) => [i._id?.toString(), i.count])
      );
      const albumMap = new Map(
        albumAgg.map((i) => [i._id?.toString(), i.count])
      );
      const artistMap = new Map(
        artistAgg.map((i) => [i._id?.toString(), i.count])
      );

      // C. Duyệt qua từng Genre bằng Cursor (Tiết kiệm RAM Node.js)
      const cursor = Genre.find().select("_id").cursor();
      let opsBatch: any[] = [];

      for await (const genre of cursor) {
        const id = genre._id.toString();

        // Push lệnh update vào batch
        opsBatch.push({
          updateOne: {
            filter: { _id: genre._id },
            update: {
              $set: {
                trackCount: trackMap.get(id) || 0,
                albumCount: albumMap.get(id) || 0,
                artistCount: artistMap.get(id) || 0,
              },
            },
          },
        });

        // Nếu batch đầy -> Ghi xuống DB -> Reset batch
        if (opsBatch.length >= BATCH_SIZE) {
          await Genre.bulkWrite(opsBatch, { ordered: false });
          totalUpdated += opsBatch.length;
          opsBatch = []; // Giải phóng bộ nhớ
        }
      }

      // D. Xử lý nốt batch cuối cùng (nếu còn)
      if (opsBatch.length > 0) {
        await Genre.bulkWrite(opsBatch, { ordered: false });
        totalUpdated += opsBatch.length;
      }

      console.timeEnd("⏱️ Sync Genre Stats");
      console.log(`✅ Synced ${totalUpdated} Genres`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ Sync Genre Failed:", error);
      return { success: false, error };
    }
  }

  /**
   * 2. SYNC ARTIST STATS
   * Tính toán lại TotalTracks, TotalAlbums cho mỗi Artist
   */
  async syncArtistStats() {
    console.time("⏱️ Sync Artist Stats");
    let totalUpdated = 0;

    try {
      // A. Aggregation
      const [trackAgg, albumAgg] = await Promise.all([
        Track.aggregate(
          [
            {
              $match: {
                status: "ready",
                isDeleted: false,
                artist: { $ne: null },
              },
            },
            { $group: { _id: "$artist", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true }
        ),
        Album.aggregate(
          [
            { $match: { artist: { $ne: null } } },
            { $group: { _id: "$artist", count: { $sum: 1 } } },
          ],
          { allowDiskUse: true }
        ),
      ]);

      const trackMap = new Map(
        trackAgg.map((i) => [i._id?.toString(), i.count])
      );
      const albumMap = new Map(
        albumAgg.map((i) => [i._id?.toString(), i.count])
      );

      // B. Cursor Loop
      const cursor = Artist.find().select("_id").cursor();
      let opsBatch: any[] = [];

      for await (const artist of cursor) {
        const id = artist._id.toString();

        opsBatch.push({
          updateOne: {
            filter: { _id: artist._id },
            update: {
              $set: {
                totalTracks: trackMap.get(id) || 0,
                totalAlbums: albumMap.get(id) || 0,
              },
            },
          },
        });

        if (opsBatch.length >= BATCH_SIZE) {
          await Artist.bulkWrite(opsBatch, { ordered: false });
          totalUpdated += opsBatch.length;
          opsBatch = [];
        }
      }

      if (opsBatch.length > 0) {
        await Artist.bulkWrite(opsBatch, { ordered: false });
        totalUpdated += opsBatch.length;
      }

      console.timeEnd("⏱️ Sync Artist Stats");
      console.log(`✅ Synced ${totalUpdated} Artists`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ Sync Artist Failed:", error);
      return { success: false, error };
    }
  }

  /**
   * 3. SYNC ALBUM STATS
   * Tính toán TotalTracks và TotalDuration cho mỗi Album
   */
  async syncAlbumStats() {
    console.time("⏱️ Sync Album Stats");
    let totalUpdated = 0;

    try {
      // A. Aggregation
      const agg = await Track.aggregate(
        [
          {
            $match: { status: "ready", isDeleted: false, album: { $ne: null } },
          },
          {
            $group: {
              _id: "$album",
              count: { $sum: 1 },
              duration: { $sum: "$duration" }, // Cộng tổng thời lượng giây
            },
          },
        ],
        { allowDiskUse: true }
      );

      // Map lưu object { count, duration }
      const statsMap = new Map(agg.map((i) => [i._id?.toString(), i]));

      // B. Cursor Loop
      const cursor = Album.find().select("_id").cursor();
      let opsBatch: any[] = [];

      for await (const album of cursor) {
        const id = album._id.toString();
        const stats = statsMap.get(id);

        opsBatch.push({
          updateOne: {
            filter: { _id: album._id },
            update: {
              $set: {
                totalTracks: stats?.count || 0,
                totalDuration: stats?.duration || 0,
              },
            },
          },
        });

        if (opsBatch.length >= BATCH_SIZE) {
          await Album.bulkWrite(opsBatch, { ordered: false });
          totalUpdated += opsBatch.length;
          opsBatch = [];
        }
      }

      if (opsBatch.length > 0) {
        await Album.bulkWrite(opsBatch, { ordered: false });
        totalUpdated += opsBatch.length;
      }

      console.timeEnd("⏱️ Sync Album Stats");
      console.log(`✅ Synced ${totalUpdated} Albums`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error("❌ Sync Album Failed:", error);
      return { success: false, error };
    }
  }

  /**
   * 4. TRIGGER ALL
   * Chạy tuần tự để tránh spike CPU Database
   */
  async syncAll() {
    console.log("🚀 Starting Full System Sync...");

    // Chạy tuần tự (Sequential) thay vì Parallel để an toàn cho Server
    const r1 = await this.syncGenreStats();
    const r2 = await this.syncArtistStats();
    const r3 = await this.syncAlbumStats();

    return {
      genreStats: r1,
      artistStats: r2,
      albumStats: r3,
      timestamp: new Date(),
    };
  }
}

export default new SystemService();
