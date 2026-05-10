// src/index.ts
// Load + validate environment early
import "./config/env";

import http from "http";
import mongoose from "mongoose";
import app from "./app";
// 🔥 FIX 2: Import đúng 2 ống Redis và hàm connect
import { connectRedis, cacheRedis, queueRedis } from "./config/redis";
import { bootstrapCounters } from "./utils/counter";
import { initSocket } from "./socket";
import { initCronJobs } from "./cron";
import { scheduleExternalHealthJob } from "./queue/external.queue";
import { startViewWorker } from "./workers/view.worker";
import { closeInteractionWorker } from "./workers/interaction.worker";
import { closeInteractionQueue } from "./queue/interaction.queue";

const startServer = async () => {
  try {
    // 1. Kết nối DB & Redis trước (Cơ sở hạ tầng)
    await connectRedis();
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ Databases & Redis connected");

    // 2. Đồng bộ logic nghiệp vụ
    await bootstrapCounters();

    // 3. Tạo HTTP Server & Socket.IO
    const server = http.createServer(app);
    initSocket(server);
    initCronJobs();

    // 4. Khởi chạy Server TRƯỚC khi khởi chạy Workers
    // Việc này giúp Fly.io nhận diện app "Pass Health Check" nhanh nhất
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`🚀 API Server running on port ${PORT}`);
      
      // 5. Sau khi server đã lắng nghe, mới kích hoạt các Workers/Jobs
      scheduleExternalHealthJob();
      startViewWorker();
      console.log("👷 Background Workers activated");
    });

    // 6. Graceful Shutdown (Tối ưu đóng song song)
    const exitHandler = async () => {
      console.log("🛑 Starting Graceful Shutdown...");
      if (server) {
        server.close(async () => {
          try {
            // Đóng tất cả kết nối cùng lúc để kịp thời gian của Fly.io
            await Promise.all([
              closeInteractionWorker(),
              closeInteractionQueue(),
              mongoose.disconnect(),
              cacheRedis.quit(),
              queueRedis.quit()
            ]);
            console.log("🔌 All connections closed safely");
            process.exit(0);
          } catch (err) {
            console.error("❌ Error during shutdown:", err);
            process.exit(1);
          }
        });
      }
    };

    process.on("SIGTERM", exitHandler);
    process.on("SIGINT", exitHandler);

  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
