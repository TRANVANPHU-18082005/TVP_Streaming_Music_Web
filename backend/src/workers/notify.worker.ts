// src/workers/notification.worker.ts
import { Worker } from "bullmq";
import { queueRedis } from "../config/redis";
import Notification from "../models/Notify";
import { getIO } from "../socket"; // Hàm lấy instance Socket.io đã init

export const startNotificationWorker = () => {
  new Worker(
    "notification-delivery",
    async (job) => {
      const io = getIO();

      // Support two job shapes:
      // 1) { recipientIds, senderId, type, relatedId, message, link }
      // 2) legacy track job: { artistId, trackId, trackTitle, artistName, followerIds }
      const data: any = job.data || {};
      const recipients: string[] = data.recipientIds || data.followerIds || [];

      if (!recipients || recipients.length === 0) return;

      const BATCH_SIZE = 500;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);

        const notifications = batch.map((uid: string) => {
          // Determine message and type
          const isLegacyTrack = Boolean(data.trackId || data.trackTitle);
          const type = data.type || (isLegacyTrack ? "NEW_RELEASE" : "SYSTEM");
          const message =
            data.message ||
            (isLegacyTrack
              ? `${data.artistName} vừa phát hành bài hát mới: ${data.trackTitle}`
              : "Bạn có thông báo mới");
          const link =
            data.link || (isLegacyTrack ? `/track/${data.trackId}` : undefined);

          return {
            recipientId: uid,
            senderId: data.senderId || data.artistId,
            relatedId: data.relatedId || data.trackId,
            type,
            message,
            link,
          };
        });

        // Bulk insert and get inserted docs to emit with ids
        const inserted = await Notification.insertMany(notifications);

        // Emit real-time events
        inserted.forEach((doc: any) => {
          try {
            io.to(doc.recipientId.toString()).emit("notification_received", {
              id: doc._id,
              type: doc.type,
              message: doc.message,
              link: doc.link,
              isRead: doc.isRead,
              createdAt: doc.createdAt,
            });
          } catch (err) {
            // ignore per-user emit errors
            console.error("[NotifyWorker] emit error:", err);
          }
        });
      }
    },
    { connection: queueRedis, concurrency: 2 },
  );
};
