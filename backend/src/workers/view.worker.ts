import { Worker, Job } from "bullmq";
import { cacheRedis, queueRedis } from "../config/redis";
import PlayLog from "../models/PlayLog";
import DailyStats from "../models/DailyStats";
import mongoose from "mongoose";
import recommendationService from "../services/recommendation.service";
import logger from "../utils/logger";

// Định nghĩa Interface cho Job Data để chặt chẽ về Type
interface ILogListenJob {
  trackId: string;
  userId: string;
  ip?: string;
  timestamp: string | Date;
}

export const startViewWorker = () => {
  const worker = new Worker(
    "view-updates",
    async (job: Job<ILogListenJob>) => {
      if (job.name === "log-listen-history") {
        const { trackId, userId, ip, timestamp } = job.data;
        console.log(trackId, userId, ip, timestamp);
        // 1. XỬ LÝ MÚI GIỜ VIỆT NAM (UTC+7)
        // Dùng toLocaleDateString với timezone cố định để lấy chính xác YYYY-MM-DD tại VN
        const listenDate = new Date(timestamp);
        const vnDateStr = listenDate.toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }); // Kết quả luôn là "YYYY-MM-DD" theo giờ VN

        try {
          // 2. TẠO CÁC PROMISE XỬ LÝ SONG SONG
          logger.info(
            `[SyncView] Scheduled view sync job: trackId=${trackId}, userId=${userId}, ip=${ip}, timestamp=${timestamp}`,
          );

          // Task A: Ghi Log thô (Audit Trail)
          const logPromise = PlayLog.create({
            trackId: new mongoose.Types.ObjectId(trackId),
            userId: userId ? new mongoose.Types.ObjectId(userId) : null,
            ip: ip || "unknown",
            listenedAt: listenDate,
            source: "web",
          });
          recommendationService.invalidateUserRecommendCache(userId);

          // Task B: Cập nhật Global Chart (Redis)
          const vnHour = new Date(
            listenDate.toLocaleString("en-US", {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
          ).getHours();
          const hourKey = `chart:hourly:${vnHour}`;

          const redisPromises = [
            cacheRedis.zincrby(hourKey, 1, trackId),
            cacheRedis.expire(hourKey, 172800), // 48h
          ];

          // Task C: Cập nhật Daily Stats (Cho User Chart)
          let statsPromise = Promise.resolve() as Promise<any>;

          if (userId) {
            const userOid = new mongoose.Types.ObjectId(userId);

            // Atomic Upsert: Chống race condition tuyệt đối
            statsPromise = DailyStats.updateOne(
              { userId: userOid, date: vnDateStr },
              { $inc: { count: 1 } },
              { upsert: true },
            ).then(() => {
              // Xóa cache dashboard để user thấy data mới
              return cacheRedis.del(`profile:dashboard:${userId}`);
            });
          }

          // 3. THỰC THI ĐỒNG THỜI
          await Promise.all([logPromise, ...redisPromises, statsPromise]);

          console.log(
            `✅ [Worker] Processed: ${trackId} | User: ${userId || "Guest"} | Date: ${vnDateStr}`,
          );
        } catch (error) {
          console.error("❌ [Worker] Critical Error:", error);
          throw error; // Đẩy lại để BullMQ retry
        }
      }
    },
    {
      connection: queueRedis,
      concurrency: 5, // Xử lý 5 jobs cùng lúc
      removeOnComplete: { count: 100 }, // Giữ lại 100 history gần nhất để check
      removeOnFail: { count: 500 },
    },
  );

  worker.on("completed", (job) => {
    console.log(`🏁 Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`⚠️ Job ${job?.id} failed: ${err.message}`);
  });
};
