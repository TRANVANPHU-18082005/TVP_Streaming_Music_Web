// src/queue/viewQueue.ts
import { Queue } from "bullmq";
import { queueRedis } from "../config/redis"; // 🔥 Dùng queueRedis thay vì cacheRedis

export const viewQueue = new Queue("view-updates", {
  connection: queueRedis, // 🔥 Bắt buộc dùng chung ống với Worker
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
  },
});
