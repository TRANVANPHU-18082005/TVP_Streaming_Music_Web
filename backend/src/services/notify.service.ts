// src/services/notify.service.ts
import Notify from "../models/Notify";
import { notifyQueue } from "../queue/notify.queue";

type CreateNotificationInput = {
  recipientIds: string[]; // one or many
  senderId: string;
  type: "LIKE" | "FOLLOW" | "SYSTEM" | "NEW_RELEASE" | string;
  relatedId?: string;
  message: string;
  link?: string;
};

class NotifyService {
  async getMyNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [list, unreadCount] = await Promise.all([
      Notify.find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "name avatar"),
      Notify.countDocuments({ recipientId: userId, isRead: false }),
    ]);
    return { list, unreadCount };
  }

  /**
   * Create notifications by pushing a job to BullMQ.
   * Accepts one or many recipientIds.
   */
  async createNotification(payload: CreateNotificationInput) {
    const { recipientIds, senderId, type, relatedId, message, link } = payload;
    // Normalize to array
    const recipients = Array.isArray(recipientIds)
      ? recipientIds
      : [recipientIds];
    await notifyQueue.add("send-notification", {
      senderId,
      recipientIds: recipients,
      type,
      relatedId,
      message,
      link,
    });
  }

  async markAsRead(userId: string) {
    return await Notify.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } },
    );
  }

  async markOneRead(notificationId: string, userId: string) {
    return await Notify.updateOne(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true } },
    );
  }
}

export default new NotifyService();
