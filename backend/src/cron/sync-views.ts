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
    const values = await cacheRedis.mget(keys);
    const mongoOps = [];
    const redisPipeline = cacheRedis.pipeline();

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const viewStr = values[i];
      const views = parseInt(viewStr || "0", 10);

      if (views > 0) {
        const trackId = key.split(":")[2];

        if (trackId && /^[0-9a-fA-F]{24}$/.test(trackId)) {
          mongoOps.push({
            updateOne: {
              filter: { _id: trackId },
              // Sử dụng $inc là chuẩn nhất để tránh Race Condition ở tầng DB
              update: { $inc: { playCount: views, totalPlays: views } },
            },
          });

          // 🔥 CẢI TIẾN: Thay vì trừ, ta dùng DECRBY chính xác số lượng đã đọc
          // Điều này an toàn hơn DEL vì tránh xóa nhầm các view mới phát sinh trong lúc đang sync
          redisPipeline.decrby(key, views);
        }
      }
    }

    // Trong hàm processBatch
    if (mongoOps.length > 0) {
      try {
        // 1. Ghi vào MongoDB
        await Track.bulkWrite(mongoOps, { ordered: false });

        // 2. Chỉ thực thi pipeline Redis khi Mongo THÀNH CÔNG
        await redisPipeline.exec();
      } catch (dbError) {
        // Nếu Mongo lỗi, KHÔNG chạy redisPipeline.exec()
        // để view vẫn còn ở Redis cho lần sync sau
        console.error(
          "❌ [SyncView] DB Write failed, views preserved in Redis:",
          dbError,
        );
      }
    }
  } catch (error) {
    // Nếu lỗi xảy ra, view vẫn nằm nguyên trong Redis (vì chưa exec pipeline)
    console.error(`❌ [SyncView] Batch failed:`, error);
  }
}
