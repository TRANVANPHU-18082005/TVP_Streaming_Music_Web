// src/services/notify.service.ts
import Notify from "../models/Notify";

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

  async markAsRead(userId: string) {
    return await Notify.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } },
    );
  }
}

export default new NotifyService();
