// cron/cleanupRooms.ts

import cron from "node-cron";
import musicRoomService from "../services/musicRoom.service";

/**
 * Cron job dọn phòng Music Room không hoạt động.
 *
 * Lịch: mỗi 15 phút.
 * Hành động:
 *   - Đóng các phòng có lastActivityAt > 2 tiếng trước.
 *   - Dọn Redis keys liên quan.
 *   - Notify socket room đang nghe.
 */
export const startRoomCleanupJob = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await musicRoomService.cleanupInactiveRooms();
      if (result.cleaned > 0) {
        console.log(`🧹 [RoomCleanup] Đã đóng ${result.cleaned} phòng không hoạt động`);
      }
    } catch (err) {
      console.error("[RoomCleanup] Lỗi khi dọn phòng:", err);
    }
  });

  console.log("✅ [RoomCleanup] Cron job khởi động (chạy mỗi 15 phút)");
};
