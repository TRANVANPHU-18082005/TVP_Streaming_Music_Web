// src/index.ts
import dotenv from "dotenv";
// 1. Load env đầu tiên
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import app from "./app";
// 🔥 FIX 2: Import đúng 2 ống Redis và hàm connect
import { connectRedis, cacheRedis, queueRedis } from "./config/redis";
import { initSocket } from "./socket";
import { initCronJobs } from "./cron";
import { startViewWorker } from "./workers/view.worker";
import "./workers/interaction.worker";
import { closeInteractionQueue } from "./queue/interaction.queue";
import { closeInteractionWorker } from "./workers/interaction.worker";
import { bootstrapCounters } from "./utils/counter";
import { scheduleExternalHealthJob } from "./queue/external.queue";
import { fetchLyrics } from "./services/lyrics/lrclib.service";
const startServer = async () => {
  try {
    // 2. Kết nối Dual Redis (Quan trọng để chạy trước)
    await connectRedis();
    console.log("✅ Dual Redis connected successfully (Upstash + Redis Cloud)");

    // 3. Kết nối MongoDB
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ MongoDB connected successfully");
    // 2. Đồng bộ bộ đếm từ DB sang Redis
    await bootstrapCounters();

    // 3. Kích hoạt Job chạy ngầm (Cloudinary, B2, Upstash)
    await scheduleExternalHealthJob();
    startViewWorker();
    console.log("✅ View Worker started & listening to Queue");
    console.log("✅ Interaction Worker is listening to Queue...");
    // 4. Tạo HTTP Server bọc lấy Express App
    // (Bắt buộc phải làm thế này mới chạy được Socket.IO)
    const server = http.createServer(app);

    // 5. Khởi tạo Socket.IO
    initSocket(server);
    console.log("✅ Socket.IO initialized");

    initCronJobs();
    console.log("✅ Cron Jobs initialized");
    // Sơn Tùng MTP — track: Buông Đôi Tay Nhau Ra - durion: 227.
    // const test = await fetchLyrics("Lạc Trôi", "Sơn Tùng M-TP", 234, "001");
    // console.log(test);
    // 6. Chạy Server
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`🚀 API Server running on port ${PORT}`);
    });

    // (Optional) Xử lý tắt server mượt mà (Graceful Shutdown)
    const exitHandler = () => {
      if (server) {
        server.close(async () => {
          console.log("🛑 API Server closed");
          await closeInteractionWorker();
          await closeInteractionQueue();
          // Đóng kết nối Database an toàn
          await mongoose.disconnect();

          // 🔥 FIX 2: Đóng cả 2 kết nối Redis
          await cacheRedis.quit();
          await queueRedis.quit();

          console.log("🔌 All Database connections closed safely");

          process.exit(0); // Dùng 0 thay vì 1 để báo hiệu tắt an toàn
        });
      } else {
        process.exit(1);
      }
    };

    process.on("uncaughtException", (err) => {
      console.error("🔥 Uncaught Exception:", err);
      exitHandler();
    });
    process.on("unhandledRejection", (err) => {
      console.error("🔥 Unhandled Rejection:", err);
      exitHandler();
    });
    process.on("SIGTERM", exitHandler); // Bắt tín hiệu tắt từ hệ điều hành
    process.on("SIGINT", exitHandler); // Bắt sự kiện ấn Ctrl+C
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
