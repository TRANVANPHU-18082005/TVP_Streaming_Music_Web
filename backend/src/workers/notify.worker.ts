import {
  deliverNotificationJob,
  type InsertedNotification,
} from "./notify.delivery";

type NotificationWorker = {
  on: (event: "error", listener: (error: Error) => void) => void;
};

let notificationWorker: NotificationWorker | null = null;

function createNotificationWorker(): NotificationWorker {
  // Loaded here so importing startNotificationWorker does not open Redis or Socket.IO.
  const { Worker } = require("bullmq") as typeof import("bullmq");
  const { queueRedis } = require("../config/redis") as typeof import("../config/redis");
  const Notification = require("../models/Notify").default as typeof import("../models/Notify").default;
  const { getIO } = require("../socket") as typeof import("../socket");

  const worker = new Worker(
    "notification-delivery",
    async (job) => {
      const io = getIO();
      await deliverNotificationJob(job.data || {}, {
        insertMany: async (docs) => {
          const inserted = await Notification.insertMany(docs);
          return inserted as InsertedNotification[];
        },
        emit: (room, event, payload) => {
          io.to(room).emit(event, payload);
        },
      });
    },
    { connection: queueRedis, concurrency: 2 },
  );

  worker.on("error", (error: Error) => {
    console.error("[NotifyWorker] worker error:", error);
  });

  return worker;
}

export const startNotificationWorker = (
  create: () => NotificationWorker = createNotificationWorker,
) => {
  if (notificationWorker) return notificationWorker;
  notificationWorker = create();
  return notificationWorker;
};
