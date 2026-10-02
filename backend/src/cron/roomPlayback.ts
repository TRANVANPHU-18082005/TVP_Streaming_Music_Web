import musicRoomService from "../services/musicRoom.service";

/**
 * Advance rooms whose current track has reached endsAt.
 * Runs in the API process so a backgrounded host tab is not required.
 */
export const startRoomPlaybackJob = () => {
  const timer = setInterval(async () => {
    try {
      await musicRoomService.advanceDueRooms();
    } catch (err) {
      console.error("[RoomPlayback] Lỗi khi chuyển bài:", err);
    }
  }, 5_000);
  timer.unref();
  console.log("✅ [RoomPlayback] Interval khởi động (mỗi 5 giây)");
};
