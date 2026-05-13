import config from "./config/env";
import http from "http";
import { createApp } from "./app";
import { connectRedis } from "./config/redis";
import { connectWithRetry } from "./utils/db.utils";
import crypto from "node:crypto";
import { fetchLyrics } from "./services/lyrics/lrclib.service";
if (typeof global.crypto === "undefined") {
  // @ts-ignore
  global.crypto = crypto;
}
const startServer = () => {
  const PORT = config.port || 8000;
  const app = createApp();
  const server = http.createServer(app);

  // ✅ MỞ CỔNG NGAY LẬP TỨC
  server.listen(Number(PORT), "0.0.0.0", async () => {
    console.log(`🚀 API Server is ONLINE at port ${PORT}`);

    // Sau khi online, chạy các kết nối ngầm
    try {
      console.log("📡 Connecting to DB & Redis in background...");
      await connectRedis();
      await connectWithRetry();
      console.log("✅ All infrastructures connected!");

      // Mount heavy routes only after infra ready
      try {
        const routesModule = await import("./routes");
        const routes = routesModule.default || routesModule;
        app.use("/api", routes);
        console.log("🔌 API routes mounted");
      } catch (err) {
        console.error("⚠️ Failed to mount routes:", err);
      }

      // Initialize modules that require infra
      const { bootstrapCounters } = await import("./utils/counter");
      const { initSocket } = await import("./socket");
      const { initCronJobs } = await import("./cron");
      const analytics = await import("./services/analytics.service");

      if (analytics && typeof analytics.default?.init === "function") {
        try {
          await analytics.default.init();
          console.log("⚙️ Analytics initialized");
        } catch (err) {
          console.error("⚠️ Analytics init failed:", err);
        }
      }
      // Sơn Tùng MTP — track: Buông Đôi Tay Nhau Ra - durion: 227.
      // const test = await fetchLyrics(
      //   "Thời Gian Sẽ Trả Lời",
      //   "Justatee, Tien Cookie, BigDaddy",
      //   undefined,
      //   "test-job-123",
      // );
      // console.log(test);
      initSocket(server);
      initCronJobs();
      await bootstrapCounters();
      // Start background workers that depend on Redis / DB
      try {
        const interactionModule = await import("./workers/interaction.worker");
        if (interactionModule && interactionModule.interactionWorker) {
          console.log("🔧 Interaction worker loaded");
        }
      } catch (err) {
        console.error("⚠️ Failed to load interaction worker:", err);
      }

      try {
        const viewModule = await import("./workers/view.worker");
        if (viewModule && typeof viewModule.startViewWorker === "function") {
          viewModule.startViewWorker();
          console.log("🔧 View worker started");
        }
      } catch (err) {
        console.error("⚠️ Failed to start view worker:", err);
      }

      console.log("👷 System fully ready!");
    } catch (err) {
      console.error("❌ Background startup error:", err);
    }
  });
};

startServer();
