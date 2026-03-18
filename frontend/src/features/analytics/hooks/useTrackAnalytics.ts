import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player/slice/playerSlice";
import { RootState } from "@/store/store";
import { useSocket } from "@/hooks/useSocket";

/**
 * Hook tự động gửi Heartbeat về server mỗi 10 giây.
 * Sử dụng Refs để tránh việc khởi tạo lại Interval khi State thay đổi.
 */
export const useTrackAnalytics = () => {
  const { socket, isConnected } = useSocket();
  const { currentTrack, isPlaying } = useSelector(selectPlayer);
  const { user } = useSelector((state: RootState) => state.auth);

  // Refs để lưu giá trị mới nhất mà không gây chạy lại useEffect
  const stateRef = useRef({
    user,
    currentTrack,
    isPlaying,
  });

  // Cập nhật Ref mỗi khi State từ Redux thay đổi
  useEffect(() => {
    stateRef.current = { user, currentTrack, isPlaying };
  }, [user, currentTrack, isPlaying]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const sendHeartbeat = () => {
      // 🛡️ Kiểm tra nếu Tab đang ẩn thì không gửi để tiết kiệm tài nguyên
      if (document.visibilityState !== "visible") return;

      const { user: u, currentTrack: t, isPlaying: p } = stateRef.current;

      // Chuẩn hóa UserId (Hỗ trợ cả id và _id từ Backend)
      const realUserId = u?.id || u?._id;
      const finalUserId = realUserId || `guest_${socket.id}`;

      // Emit tín hiệu về Server
      socket.emit("client_heartbeat", {
        userId: finalUserId,
        trackId: p && t ? t._id : "", // Nếu đang phát nhạc thì gửi ID bài hát, không thì gửi chuỗi rỗng
      });
    };

    // Gửi phát đầu tiên ngay khi kết nối
    sendHeartbeat();

    // Thiết lập chu kỳ 10 giây
    const interval = setInterval(sendHeartbeat, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [socket, isConnected]);
};
