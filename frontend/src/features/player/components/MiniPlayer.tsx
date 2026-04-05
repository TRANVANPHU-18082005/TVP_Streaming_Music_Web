import { memo, useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { Maximize2, X, CircleStop } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { selectPlayer, stopPlaying } from "@/features/player/slice/playerSlice";
import { PlayerControls } from "./PlayerControls";
import { VolumeControl } from "./VolumeControl";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/format";
import { useAppDispatch } from "@/store/hooks";
import { ITrack } from "@/features/track";
import { MarqueeText } from "./MarqueeText";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface MiniPlayerProps {
  track: ITrack;
  currentTime: number;
  onExpand: () => void;
  getCurrentTime: () => number;
  onSeek: (time: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE PROGRESS BAR — pointer-capture scrubbing, drag tooltip
// Preserved exactly — this is custom scrubber logic not covered by index.css
// ─────────────────────────────────────────────────────────────────────────────
interface MobileProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
}

const MobileProgressBar = memo(
  ({ currentTime, duration, onSeek }: MobileProgressBarProps) => {
    const barRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<number | null>(null);

    const getPercent = useCallback((clientX: number): number => {
      if (!barRef.current) return 0;
      const { left, width } = barRef.current.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - left) / width));
    }, []);

    const displayPct =
      drag !== null ? drag : duration > 0 ? currentTime / duration : 0;
    const displayTime = drag !== null ? drag * duration : currentTime;
    const isDragging = drag !== null;

    const onPointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDrag(getPercent(e.clientX));
      },
      [getPercent],
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        setDrag(getPercent(e.clientX));
      },
      [getPercent],
    );

    const onPointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onSeek(getPercent(e.clientX) * duration);
        setDrag(null);
      },
      [getPercent, duration, onSeek],
    );

    return (
      <div
        ref={barRef}
        className="absolute bottom-1 left-3 right-3 h-8 flex items-end cursor-pointer touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.stopPropagation()}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(displayTime)}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = 5;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek(Math.min(currentTime + step, duration));
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek(Math.max(currentTime - step, 0));
          }
        }}
      >
        {/* Drag time tooltip */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute pointer-events-none z-20"
              style={{ bottom: 12, left: `${displayPct * 100}%`, x: "-50%" }}
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              {/* Tooltip uses inverted theme — intentionally not tokenized */}
              <div
                className="px-[7px] py-[2px] rounded-md text-[10px] font-mono font-semibold whitespace-nowrap shadow-md"
                style={{
                  background: "hsl(var(--foreground) / 0.92)",
                  color: "hsl(var(--background))",
                }}
              >
                {formatTime(displayTime)}
              </div>
              {/* Caret */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "3px solid transparent",
                  borderRight: "3px solid transparent",
                  borderTop: "3px solid hsl(var(--foreground) / 0.92)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Track */}
        <div
          className="relative w-full rounded-b-2xl overflow-hidden"
          style={{
            height: isDragging ? 4 : 2.5,
            transition: "height 0.15s ease",
          }}
        >
          <div className="absolute inset-0 bg-foreground/[0.08]" />
          <div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{
              width: `${displayPct * 100}%`,
              transition: isDragging ? "none" : "width 0.1s linear",
            }}
          />
        </div>

        {/* Thumb knob */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute top-1/2"
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "hsl(var(--primary))",
                boxShadow:
                  "0 0 0 4px hsl(var(--primary) / 0.2), 0 2px 6px rgba(0,0,0,0.25)",
                left: `calc(${displayPct * 100}% - 6.5px)`,
                translateY: "-50%",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);
MobileProgressBar.displayName = "MobileProgressBar";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL ARTWORK — Framer pulse ring isolated so outer tree never re-renders
//
// Spin animation: REMOVED CSS singleton injection.
// Replaced with Tailwind arbitrary class `[animation:vinyl-spin_10s_linear_infinite]`
// which uses the @keyframes vinyl-spin already defined in index.css section 2.
// .pause-animation from index.css section 17 handles the paused state.
// No document.createElement, no module-level _vinylStyleInjected flag.
// ─────────────────────────────────────────────────────────────────────────────
interface VinylArtworkProps {
  src?: string;
  alt: string;
  isPlaying: boolean;
  size?: number;
}

const VinylArtwork = memo(
  ({ src, alt, isPlaying, size = 40 }: VinylArtworkProps) => (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Pulsing ring — Framer, isolated in this subtree */}
      <motion.div
        className="absolute rounded-full border"
        style={{ inset: -3, borderColor: "hsl(var(--primary) / 0.5)" }}
        animate={
          isPlaying
            ? { opacity: [0.35, 0.9, 0.35], scale: [1, 1.06, 1] }
            : { opacity: 0.15, scale: 1 }
        }
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      {/* Disc — uses @keyframes vinyl-spin from index.css via arbitrary class */}
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          "border border-black/10 dark:border-white/10",
          "shadow-raised dark:shadow-[0_2px_8px_hsl(0_0%_0%/0.5)]",
          // Uses index.css @keyframes vinyl-spin (defined in @theme keyframes)
          isPlaying ? "animate-vinyl-slow" : "pause-animation",
        )}
        style={{ width: size, height: size }}
      >
        <ImageWithFallback
          src={src}
          alt={alt}
          className="size-full object-cover"
        />

        {/* Gloss overlay */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Spindle */}
        <div
          className="absolute rounded-full z-10 border border-border"
          style={{
            width: 7,
            height: 7,
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "hsl(var(--background))",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  ),
);
VinylArtwork.displayName = "VinylArtwork";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PROGRESS LINE — pure CSS width transition, no Framer
// ─────────────────────────────────────────────────────────────────────────────
const DesktopProgressLine = memo(
  ({ currentTime, duration }: { currentTime: number; duration: number }) => {
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    return (
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-10">
        <div className="absolute inset-0 bg-foreground/[0.06]" />
        <div
          className="absolute left-0 top-0 h-full bg-primary"
          style={{ width: `${pct}%`, transition: "width 0.1s linear" }}
        />
      </div>
    );
  },
);
DesktopProgressLine.displayName = "DesktopProgressLine";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO — isolated memo, only re-renders when track changes
// ─────────────────────────────────────────────────────────────────────────────
interface TrackInfoProps {
  track: ITrack;
  isPlaying: boolean;
  onExpand: () => void;
}

