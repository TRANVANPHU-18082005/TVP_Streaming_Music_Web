// features/player/hooks/useTrackListeners.ts
import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";

export const useTrackListeners = (
  trackId: string | undefined,
  isPlaying: boolean,
) => {
  const [count, setCount] = useState(0);
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    // Chỉ join room khi có socket, có trackId VÀ đang phát nhạc
    if (!socket || !isConnected || !trackId || !isPlaying) {
      // Nếu đang Pause, chúng ta nên rời phòng hoặc báo cho server biết
      if (socket && trackId && !isPlaying) {
        socket.emit("leave_track", trackId);
      }
      setCount(0); // Reset số lượng về 0 khi không phát
      return;
    }

    // 1. Tham gia phòng nghe (chỉ khi đang Play)
    socket.emit("listening_track", trackId);

    // 2. Lắng nghe cập nhật
    socket.on("listeners_count", (newCount: number) => {
      setCount(newCount);
    });

    return () => {
      // 3. Cleanup: Rời phòng và hủy lắng nghe
      socket.emit("leave_track", trackId);
      socket.off("listeners_count");
    };
  }, [socket, isConnected, trackId, isPlaying]);

  return count;
};
