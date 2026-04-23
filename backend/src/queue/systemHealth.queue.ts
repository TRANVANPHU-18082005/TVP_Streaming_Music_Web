import { Queue, Worker } from "bullmq";
import { queueRedis } from "../config/redis";
import { fetchAndCacheExternalHealth } from "./external.queue";

const QUEUE_NAME = "system-health";

// 1. Khởi tạo Queue
export const systemHealthQueue = new Queue(QUEUE_NAME, {
  connection: queueRedis,
});

// 2. Khởi tạo Worker để thực thi việc gọi API bên thứ 3
export const systemHealthWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === "fetch-external") {
      console.log("🚀 [Worker] Executing scheduled health check...");
      await fetchAndCacheExternalHealth();
    }
  },
  { connection: queueRedis },
);

// Log để theo dõi sức khỏe của chính cái Job này
systemHealthWorker.on("completed", (job) => {
  console.log(`✅ [Worker] Health check job ${job.id} done.`);
});

systemHealthWorker.on("failed", (job, err) => {
  console.error(`❌ [Worker] Health check job ${job?.id} failed:`, err);
});
