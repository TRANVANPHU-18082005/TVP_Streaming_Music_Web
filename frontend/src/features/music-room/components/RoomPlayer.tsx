// features/music-room/components/RoomPlayer.tsx
/**
 * Player đồng bộ cho Music Room.
 * Host mới có quyền skip/pause.
 * Tuân theo design system index.css.
 */

import React, { useRef, useEffect, useState, memo } from "react";
import { useSelector } from "react-redux";
import { Play, Pause, SkipForward, Music2 } from "lucide-react";
import { selectPlaybackState, selectCurrentRoom, selectCanControlPlayback } from "../store/roomSlice";
import { ROOM_THEMES } from "../types/room.types";
import { roomPositionSeconds, useRoomPlayback } from "../hooks/useRoomPlayback";
import RoomVisualizer from "./RoomVisualizer";
import { ProgressBar } from "@/features/player/components/ProgressBar";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface Props {
  onPlayNext: () => void;
  onTogglePause: (currentPosition: number) => void;
}

const RoomPlayer = memo(({ onPlayNext, onTogglePause }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackState = useSelector(selectPlaybackState);
  const currentRoom = useSelector(selectCurrentRoom);
  const canControl = useSelector(selectCanControlPlayback);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const theme = (currentRoom?.theme ?? "bar") as keyof typeof ROOM_THEMES;
  const accentColor = ROOM_THEMES[theme].accent;

  const currentTrack = playbackState?.currentTrackId
    ? (currentRoom as any)?.currentTrack ||
    currentRoom?.queue.find((q) => q.track._id === playbackState.currentTrackId)?.track
    : null;

  const trackUrl = currentTrack?.hlsUrl || currentTrack?.trackUrl;
  const { needsUnlock, unlock, clockOffsetMs } = useRoomPlayback({ audioRef, trackUrl });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onDurationChange = () => {
      if (!currentTrack?.duration) setDuration(audio.duration || 0);
    };
    const onEnded = () => {
      if (canControl) onPlayNext();
    };
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [canControl, currentTrack?.duration, onPlayNext]);

  useEffect(() => {
    const tick = () => {
      const fromClock = roomPositionSeconds(playbackState, clockOffsetMs);
      setProgress(fromClock);
      const trackDuration = currentTrack?.duration;
      if (trackDuration) setDuration(trackDuration);
    };
    tick();
    if (playbackState?.isPaused) return;
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [playbackState, clockOffsetMs, currentTrack?.duration]);

  const isPaused = playbackState?.isPaused ?? true;
  const hasTrack = !!currentTrack;

  const queueEmpty = !currentRoom || currentRoom.queue.length === 0;

  const handlePrimary = () => {
    if (!canControl) return;
    if (!hasTrack) {
      onPlayNext();
      return;
    }
    onTogglePause(0);
  };

  const listenerView = (
      <div className="relative flex w-full flex-col items-center justify-center gap-6 mt-10 lg:mt-20">
        {!hasTrack ? (
          <div className="glass flex items-center gap-3 rounded-full px-5 py-3 border border-border/20 shadow-floating backdrop-blur-xl">
             <Music2 className="size-4 text-muted-foreground/70" />
             <span className="text-sm font-medium text-foreground/80">Chưa có bài đang phát</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            {/* Spinning Disc Mini */}
            <div className="relative flex justify-center">
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl transition-opacity duration-700",
                  !isPaused ? "opacity-60" : "opacity-0",
                )}
                style={{ backgroundColor: accentColor }}
              />
              <div
                className={cn(
                  "relative size-28 overflow-hidden rounded-full shadow-xl transition-all duration-700 border-[6px] border-zinc-950/90",
                  !isPaused ? "opacity-100 scale-100 animate-spin" : "opacity-80 scale-95",
                )}
                style={{ animationDuration: "8s", animationPlayState: isPaused ? 'paused' : 'running' }}
              >
                {currentTrack?.coverImage ? (
                  <ImageWithFallback src={currentTrack.coverImage} alt={currentTrack.title} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-zinc-900">
                    <Music2 className="size-8 opacity-30 text-white" />
                  </div>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 rounded-full bg-zinc-950 shadow-inner border border-zinc-800" />
              </div>
            </div>

            {/* Info Pill */}
            <div className="glass-heavy flex items-center gap-4 rounded-[2rem] px-5 py-3 shadow-floating border border-border/30 backdrop-blur-2xl w-full">
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-sm font-bold truncate text-foreground/90">{currentTrack?.title}</h3>
                <p className="text-[11px] text-muted-foreground truncate font-medium">{currentTrack?.artist?.name}</p>
              </div>

              {/* Status / Visualizer */}
              <div className="shrink-0 flex items-center gap-3 border-l border-border/30 pl-4">
                {needsUnlock ? (
                  <button
                    type="button"
                    onClick={() => void unlock()}
                    className="flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors"
                  >
                    Bật tiếng
                  </button>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 opacity-80 h-4 flex items-end">
                      <RoomVisualizer
                        isPlaying={!isPaused}
                        accentColor={accentColor}
                        barsCount={4}
                      />
                    </div>
                    {isPaused && <span className="text-[9px] font-bold text-muted-foreground uppercase">Tạm dừng</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Mini Progress */}
            <div className="w-full px-4 -mt-2 opacity-80 hover:opacity-100 transition-opacity">
              <ProgressBar
                currentTime={progress}
                duration={duration}
                onSeek={() => { }} // Read-only
                hasTimeLabels={true}
              />
            </div>
          </div>
        )}
      </div>
  );

  const hostView = (
    <div className="relative flex w-full flex-col items-center gap-5 rounded-3xl glass-frosted p-6 shadow-floating border border-border/50 dark:border-border/20">
      {!hasTrack && (
        <div className="flex flex-col items-center gap-3 px-4 py-2 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl border border-border/30 bg-muted/40">
            <Music2 className="size-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold">Chưa có bài nào</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            {canControl
              ? "Thêm bài vào hàng chờ, rồi bấm Phát để cả phòng cùng nghe."
              : "Chưa có bài đang phát. Hãy thêm bài hoặc bình chọn bài tiếp theo."}
          </p>
        </div>
      )}

      {hasTrack && (
      <>
      <div className="relative flex justify-center w-full">
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-700 sm:size-52",
            !isPaused ? "opacity-70" : "opacity-0",
          )}
          style={{ backgroundColor: accentColor }}
        />
        <div
          className={cn(
            "relative size-44 overflow-hidden rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-700 sm:size-52",
            !isPaused ? "opacity-100 scale-100 animate-spin" : "opacity-80 scale-95",
          )}
          style={{ animationDuration: "8s" }}
        >
          {currentTrack?.coverImage ? (
            <ImageWithFallback src={currentTrack.coverImage} alt={currentTrack.title} className="size-full object-cover rounded-full border-[12px] border-zinc-950" />
          ) : (
            <div className="flex size-full items-center justify-center bg-zinc-950 rounded-full border-[12px] border-zinc-950">
              <Music2 className="size-14 opacity-20 text-white" />
            </div>
          )}
          {/* Center hole */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-background border border-border/50 z-10 shadow-inner" />
          {/* Light reflection / gloss */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 via-white/10 to-transparent mix-blend-overlay" />
        </div>
      </div>

      {/* ── Track info ── */}
      <div className="flex w-full flex-col items-center text-center gap-1">
        <h3 className="text-base sm:text-lg font-bold max-w-full truncate">
          {currentTrack?.title}
        </h3>
        {currentTrack?.artist && (
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate max-w-full">
            {currentTrack.artist.name}
          </p>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="w-full">
        <ProgressBar
          currentTime={progress}
          duration={duration}
          onSeek={() => { }} // Read-only for room sync
          hasTimeLabels={true}
        />
      </div>
      </>
      )}

      {/* ── Controls — luôn hiện, kể cả khi chưa có bài ── */}
      <div className="flex w-full items-center justify-center gap-5 mt-1">
        {needsUnlock && (
          <button
            type="button"
            onClick={() => void unlock()}
            className="pressable mb-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Bật tiếng
          </button>
        )}
        {canControl ? (
          <>
            <button
              id="room-toggle-pause-btn"
              onClick={handlePrimary}
              disabled={!hasTrack && queueEmpty}
              className="size-16 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-brand-lg"
              aria-label={!hasTrack || isPaused ? "Phát" : "Dừng"}
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                boxShadow: `0 8px 28px ${accentColor}44, 0 0 0 1px ${accentColor}33`,
              }}
            >
              {!hasTrack || isPaused ? <Play className="size-7 fill-current ml-1" /> : <Pause className="size-7 fill-current" />}
            </button>

            <button
              id="room-play-next-btn"
              onClick={onPlayNext}
              disabled={queueEmpty}
              className="size-11 rounded-full flex items-center justify-center hover:bg-muted/50 disabled:opacity-25 text-muted-foreground hover:text-foreground transition-all"
              aria-label="Bài tiếp theo"
            >
              <SkipForward className="size-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <audio ref={audioRef} preload="metadata" className="hidden" />
      {canControl ? hostView : listenerView}
    </>
  );
});

RoomPlayer.displayName = "RoomPlayer";
export default RoomPlayer;
