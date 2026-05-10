import React, { useState, useEffect, lazy, Suspense } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence } from "framer-motion";
import {
  selectCurrentTrack,
  selectPlayer,
} from "@/features/player/slice/playerSlice";
import { useAudioPlayer } from "@/features/player/hooks/useAudioPlayer";
import { useKeyboardControls } from "@/features/player/hooks/useKeyboardControls";
import { useCrossTabSync } from "@/features/player/hooks/useCrossTabSync";
import { useTrackMetadataResolver } from "../hooks/useTrackMetadataResolver";
import { MiniPlayer } from "./MiniPlayer";
const FullPlayerLazy = lazy(() =>
  import("./FullPlayer").then((m) => ({ default: m.FullPlayer ?? m.default })),
);
import { useTrackListeners } from "../hooks/useTrackListeners";

export function MusicPlayer() {
  // selectCurrentTrack = O(1) lookup: cache[currentTrackId]
  // Trả về null nếu chưa có metadata (loading) hoặc không có bài nào
  const currentTrack = useSelector(selectCurrentTrack);

  // duration lấy từ Redux — được set bởi useAudioPlayer khi audio loadedmetadata
  const { isPlaying, duration } = useSelector(selectPlayer);

  const [isExpanded, setIsExpanded] = useState(false);

  // audioRef: gắn vào <audio> element
  // currentTime: số giây hiện tại, cập nhật mỗi ~250ms từ requestAnimationFrame
  // seek: fn(seconds) → set audio.currentTime + dispatch seekTo vào Redux
  // getCurrentTime: fn() → trả về audio.currentTime trực tiếp (không qua state)
  //   dùng cho prevTrack — cần biết đã nghe bao nhiêu giây để quyết định replay hay back
  // events: { onTimeUpdate, onEnded, onLoadedMetadata, ... } gắn vào <audio>
  const { audioRef, currentTime, seek, getCurrentTime, events } =
    useAudioPlayer();

  // Global keyboard: Space = play/pause, ←→ = seek 5s, M = mute
  useKeyboardControls(seek, currentTime);

  // BroadcastChannel: đồng bộ play/pause giữa các tab cùng domain
  useCrossTabSync();

  // Tự động fetch metadata khi cache miss:
  //   - currentTrackId thay đổi + loadingState === "loading" → gọi trackApi.getTrackDetail
  //   - nextTrackIdPreloaded thay đổi → preload silent
  //   - dùng fetchingRef (Set) để không duplicate request cùng 1 ID
  useTrackMetadataResolver();
  const listenCount = useTrackListeners(currentTrack?._id, isPlaying);
  // Scroll lock khi FullPlayer mở — đặt SAU hooks để không vi phạm rules of hooks
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

  // Không render gì nếu chưa có metadata bài hiện tại
  // <audio> element vẫn cần tồn tại để giữ trạng thái playback
  if (!currentTrack) {
    return <audio ref={audioRef} {...events} preload="auto" />;
  }

  return (
    <>
      {/*
        <audio> luôn được mount từ đầu, không bao giờ unmount.
        Nếu đặt trong điều kiện !currentTrack thì React sẽ unmount/remount
        → audio bị reset về 0, mất trạng thái buffer.
      */}
      <audio ref={audioRef} {...events} preload="auto" />

      {/*
        MiniPlayer luôn render khi có track — không unmount khi mở FullPlayer.
        Ẩn bằng CSS (invisible/opacity-0) thay vì conditional render
        → tránh React phải teardown/rebuild DOM, giữ animation state.
        delay-200: đợi FullPlayer slide in xong mới ẩn hoàn toàn.
      */}
      <div
        className={
          isExpanded
            ? "invisible opacity-0 transition-opacity duration-500 delay-200"
            : "visible opacity-100"
        }
      >
        <MiniPlayer
          isPlaying={isPlaying}
          duration={duration}
          track={currentTrack}
          currentTime={currentTime}
          getCurrentTime={getCurrentTime}
          onSeek={seek}
          onExpand={() => setIsExpanded(true)}
        />
      </div>

      {/*
        FullPlayer chỉ mount khi isExpanded = true.
        AnimatePresence giữ component trong DOM đủ lâu để exit animation chạy xong
        trước khi React unmount thật sự.
      */}
      <AnimatePresence>
        {isExpanded && (
          <Suspense
            fallback={
              <div
                role="status"
                aria-label="Loading player"
                className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
              />
            }
          >
            <FullPlayerLazy
              listenCount={listenCount}
              isPlaying={isPlaying}
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
    </>
  );
}

export default MusicPlayer;
