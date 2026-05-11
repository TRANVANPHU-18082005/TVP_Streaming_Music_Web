import Redis, { RedisOptions } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Helper: Tự động bật TLS nếu URL là rediss://
const getTlsConfig = (url: string) => {
  return url.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined;
};

// =========================================================
// 1. CACHE REDIS (Dùng cho API - Kết nối Upstash)
// =========================================================
import config from "./env";

const cacheUrl = config.upstashRedisUrl || process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";

export const cacheRedis = new Redis(cacheUrl, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  tls: getTlsConfig(cacheUrl),
  maxRetriesPerRequest: 3, // sau 3 lần fail → throw, không retry mãi
  connectTimeout: 5000, // 5s không connect được → throw
});

cacheRedis.on("connect", () =>
  console.log("✅ [Cache] Upstash Redis connected"),
);
cacheRedis.on("error", (err) =>
  console.error("❌ [Cache] Error:", err.message),
);

// =========================================================
// 2. QUEUE REDIS (Dùng cho BullMQ - Kết nối Redis Cloud)
// =========================================================
const queueUrl = config.queueRedisUrl || process.env.QUEUE_REDIS_URL || "redis://localhost:6380";

export const queueRedis = new Redis(queueUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: null, // 🔥 BẮT BUỘC: BullMQ yêu cầu phải là null
  keepAlive: 10000,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  tls: getTlsConfig(queueUrl),
});

queueRedis.on("connect", () => console.log("🟢 [Queue] Redis Cloud connected"));
queueRedis.on("error", (err) =>
  console.error("🔴 [Queue] Error:", err.message),
);

// =========================================================
// 3. Hàm khởi động chung (Gọi ở server.ts)
// =========================================================
export const connectRedis = async () => {
  try {
    const promises = [];

    // 🔥 FIX LỖI CRASH: Chỉ gọi connect() nếu trạng thái đang "ngủ" (wait)
    if (cacheRedis.status === "wait") {
      promises.push(cacheRedis.connect());
    }

    if (queueRedis.status === "wait") {
      promises.push(queueRedis.connect());
    }

    await Promise.all(promises);
  } catch (error) {
    console.error("Redis Connection Failed");
    throw error;
  }
};
