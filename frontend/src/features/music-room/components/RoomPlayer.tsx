// features/music-room/components/RoomPlayer.tsx
/**
 * Player đồng bộ cho Music Room.
 * Host mới có quyền skip/pause.
 * Tuân theo design system index.css.
 */

import React, { useRef, useEffect, useState, memo } from "react";
import { useSelector } from "react-redux";
import { Play, Pause, SkipForward, Music2 } from "lucide-react";
import { selectPlaybackState, selectCurrentRoom, selectIsHost } from "../store/roomSlice";
import { ROOM_THEMES } from "../types/room.types";
import { useRoomPlayback } from "../hooks/useRoomPlayback";
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
  const isHost = useSelector(selectIsHost);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const theme = (currentRoom?.theme ?? "bar") as keyof typeof ROOM_THEMES;
  const accentColor = ROOM_THEMES[theme].accent;

  const currentTrack = playbackState?.currentTrackId
    ? (currentRoom as any)?.currentTrack ||
    currentRoom?.queue.find((q) => q.track._id === playbackState.currentTrackId)?.track
    : null;

  const trackUrl = currentTrack?.hlsUrl || currentTrack?.trackUrl;
  useRoomPlayback({ audioRef, trackUrl });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (isHost) {
        onPlayNext();
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isHost, onPlayNext]);

  const isPaused = playbackState?.isPaused ?? true;
  const hasTrack = !!currentTrack;

  const handleTogglePause = () => {
    if (!isHost || !audioRef.current) return;
    onTogglePause(audioRef.current.currentTime);
  };

  return (
    <div className="relative flex w-full flex-col items-center gap-5 rounded-3xl glass-frosted p-6 shadow-floating border border-border/50 dark:border-border/20">
      <audio ref={audioRef} preload="metadata" />

      {/* ── Album art with glow ── */}
      <div className="relative flex justify-center w-full">
        {/* Glow halo */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 sm:w-52 sm:h-52 rounded-full transition-all duration-1000 pointer-events-none",
            !isPaused && hasTrack ? "opacity-100" : "opacity-0"
          )}
          style={{
            boxShadow: `0 0 40px 8px ${accentColor}33, 0 0 80px 20px ${accentColor}15`,
            background: `radial-gradient(circle at center, ${accentColor}18 0%, transparent 70%)`,
          }}
        />

        {/* Vinyl */}
        <div
          className={cn(
            "relative w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden shadow-card-lg transition-all duration-700",
            "border-4 border-background/20",
            !isPaused && hasTrack ? "scale-100 opacity-100" : "scale-95 opacity-70",
            !isPaused && hasTrack && "animate-[spin_22s_linear_infinite]"
          )}
          style={!isPaused && hasTrack ? { boxShadow: `0 0 0 4px ${accentColor}33, 0 8px 32px ${accentColor}22` } : {}}
        >
          {/* Grooves */}
          {[1.5, 4, 8, 14].map((m) => (
            <div key={m} className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" style={{ margin: `${m * 4}px` }} />
          ))}

          {hasTrack && currentTrack?.coverImage ? (
            <ImageWithFallback src={currentTrack.coverImage} alt={currentTrack.title} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/50">
              <Music2 className="size-14 opacity-20" />
            </div>
          )}

          {/* Center hole */}
          <div
            className="absolute inset-0 m-auto size-2 sm:size-4 rounded-full border-2 border-background/40 shadow-inner"
            style={{ backgroundColor: "hsl(var(--background) / 0.95)" }}
          />
        </div>

        {/* Playhead Arm */}
        <div
          className={cn(
            "absolute top-0 right-8 sm:right-10 w-3 h-20 sm:h-24 origin-top rounded-full shadow-md transition-all duration-1000 hidden sm:block z-10",
            !isPaused && hasTrack ? "rotate-[28deg]" : "rotate-0"
          )}
          style={{ background: "linear-gradient(to bottom, hsl(var(--muted-foreground)), hsl(var(--border)))" }}
        >
          <div className="absolute bottom-0 -left-1.5 w-6 h-8 rounded shadow-md" style={{ backgroundColor: "hsl(var(--foreground) / 0.75)" }} />
          <div className="absolute top-2 left-0.5 size-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--background))", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)" }} />
        </div>
      </div>

      {/* ── Track info ── */}
      <div className="flex w-full flex-col items-center text-center gap-1">
        <h3 className="text-base sm:text-lg font-bold max-w-full truncate">
          {hasTrack ? currentTrack?.title : "Chưa có bài nào"}
        </h3>
        {hasTrack && currentTrack?.artist ? (
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate max-w-full">
            {currentTrack.artist.name}
          </p>
        ) : (
          <p className="text-xs sm:text-sm font-medium truncate max-w-full animate-pulse" style={{ color: accentColor }}>
            {isHost ? "Hãy thêm bài hát vào hàng đợi" : "Hãy gửi yêu cầu bài hát cho Host"}
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

      {/* ── Controls ── */}
      <div className="flex w-full items-center justify-center gap-5 mt-1">
        {isHost ? (
          <>
            <button
              disabled
              className="size-11 rounded-full flex items-center justify-center opacity-25 text-muted-foreground"
              aria-label="Bài trước (không hỗ trợ)"
            >
              <SkipForward className="size-5 rotate-180" />
            </button>

            {/* Play/Pause — Premium */}
            <button
              id="room-toggle-pause-btn"
              onClick={handleTogglePause}
              disabled={!hasTrack}
              className="size-16 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-brand-lg"
              aria-label={isPaused ? "Phát" : "Dừng"}
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                boxShadow: `0 8px 28px ${accentColor}44, 0 0 0 1px ${accentColor}33`,
              }}
            >
              {isPaused ? <Play className="size-7 fill-current ml-1" /> : <Pause className="size-7 fill-current" />}
            </button>

            <button
              id="room-play-next-btn"
              onClick={onPlayNext}
              disabled={!currentRoom || currentRoom.queue.length === 0}
              className="size-11 rounded-full flex items-center justify-center hover:bg-muted/50 disabled:opacity-25 text-muted-foreground hover:text-foreground rounded-full transition-all"
              aria-label="Bài tiếp theo"
            >
              <SkipForward className="size-5" />
            </button>
          </>
        ) : (
          /* Listener state indicator */
          <div className="w-full flex items-center justify-between px-2">
            <div className="glass flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 dark:border-border/30" aria-live="polite">
              {isPaused ? (
                <>
                  <Pause className="size-3.5 opacity-60" />
                  <span className="text-xs font-semibold text-muted-foreground">Tạm dừng</span>
                </>
              ) : (
                <>
                  <div className="flex items-end gap-0.5 h-3.5">
                    {[1, 2, 3].map((b) => (
                      <div
                        key={b}
                        className="w-0.5 rounded-full animate-pulse"
                        style={{
                          height: `${40 + b * 20}%`,
                          backgroundColor: accentColor,
                          animationDelay: `${b * 0.18}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: accentColor }}>
                    Đang phát đồng bộ
                  </span>
                </>
              )}
            </div>

            <div className="w-16 opacity-60">
              <RoomVisualizer
                isPlaying={!isPaused && hasTrack}
                accentColor={accentColor}
                barsCount={12}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

RoomPlayer.displayName = "RoomPlayer";
export default RoomPlayer;
