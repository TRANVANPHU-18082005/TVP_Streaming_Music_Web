import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player/slice/playerSlice";
import { useSocket } from "@/hooks/useSocket";
import { useAppSelector } from "@/store/hooks";
import { getAnonymousId } from "@/utils/analytics-identity";

export const useTrackAnalytics = () => {
  const { socket, isConnected } = useSocket();
  const { currentTrackId, isPlaying } = useSelector(selectPlayer);
  const { user } = useAppSelector((state) => state.auth);

  // Ref giúp setInterval luôn đọc được giá trị mới nhất mà không bị "stale closure"
  const infoRef = useRef({
    userId: user?.id || user?._id || null,
    trackId: currentTrackId,
    isPlaying: isPlaying,
  });

  // Cập nhật ref mỗi khi state thay đổi
  useEffect(() => {
    infoRef.current = {
      userId: user?.id || user?._id || null,
      trackId: currentTrackId,
      isPlaying: isPlaying,
    };
  }, [user, currentTrackId, isPlaying]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Lấy ID ẩn danh cố định từ sessionStorage (đã giải thích ở lượt trước)
    const anonId = getAnonymousId();

    const emitHeartbeat = () => {
      // Chỉ tab đang mở mới gửi để tránh nhân đôi số liệu khi mở nhiều tab
      if (document.visibilityState !== "visible") return;

      const { userId, trackId, isPlaying } = infoRef.current;
      const finalUserId = userId || anonId;

      socket.emit("client_heartbeat", {
        userId: finalUserId,
        trackId: isPlaying ? (trackId ?? "") : "",
      });
    };

    // 1. Gửi ngay lập tức khi mount hoặc trạng thái Play/Pause thay đổi
    emitHeartbeat();

    // 2. Thiết lập chu kỳ gửi định kỳ (20s)
    const interval = setInterval(emitHeartbeat, 20000);

    // 3. Xử lý khi quay lại tab (User quay lại là phải báo Online ngay)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        emitHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // Dependency: Thêm isPlaying và currentTrackId vào đây để reset interval
    // và gửi tin nhắn mới ngay khi người dùng nhấn nút hoặc đổi bài.
  }, [socket, isConnected, isPlaying, currentTrackId]);
};
