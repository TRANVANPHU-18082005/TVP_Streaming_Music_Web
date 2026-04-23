/**
 * external.job.ts
 *
 * Background Job Pattern: Gọi Cloudinary, Upstash, B2 API theo cron (mỗi 30 phút).
 * Dashboard chỉ ĐỌC từ Redis cache - không bao giờ gọi API thứ 3 trong request của user.
 *
 * Lợi ích:
 *   1. Tránh hoàn toàn Rate Limit của External API.
 *   2. Không có Cache Stampede (nhiều request cùng gọi API khi cache expire).
 *   3. Dashboard response time không bị phụ thuộc vào độ trễ của Cloudinary/Upstash.
 *
 * Tích hợp: Khởi tạo trong app.ts hoặc dùng node-cron / BullMQ Repeatable Job.
 */

import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { cacheRedis } from "../config/redis";
import { getB2Health } from "../config/b2";
import { systemHealthQueue } from "./systemHealth.queue";

const CACHE_KEY = "dashboard:system_health_external";
const CACHE_TTL = 3600; // 1 tiếng (safety net nếu cron chết)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// CORE FETCHER
// Gọi song song tất cả external API, merge kết quả, lưu vào Redis.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAndCacheExternalHealth(): Promise<void> {
  console.log(
    "[ExternalJob] Fetching external health (Cloudinary, Upstash, B2)...",
  );
  const startedAt = Date.now();

  const [cloudinaryData, upstashData, b2Data] = await Promise.allSettled([
    // A. Cloudinary Usage
    (async () => {
      const res = await cloudinary.api.usage();
      return {
        plan: res.plan,
        bandwidth: { usage: res.bandwidth.usage, limit: res.bandwidth.limit },
        storage: { usage: res.storage.usage, limit: res.storage.limit },
      };
    })(),

    // B. Upstash Redis Quota
    (async () => {
      if (!process.env.UPSTASH_DB_ID || !process.env.UPSTASH_API_KEY)
        return null;
      const res = await axios.get(
        `https://api.upstash.com/v2/redis/databases/${process.env.UPSTASH_DB_ID}`,
        { headers: { Authorization: `Bearer ${process.env.UPSTASH_API_KEY}` } },
      );
      return {
        dailyRequests: res.data.daily_request_count,
        monthlyRequests: res.data.monthly_request_count,
        dataSize: res.data.data_size,
      };
    })(),

    // C. Backblaze B2
    getB2Health(),
  ]);

  const settle = <T>(r: PromiseSettledResult<T>): T | null => {
    if (r.status === "fulfilled") return r.value;
    console.error(
      "[ExternalJob] API call failed:",
      r.reason?.message ?? r.reason,
    );
    return null;
  };

  const result = {
    cloudinary: settle(cloudinaryData),
    upstash: settle(upstashData),
    b2: settle(b2Data),
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };

  await cacheRedis
    .setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result))
    .catch((err) =>
      console.error("[ExternalJob] Failed to save to Redis:", err),
    );

  console.log(
    `[ExternalJob] ✅ Done in ${result.durationMs}ms. Cached for ${CACHE_TTL}s.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE: Dùng node-cron
//
// Cách dùng trong app.ts:
//   import { scheduleExternalHealthJob } from "./jobs/external.job";
//   scheduleExternalHealthJob();
// ─────────────────────────────────────────────────────────────────────────────

export async function scheduleExternalHealthJob() {
  // A. Làm sạch các job lặp lại cũ (để tránh bị trùng lặp khi restart server)
  const repeatableJobs = await systemHealthQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await systemHealthQueue.removeRepeatableByKey(job.key);
  }

  // B. Thêm Job lặp lại mới: Mỗi 30 phút
  await systemHealthQueue.add(
    "fetch-external",
    {},
    {
      repeat: { pattern: "*/30 * * * *" },
      jobId: "system-health-checker", // Cố định ID
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: true,
      removeOnFail: { count: 10 },
    },
  );

  console.log("📅 [BullMQ] System Health Job has been scheduled (Every 30m)");
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION C: BullMQ Repeatable Job (recommended cho production)
//
// Dùng khi đã có BullMQ infrastructure (audioQueue).
// Tạo một queue riêng: "system-health" với repeat: { every: 30 * 60 * 1000 }
//
// healthQueue.add("fetch-external", {}, { repeat: { every: 30 * 60 * 1000 } });
// Worker gọi fetchAndCacheExternalHealth() khi nhận job.
//
// Ưu điểm so với cron:
//   - Persistent: server restart không mất schedule
//   - Observable: xem job trong Bull Board
//   - Retry: tự động retry nếu fetch fail
// ─────────────────────────────────────────────────────────────────────────────
