import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player/slice/playerSlice";
import { useSocket } from "@/hooks/useSocket";

export const useTrackAnalytics = () => {
  const { socket, isConnected } = useSocket();
  const { currentTrackId, isPlaying } = useSelector(selectPlayer);

  const infoRef = useRef({
    trackId: currentTrackId,
    isPlaying,
  });

  useEffect(() => {
    infoRef.current = {
      trackId: currentTrackId,
      isPlaying,
    };
  }, [currentTrackId, isPlaying]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const emitHeartbeat = () => {
      const { trackId, isPlaying: playing } = infoRef.current;
      socket.emit("client_heartbeat", {
        trackId: playing && trackId ? trackId : "",
      });
    };

    emitHeartbeat();
    const interval = setInterval(emitHeartbeat, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") emitHeartbeat();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket, isConnected, isPlaying, currentTrackId]);
};
