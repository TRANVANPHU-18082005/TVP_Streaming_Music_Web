// src/workers/notification.worker.ts
import { Worker } from "bullmq";
import { queueRedis } from "../config/redis";
import Notification from "../models/Notify";
import { getIO } from "../socket"; // Hàm lấy instance Socket.io đã init

export const startNotificationWorker = () => {
  new Worker(
    "notification-delivery",
    async (job) => {
      const { artistId, trackId, trackTitle, artistName, followerIds } =
        job.data;

      // Chia nhỏ followerIds thành từng cụm (batch) 500 người để tránh quá tải DB
      const BATCH_SIZE = 500;
      const io = getIO();

      for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
        const batch = followerIds.slice(i, i + BATCH_SIZE);

        // 1. Bulk Insert vào MongoDB (Nhanh nhất)
        const notifications = batch.map((uid: string) => ({
          recipientId: uid,
          senderId: artistId,
          relatedId: trackId,
          type: "NEW_TRACK",
          message: `${artistName} vừa phát hành bài hát mới: ${trackTitle}`,
          link: `/track/${trackId}`,
        }));

        await Notification.insertMany(notifications);

        // 2. Bắn Real-time qua Socket.io
        batch.forEach((uid: string) => {
          io.to(uid).emit("notification_received", {
            type: "NEW_TRACK",
            message: `${artistName} vừa ra bài mới!`,
            trackId,
          });
        });
      }
    },
    { connection: queueRedis, concurrency: 2 },
  );
};
