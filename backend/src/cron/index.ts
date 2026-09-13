import { startSystemSyncJob } from "./maintenance";
import { startViewSyncJob } from "./sync-views";
import { startRoomCleanupJob } from "./cleanupRooms";

export const initCronJobs = () => {
  console.log("⏰ Initializing Cron Jobs...");

  // Kích hoạt từng job
  startViewSyncJob();
  startSystemSyncJob();
  startRoomCleanupJob();
  console.log("✅ All Cron Jobs started.");
};
