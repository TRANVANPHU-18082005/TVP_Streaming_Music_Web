import { startSystemSyncJob } from "./maintenance";
import { startViewSyncJob } from "./sync-views";

export const initCronJobs = () => {
  console.log("⏰ Initializing Cron Jobs...");

  // Kích hoạt từng job
  startViewSyncJob();
  startSystemSyncJob();
  console.log("✅ All Cron Jobs started.");
};