const TrackInfo = memo(({ track, isPlaying, onExpand }: TrackInfoProps) => (
  <div
    className="flex items-center gap-2.5 flex-1 md:w-[32%] md:flex-none min-w-0 cursor-pointer group"
    onClick={onExpand}
    role="button"
    tabIndex={0}
    aria-label={`${track.title} by ${track.artist?.name}. Click to expand player.`}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onExpand();
      }
    }}
  >
    <VinylArtwork
      src={track.coverImage}
      alt={`${track.title} album art`}
      isPlaying={isPlaying}
    />
    <div
      className="min-w-0 flex flex-col gap-0.5"
      // CSS variable để dừng khi hover cả track info block
      onMouseEnter={(e) =>
        e.currentTarget.style.setProperty("--marquee-play-state", "paused")
      }
      onMouseLeave={(e) =>
        e.currentTarget.style.setProperty("--marquee-play-state", "running")
      }
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <MarqueeText
          text={track.title}
          className="flex-1 min-w-0 text-[13px] font-semibold tracking-tight text-foreground"
          speed={38}
          pauseMs={1600}
        />
        <div className="md:hidden shrink-0">
          <PremiumMusicVisualizer active={isPlaying} barCount={7} />
        </div>
      </div>
      <p className="text-track-meta truncate">{track.artist?.name}</p>
    </div>
  </div>
));
TrackInfo.displayName = "TrackInfo";

