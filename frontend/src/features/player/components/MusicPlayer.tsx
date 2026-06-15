import React, { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { AnimatePresence } from "framer-motion";
import {
  selectCurrentTrack,
  selectIsCurrentTrackReady,
  selectPlayer,
} from "@/features/player/slice/playerSlice";
import { useAudioPlayer } from "@/features/player/hooks/useAudioPlayer";
import { useKeyboardControls } from "@/features/player/hooks/useKeyboardControls";
import { useCrossTabSync } from "@/features/player/hooks/useCrossTabSync";
import { useTrackMetadataResolver } from "../hooks/useTrackMetadataResolver";
import { MiniPlayer } from "./MiniPlayer";
import { PlayerContext } from "../context/PlayerContext";
const FullPlayerLazy = lazy(() =>
  import("./FullPlayer").then((m) => ({ default: m.FullPlayer ?? m.default })),
);
import { useTrackListeners } from "../hooks/useTrackListeners";

import { WaveformBars } from "@/components/MusicVisualizer";
import { CLIENT_PATHS } from "@/config/paths";

export function MusicPlayer() {
  // 1. Lấy trạng thái từ Store
  const currentTrack = useSelector(selectCurrentTrack);
  const isTrackReady = useSelector(selectIsCurrentTrackReady);
  const { isPlaying, duration } = useSelector(selectPlayer);
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const isForMePage = location.pathname === `/${CLIENT_PATHS.FOR_ME}`;

  // 2. DATA RESOLVER: Đặt lên đầu để đảm bảo metadata luôn được xử lý nếu cache miss
  // Resolver này sẽ kích hoạt fetch nếu currentTrackId có nhưng metadata chưa có.
  useTrackMetadataResolver();

  // 3. AUDIO ENGINE: Vận hành dựa trên URL từ metadata
  const { audioRef, currentTime, seek, getCurrentTime, events } =
    useAudioPlayer();

  // 4. UTILITY HOOKS: Điều khiển và đồng bộ
  useKeyboardControls(seek, currentTime);
  useCrossTabSync();

  // Tự động đếm lượt nghe khi track thay đổi và đang phát
  const listenCount = useTrackListeners(currentTrack?._id, isPlaying);

  useEffect(() => {
    if (!isExpanded) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none"; // chặn iOS bounce
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isExpanded]);

  // 5. Cung cấp imperative audio functions qua Context (tránh prop drilling)
  // getCurrentTime và seek đều là stable useCallback refs từ useAudioPlayer — safe để memoize với []
  const playerContextValue = useMemo(
    () => ({ getCurrentTime, seek }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Không render gì nếu chưa có metadata bài hiện tại
  // <audio> element vẫn cần tồn tại để giữ trạng thái playback
  // PlayerContext.Provider luôn bao bọc — đảm bảo ForMeProgressBar
  // nhận được seek/getCurrentTime ngay cả khi track metadata đang load.
  if (!currentTrack) {
    return (
      <PlayerContext.Provider value={playerContextValue}>
        <audio id="global-audio-player" ref={audioRef} {...events} preload="auto" />
      </PlayerContext.Provider>
    );
  }

  return (
    <PlayerContext.Provider value={playerContextValue}>
      {/*
        <audio> luôn được mount từ đầu, không bao giờ unmount.
        Nếu đặt trong điều kiện !currentTrack thì React sẽ unmount/remount
        → audio bị reset về 0, mất trạng thái buffer.
      */}
      <audio id="global-audio-player" ref={audioRef} {...events} preload="auto" />

      {/*
        MiniPlayer luôn render khi có track — không unmount khi mở FullPlayer.
        Ẩn bằng CSS (invisible/opacity-0) thay vì conditional render
        → tránh React phải teardown/rebuild DOM, giữ animation state.
        delay-200: đợi FullPlayer slide in xong mới ẩn hoàn toàn.
        Cũng ẩn trên trang /for-me (MiniPlayer được thay bằng ForMeProgressBar).
      */}
      <div
        className={
          isExpanded || isForMePage
            ? "invisible opacity-0 transition-opacity duration-500 delay-200"
            : "visible opacity-100"
        }
      >
        <AnimatePresence mode="wait">
          <MiniPlayer
            key="mini-player"
            isLoading={!isTrackReady}
            isPlaying={isPlaying}
            duration={duration}
            track={currentTrack}
            currentTime={currentTime}
            getCurrentTime={getCurrentTime}
            onSeek={seek}
            onExpand={() => setIsExpanded(true)}
          />
        </AnimatePresence>
      </div>

      {/*
        FullPlayer chỉ mount khi isExpanded = true.
        AnimatePresence giữ component trong DOM đủ lâu để exit animation chạy xong
        trước khi React unmount thật sự.
      */}
      <AnimatePresence>
        {isExpanded && (
          <Suspense fallback={<WaveformBars active />}>
            <FullPlayerLazy
              listenCount={listenCount}
              isPlaying={isPlaying}
              isLoading={!isTrackReady}
              key="full-player"
              track={currentTrack}
              duration={duration}
              onSeek={seek}
              getCurrentTime={getCurrentTime}
              onCollapse={() => setIsExpanded(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </PlayerContext.Provider>
  );
}

export default MusicPlayer;
