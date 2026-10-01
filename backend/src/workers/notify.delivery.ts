export type NotificationJobData = {
  recipientIds?: string[];
  followerIds?: string[];
  senderId?: string;
  artistId?: string;
  type?: string;
  relatedId?: string;
  trackId?: string;
  trackTitle?: string;
  artistName?: string;
  message?: string;
  link?: string;
};

export type NotificationInsert = {
  recipientId: string;
  senderId?: string;
  relatedId?: string;
  type: string;
  message: string;
  link?: string;
};

export type InsertedNotification = {
  _id: unknown;
  recipientId: { toString(): string };
  type: string;
  message: string;
  link?: string;
  isRead?: boolean;
  createdAt?: Date;
};

export type NotificationDeliveryDeps = {
  insertMany: (docs: NotificationInsert[]) => Promise<InsertedNotification[]>;
  emit: (room: string, event: string, payload: unknown) => void;
};

const BATCH_SIZE = 500;

/**
 * One notification-delivery job: insert a batch, then emit to each recipient room.
 * The room id matches privateNotificationRoom (the user id).
 */
export async function deliverNotificationJob(
  data: NotificationJobData,
  deps: NotificationDeliveryDeps,
): Promise<void> {
  const recipients: string[] = data.recipientIds || data.followerIds || [];
  if (!recipients || recipients.length === 0) return;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const notifications: NotificationInsert[] = batch.map((uid) => {
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

    const inserted = await deps.insertMany(notifications);

    inserted.forEach((doc) => {
      try {
        deps.emit(doc.recipientId.toString(), "notification_received", {
          id: doc._id,
          type: doc.type,
          message: doc.message,
          link: doc.link,
          isRead: doc.isRead,
          createdAt: doc.createdAt,
        });
      } catch (err) {
        console.error("[NotifyWorker] emit error:", err);
      }
    });
  }
}
