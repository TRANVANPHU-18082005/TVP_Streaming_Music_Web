import { Worker } from "bullmq";
import { cacheRedis, queueRedis } from "../config/redis";
import PlayLog from "../models/PlayLog";

export const startViewWorker = () => {
  const worker = new Worker(
    "view-updates", // Tên Queue
    async (job) => {
      // 1. Chỉ xử lý job đúng tên để tránh nhầm lẫn dữ liệu
      if (job.name === "log-listen-history") {
        const { trackId, userId, ip, timestamp } = job.data;

        try {
          console.log(`🎬 [Worker] Recording PlayLog for track: ${trackId}`);

          // 2. GHI LOG VĨNH VIỄN: Nhiệm vụ quan trọng nhất của Worker
          // Lưu vào MongoDB để phục vụ Lịch sử nghe nhạc & Data Analytics lâu dài
          await PlayLog.create({
            trackId,
            userId: userId || null,
            ip: ip || "unknown",
            listenedAt: timestamp || new Date(),
            source: "web",
          });

          // 3. CẬP NHẬT CHART HOURLY (REAL-TIME CHART)
          // Đây là dữ liệu dùng cho biểu đồ đường (Line Chart) biến động theo giờ
          const vnHour = new Date().getHours();
          const hourKey = `chart:hourly:${vnHour}`;
          await cacheRedis.zincrby(hourKey, 1, trackId);
          // Set expire 48h để tự dọn dẹp Redis
          await cacheRedis.expire(hourKey, 172800);

          console.log(
            `✅ [Worker] Success: PlayLog & Chart updated for ${trackId}`,
          );
        } catch (error) {
          console.error("❌ [Worker] Critical Error during processing:", error);
          // Quăng lỗi để BullMQ biết và thực hiện cơ chế 'attempts' (thử lại)
          throw error;
        }
      }
    },
    {
      connection: queueRedis,
      // Tối ưu: Chỉ xử lý 5 job cùng lúc để không làm nghẽn CPU
      concurrency: 5,
    },
  );

  // Lắng nghe các sự kiện của Worker để dễ Debug
  worker.on("completed", (job) => {
    console.log(`🏁 Job ${job.id} has completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`⚠️ Job ${job?.id} failed with error: ${err.message}`);
  });
};
