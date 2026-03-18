// src/queues/notification.queue.ts
import { Queue } from "bullmq";
import { queueRedis } from "../config/redis";

export const notifyQueue = new Queue("notification-delivery", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3, // Thử lại 3 lần nếu lỗi
    backoff: { type: "exponential", delay: 5000 }, // Delay tăng dần nếu lỗi
    removeOnComplete: true,
  },
});