// ─────────────────────────────────────────────────────────────────────────────
// MINI PLAYER — main component
//
// Layout:
//   Mobile:  floating glass capsule, h-[72px], rounded-2xl
//   Desktop: full-width sticky bar, h-[76px], no radius
//
// Glass system:
//   Mobile capsule → .glass-heavy token (T3 — 52px blur, 82% bg)
//   Desktop bar    → .player-bar token (fixed position, 52px blur, safe-area)
//   Both: border-border/28 + inset highlight from token
// ─────────────────────────────────────────────────────────────────────────────
export const MiniPlayer = memo(
  ({
    track,
    currentTime,
    onExpand,
    getCurrentTime,
    onSeek,
  }: MiniPlayerProps) => {
    const { isPlaying, duration } = useSelector(selectPlayer);
    const dispatch = useAppDispatch();
    const labelId = useId();

    const handleStop = useCallback(() => dispatch(stopPlaying()), [dispatch]);

    const handleExpand = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onExpand();
      },
      [onExpand],
    );

    const handleStopKeyboard = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleStop();
        }
      },
      [handleStop],
    );

    const handleExpandKeyboard = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      },
      [onExpand],
    );

    return (
      /**
       * Outer shell: pointer-events-none passes touches through to page
       * content on mobile except on the capsule itself.
       * Desktop: full-width, always interactive.
       */
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:pointer-events-auto"
        role="region"
        aria-labelledby={labelId}
        aria-label="Music player"
      >
        <span id={labelId} className="sr-only">
          Now playing: {track.title} by {track.artist?.name}
        </span>

        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className={cn(
            "pointer-events-auto relative overflow-hidden select-none",

            // ── Mobile: floating capsule with glass-heavy tier ──
            "w-[calc(100%-1.25rem)] mb-3 h-[72px] rounded-2xl",
            // glass-heavy: bg-background/82, blur-52, saturate-210
            "shadow-brand",
            "glass-heavy",

            // ── Desktop: full-width .player-bar token ──
            // player-bar from index.css: fixed, blur-52, safe-area padding,
            // border-top, shadow-[0_-8px_32px_hsl(228_32%_4%/0.18)]
            "md:w-full md:mb-0 md:h-[76px] md:rounded-none",
            "md:player-bar",
          )}
        >
          {/* Desktop: top progress line */}
          <div className="hidden md:block">
            <DesktopProgressLine
              currentTime={currentTime}
              duration={duration}
            />
          </div>

          {/* Mobile: bottom scrubber */}
          <div className="md:hidden">
            <MobileProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
            />
          </div>

          {/* Desktop: subtle ambient glow (dark mode only) */}
          <div
            className="hidden dark:md:block absolute left-0 top-0 bottom-0 w-48 pointer-events-none z-0"
            style={{
              background:
                "radial-gradient(ellipse at left center, hsl(var(--primary) / 0.04) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          {/* ── MAIN CONTENT ROW ── */}

          <div className="relative z-10 h-full px-3 md:px-6 pt-2 pb-2 flex items-center gap-2 md:gap-0 ">
            {/* LEFT — artwork + track info */}
            <TrackInfo
              track={track}
              isPlaying={isPlaying}
              onExpand={onExpand}
            />

            {/* CENTER (desktop) — transport controls + full scrubber */}
            <div
              className="hidden md:flex flex-col items-center justify-center flex-1 gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />

              {/* Scrubber with time labels */}
              <div className="w-full max-w-[480px] flex items-center gap-2.5">
                <span
                  className="text-duration text-muted-foreground w-9 text-right"
                  aria-hidden="true"
                >
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1">
                  <ProgressBar
                    hasTimeLabels={false}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={onSeek}
                  />
                </div>
                <span
                  className="text-duration text-muted-foreground w-9"
                  aria-hidden="true"
                >
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* CENTER (mobile) — transport controls only */}
            <div
              className="flex md:hidden items-center shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />
            </div>

            {/* RIGHT (mobile) — stop */}
            <button
              type="button"
              className={cn(
                "md:hidden shrink-0 p-1.5 rounded-full",
                "text-muted-foreground",
                "hover:bg-muted/70",
                "transition-all duration-150 active:scale-90",
                "focus-visible:outline-2 focus-visible:outline-ring",
              )}
              onClick={handleStop}
              onKeyDown={handleStopKeyboard}
              aria-label="Stop playback"
            >
              <X className="size-3.5" />
            </button>

            {/* RIGHT (desktop) — waveform + volume + expand + stop */}
            <div
              className="hidden md:flex items-center justify-end md:w-[32%] gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <PremiumMusicVisualizer active={isPlaying} />

              <VolumeControl className="w-24" />

              {/* Separator */}
              <div className="h-5 w-px mx-0.5 bg-border" aria-hidden="true" />

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full",
                  "text-muted-foreground",
                  "hover:bg-muted/70",
                  "transition-all duration-150",
                )}
                onClick={handleExpand}
                onKeyDown={handleExpandKeyboard}
                title="Expand player"
                aria-label="Expand to full player"
              >
                <Maximize2 className="size-4" />
              </Button>

              {/* Stop — uses .text-destructive design token (was hardcoded red-500) */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full",
                  "text-muted-foreground/60",
                  "hover:text-destructive hover:bg-destructive/10",
                  "transition-all duration-150",
                )}
                onClick={handleStop}
                title="Stop playback"
                aria-label="Stop playback"
              >
                <CircleStop className="size-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  },
);

MiniPlayer.displayName = "MiniPlayer";
export default MiniPlayer;
