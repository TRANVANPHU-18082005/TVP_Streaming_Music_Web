/**
 * counter.helper.ts
 *
 * Counter Pattern: Thay thế countDocuments() bằng Redis atomic increment.
 * Gọi các hàm này tại điểm xảy ra event (service/controller), không phải tại dashboard.
 *
 * Đảm bảo tính nhất quán: khởi tạo counter từ DB một lần khi server start.
 *
 * O(1) thay vì O(n) Collection Scan cho mọi dashboard load.
 */

import { cacheRedis } from "../config/redis";
import User from "../models/User";
import Track from "../models/Track";
import Album from "../models/Album";

const KEYS = {
  totalUsers: "stats:total_users",
  totalTracks: "stats:total_tracks",
  totalAlbums: "stats:total_albums",
  totalPlays: "stats:total_plays",
  audioBytes: "stats:storage:audio_bytes",
  imageBytes: "stats:storage:image_bytes",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP: Đồng bộ counters từ DB lúc server khởi động
// Gọi trong app.ts / server.ts sau khi kết nối MongoDB thành công.
// ─────────────────────────────────────────────────────────────────────────────
export async function bootstrapCounters(): Promise<void> {
  console.log("🔢 Bootstrapping Redis counters from DB...");

  const [users, tracks, albums, playsAgg, storageAgg] = await Promise.all([
    User.countDocuments(),
    Track.countDocuments({ isDeleted: false }),
    Album.countDocuments(),
    Track.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: { _id: null, total: { $sum: { $ifNull: ["$playCount", 0] } } },
      },
    ]),
    Track.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          // Phân loại theo mimeType: audio/* vs image/*
          audioBytes: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$mimeType", ""] },
                    regex: /^audio\//,
                  },
                },
                { $ifNull: ["$fileSize", 0] },
                0,
              ],
            },
          },
          imageBytes: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$mimeType", ""] },
                    regex: /^image\//,
                  },
                },
                { $ifNull: ["$fileSize", 0] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const totalPlays = playsAgg?.[0]?.total ?? 0;
  const audioBytes = storageAgg?.[0]?.audioBytes ?? 0;
  const imageBytes = storageAgg?.[0]?.imageBytes ?? 0;

  // Dùng pipeline để set tất cả trong một round-trip
  const pipeline = cacheRedis.pipeline();
  pipeline.set(KEYS.totalUsers, users);
  pipeline.set(KEYS.totalTracks, tracks);
  pipeline.set(KEYS.totalAlbums, albums);
  pipeline.set(KEYS.totalPlays, totalPlays);
  pipeline.set(KEYS.audioBytes, audioBytes);
  pipeline.set(KEYS.imageBytes, imageBytes);
  await pipeline.exec();

  console.log(
    `✅ Counters bootstrapped: ${users} users, ${tracks} tracks, ${albums} albums, ${totalPlays} plays`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER COUNTERS
// Gọi trong UserService sau khi tạo/xóa user thành công.
// ─────────────────────────────────────────────────────────────────────────────
export const CounterUser = {
  increment: () => cacheRedis.incr(KEYS.totalUsers).catch(logErr("user.incr")),
  decrement: () => cacheRedis.decr(KEYS.totalUsers).catch(logErr("user.decr")),
};

// ─────────────────────────────────────────────────────────────────────────────
// TRACK COUNTERS
// Gọi trong TrackService sau khi tạo/xóa track thành công.
// ─────────────────────────────────────────────────────────────────────────────
export const CounterTrack = {
  /** Gọi sau khi track mới được lưu vào DB */
  increment: (fileSize: number, mimeType: string) => {
    const pipeline = cacheRedis.pipeline();
    pipeline.incr(KEYS.totalTracks);
    if (mimeType.startsWith("audio/")) {
      pipeline.incrby(KEYS.audioBytes, fileSize);
    } else if (mimeType.startsWith("image/")) {
      pipeline.incrby(KEYS.imageBytes, fileSize);
    }
    return pipeline.exec().catch(logErr("track.incr"));
  },

  /** Gọi khi track bị soft-delete hoặc hard-delete */
  decrement: (fileSize: number, mimeType: string) => {
    const pipeline = cacheRedis.pipeline();
    pipeline.decr(KEYS.totalTracks);
    if (mimeType.startsWith("audio/")) {
      pipeline.decrby(KEYS.audioBytes, fileSize);
    } else if (mimeType.startsWith("image/")) {
      pipeline.decrby(KEYS.imageBytes, fileSize);
    }
    return pipeline.exec().catch(logErr("track.decr"));
  },

  /** Gọi sau mỗi lần play thành công (có thể batch nếu traffic lớn) */
  play: () => cacheRedis.incr(KEYS.totalPlays).catch(logErr("track.play")),
};

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM COUNTERS
// ─────────────────────────────────────────────────────────────────────────────
export const CounterAlbum = {
  increment: () =>
    cacheRedis.incr(KEYS.totalAlbums).catch(logErr("album.incr")),
  decrement: () =>
    cacheRedis.decr(KEYS.totalAlbums).catch(logErr("album.decr")),
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────────────────────
function logErr(context: string) {
  return (err: unknown) => {
    // Counter failure không được làm crash business logic chính
    console.error(`[Counter][${context}] Redis error (non-critical):`, err);
  };
}
