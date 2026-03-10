import cron from "node-cron";
import { cacheRedis } from "../config/redis"; // 🔥 FIX 1: Dùng đúng ống cacheRedis
import Track from "../models/Track";

let isSyncing = false;
const BATCH_SIZE = 500;

export const startViewSyncJob = () => {
  cron.schedule(
    "*/5 * * * *",
    async () => {
      // 1. Concurrency Guard
      if (isSyncing) {
        console.log("⚠️ [SyncView] Previous job running. Skip.");
        return;
      }

      isSyncing = true;
      console.log("⏳ [SyncView] Starting sync...");
      const startTime = Date.now();

      try {
        // 2. Sử dụng Async Iterator (Cách chuẩn nhất để loop Stream)
        const stream = cacheRedis.scanStream({
          // 🔥 FIX 1
          match: "track:views:*",
          count: 100,
        });

        let keysBatch: string[] = [];

        for await (const resultKeys of stream) {
          if (resultKeys.length > 0) {
            keysBatch.push(...resultKeys);
          }

          // Nếu batch đầy thì xử lý ngay
          if (keysBatch.length >= BATCH_SIZE) {
            await processBatch(keysBatch);
            keysBatch = []; // Reset
          }
        }

        // Xử lý nốt số dư còn lại (nếu có)
        if (keysBatch.length > 0) {
          await processBatch(keysBatch);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [SyncView] Done in ${duration}s`);
      } catch (error) {
        console.error("❌ [SyncView] Critical Error:", error);
      } finally {
        // Luôn mở khóa ở finally để tránh Deadlock nếu code crash giữa chừng
        isSyncing = false;
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );
};

/**
 * Hàm xử lý Batch (Nguyên bản logic của bạn rất tốt)
 */
async function processBatch(keys: string[]) {
  if (keys.length === 0) return;

  try {
    const values = await cacheRedis.mget(keys); // 🔥 FIX 1
    const mongoOps = [];
    const redisPipeline = cacheRedis.pipeline(); // 🔥 FIX 1

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const viewStr = values[i];
      const views = parseInt(viewStr || "0", 10);

      if (views > 0) {
        // track:views:ID -> lấy ID
        const trackId = key.split(":")[2];

        // 🔥 FIX 2: Bọc bảo vệ, check chuẩn MongoID trước khi đẩy vào BulkWrite
        if (trackId && /^[0-9a-fA-F]{24}$/.test(trackId)) {
          // Chuẩn bị update Mongo
          mongoOps.push({
            updateOne: {
              filter: { _id: trackId },
              // Cộng đồng bộ cả playCount và totalPlays để không bị lệch Data
              update: { $inc: { playCount: views, totalPlays: views } },
            },
          });

          // Trừ view Redis (Chống Race Condition hoàn hảo)
          redisPipeline.decrby(key, views);
        }
      }
    }

    if (mongoOps.length > 0) {
      // Chạy Mongo xong rồi mới chạy Redis để lỡ Mongo sập, view vẫn còn nguyên trên Redis
      await Track.bulkWrite(mongoOps);
      await redisPipeline.exec();
    }
  } catch (error) {
    console.error(`❌ [SyncView] Batch failed (Redis keys kept safe):`, error);
  }
}
