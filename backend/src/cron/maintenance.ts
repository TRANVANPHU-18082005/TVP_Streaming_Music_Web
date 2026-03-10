import cron from "node-cron";
import systemService from "../services/system.service";

// Biến cờ chống chạy chồng chéo trong cùng 1 process
let isRunning = false;

export const startSystemSyncJob = () => {
  // Cấu hình: 03:00 Sáng (Giờ VN)
  cron.schedule(
    "0 3 * * *",
    async () => {
      // 1. Check cờ hiệu
      if (isRunning) {
        console.log("⚠️ [CRON] System Sync is already running. Skipping...");
        return;
      }

      isRunning = true; // 🔒 Khóa lại
      console.log("🛠️ [CRON] Starting Daily System Sync...");

      try {
        // Gọi service đã tối ưu Batching ở bài trước
        const result = await systemService.syncAll();
        console.log("✅ [CRON] System Sync Completed.", result);
      } catch (error) {
        console.error("❌ [CRON] System Sync Failed:", error);
      } finally {
        isRunning = false; // 🔓 Mở khóa dù thành công hay thất bại
      }
    },
    {
      // 2. Cấu hình Timezone (Bắt buộc)
      timezone: "Asia/Ho_Chi_Minh",
    }
  );
};
