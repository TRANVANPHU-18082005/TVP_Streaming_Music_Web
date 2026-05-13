import { memo, useRef, useState, useCallback, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X, CircleStop } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { stopPlaying } from "@/features/player/slice/playerSlice";
import { PlayerControls } from "./PlayerControls";
import { VolumeControl } from "./VolumeControl";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/format";
import { useAppDispatch } from "@/store/hooks";
import { ITrack } from "@/features/track";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";

import { TrackTitleMarquee } from "./TrackTitleMarquee";
import { MiniPlayerSkeleton } from "./MiniPlayerSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MiniPlayerProps {
  track: ITrack;
  /** Current audio time in seconds — used ONLY for ProgressBar & time labels */
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  isLoading: boolean;
  onExpand: () => void;
  /** Direct accessor — bypasses React state for smooth progress updates */
  getCurrentTime: () => number;
  onSeek: (time: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE ANIMATION OBJECTS — PERF-6: hoisted to avoid new object per render
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_ANIMATE = { y: 0, opacity: 1 };
const PLAYER_INITIAL = { y: 120, opacity: 0 };
const PLAYER_EXIT = { y: 120, opacity: 0 };
const PLAYER_TRANSITION = {
  type: "spring",
  stiffness: 340,
  damping: 30,
} as const;

const TOOLTIP_INITIAL = { opacity: 0, y: 4, scale: 0.85 };
const TOOLTIP_ANIMATE = { opacity: 1, y: 0, scale: 1 };
const TOOLTIP_EXIT = { opacity: 0, y: 4, scale: 0.85 };
const TOOLTIP_TRANSITION = {
  type: "spring",
  stiffness: 500,
  damping: 28,
} as const;

const KNOB_INITIAL = { scale: 0, opacity: 0 };
const KNOB_ANIMATE = { scale: 1, opacity: 1 };
const KNOB_EXIT = { scale: 0, opacity: 0 };
const KNOB_TRANSITION = {
  type: "spring",
  stiffness: 500,
  damping: 22,
} as const;

const RING_PLAYING = { opacity: [0.35, 0.9, 0.35], scale: [1, 1.06, 1] };
const RING_PAUSED = { opacity: 0.15, scale: 1 };
const RING_TRANSITION = {
  duration: 2.5,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PROGRESS LINE — PERF-2: imperative DOM, zero React re-render per tick
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopProgressLineProps {
  getCurrentTime: () => number;
  duration: number;
}

const DesktopProgressLine = memo(
  ({ getCurrentTime, duration }: DesktopProgressLineProps) => {
    const fillRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);

    // rAF loop — mutates DOM directly, React never reconciles this element
    useEffect(() => {
      const tick = () => {
        if (fillRef.current && duration > 0) {
          const pct = Math.min(100, (getCurrentTime() / duration) * 100);
          fillRef.current.style.width = `${pct}%`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
      // getCurrentTime is a stable callback — safe to omit from deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration]);

    return (
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-10">
        <div className="absolute inset-0 bg-foreground/[0.06]" />
        <div
          ref={fillRef}
          className="absolute left-0 top-0 h-full bg-primary will-change-[width]"
          // Initial width — will be updated by rAF before first paint
          style={{ width: "0%", transition: "width 0.1s linear" }}
        />
      </div>
    );
  },
);
DesktopProgressLine.displayName = "DesktopProgressLine";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE PROGRESS BAR — PERF-3,5,9: imperative tooltip, CSS transitions
// ─────────────────────────────────────────────────────────────────────────────

interface MobileProgressBarProps {
  getCurrentTime: () => number;
  duration: number;
  onSeek: (t: number) => void;
}

const MobileProgressBar = memo(
  ({ getCurrentTime, duration, onSeek }: MobileProgressBarProps) => {
    const barRef = useRef<HTMLDivElement>(null);
    const fillRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLSpanElement>(null);
    const rafRef = useRef(0);

    // isDragging: boolean state — only 2 transitions vs continuous time updates
    const [isDragging, setIsDragging] = useState(false);
    const dragPctRef = useRef(0);

    // PERF-3: rAF loop updates fill width imperatively when NOT dragging
    useEffect(() => {
      const tick = () => {
        if (!isDragging && fillRef.current && duration > 0) {
          const pct = Math.min(100, (getCurrentTime() / duration) * 100);
          fillRef.current.style.width = `${pct}%`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration, isDragging]);

    // PERF-5: no dep on barRef — read .current directly in callback
    const getPercent = useCallback((clientX: number): number => {
      if (!barRef.current) return 0;
      const { left, width } = barRef.current.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - left) / width));
    }, []);

    // Update drag-state UI imperatively — no setState on every pointermove
    const updateDragUI = useCallback(
      (pct: number) => {
        dragPctRef.current = pct;
        const pctStr = `${pct * 100}%`;

        if (fillRef.current) fillRef.current.style.width = pctStr;

        if (tooltipRef.current) tooltipRef.current.style.left = pctStr;

        if (knobRef.current) {
          knobRef.current.style.left = `calc(${pctStr} - 6.5px)`;
        }

        // PERF-3: update tooltip text directly
        if (timeRef.current) {
          timeRef.current.textContent = formatTime(pct * duration);
        }
      },
      [duration],
    );

    const onPointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const pct = getPercent(e.clientX);
        dragPctRef.current = pct;
        setIsDragging(true);
        updateDragUI(pct);
      },
      [getPercent, updateDragUI],
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        updateDragUI(getPercent(e.clientX));
      },
      [getPercent, updateDragUI],
    );

    const onPointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const pct = getPercent(e.clientX);
        onSeek(pct * duration);
        setIsDragging(false);
      },
      [getPercent, duration, onSeek],
    );

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const step = 5;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(getCurrentTime() + step, duration));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(getCurrentTime() - step, 0));
        }
      },
      [getCurrentTime, duration, onSeek],
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
        aria-valuenow={Math.round(getCurrentTime())}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {/* Drag tooltip — shown/hidden by AnimatePresence, position via ref */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              ref={tooltipRef}
              className="absolute pointer-events-none z-20"
              style={{
                bottom: 12,
                left: `${dragPctRef.current * 100}%`,
                x: "-50%",
              }}
              initial={TOOLTIP_INITIAL}
              animate={TOOLTIP_ANIMATE}
              exit={TOOLTIP_EXIT}
              transition={TOOLTIP_TRANSITION}
            >
              <div
                className="px-[7px] py-[2px] rounded-md text-[10px] font-mono font-semibold whitespace-nowrap shadow-md"
                style={{
                  background: "hsl(var(--foreground) / 0.92)",
                  color: "hsl(var(--background))",
                }}
              >
                {/* PERF-3: span ref for direct text update during drag */}
                <span ref={timeRef}>
                  {formatTime(dragPctRef.current * duration)}
                </span>
              </div>
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

        {/* Track — PERF-9: CSS class for height transition */}
        <div
          className={cn(
            "relative w-full rounded-b-2xl overflow-hidden",
            "transition-[height] duration-150 ease-out",
            isDragging ? "h-1" : "h-[2.5px]",
          )}
        >
          <div className="absolute inset-0 bg-foreground/[0.08]" />
          <div
            ref={fillRef}
            className={cn(
              "absolute left-0 top-0 h-full bg-primary will-change-[width]",
              // PERF-9: CSS class not inline style
              isDragging
                ? "transition-none"
                : "transition-[width] duration-100 linear",
            )}
            style={{ width: "0%" }}
          />
        </div>

        {/* Thumb knob — position set via ref during drag */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              ref={knobRef}
              className="absolute top-1/2"
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "hsl(var(--primary))",
                boxShadow:
                  "0 0 0 4px hsl(var(--primary) / 0.2), 0 2px 6px rgba(0,0,0,0.25)",
                left: `calc(${dragPctRef.current * 100}% - 6.5px)`,
                translateY: "-50%",
              }}
              initial={KNOB_INITIAL}
              animate={KNOB_ANIMATE}
              exit={KNOB_EXIT}
              transition={KNOB_TRANSITION}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);
MobileProgressBar.displayName = "MobileProgressBar";

// ─────────────────────────────────────────────────────────────────────────────
// TIME DISPLAY — PERF-1: isolated component, reads getCurrentTime() via interval
// Parent does NOT need to pass currentTime prop to trigger re-renders
// ─────────────────────────────────────────────────────────────────────────────

interface TimeDisplayProps {
  getCurrentTime: () => number;
  duration: number;
  side: "current" | "remaining";
}

const TimeDisplay = memo(
  ({ getCurrentTime, duration, side }: TimeDisplayProps) => {
    const [display, setDisplay] = useState(() => {
      const t = getCurrentTime();
      return side === "current"
        ? formatTime(t)
        : formatTime(Math.max(0, duration - t));
    });

    useEffect(() => {
      // Update at ~4Hz — matches native audio timeupdate frequency
      // Faster would waste CPU; slower would feel laggy
      const id = setInterval(() => {
        const t = getCurrentTime();
        setDisplay(
          side === "current"
            ? formatTime(t)
            : formatTime(Math.max(0, duration - t)),
        );
      }, 250);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration, side]);

    return (
      <span
        className="text-duration text-muted-foreground w-9 tabular-nums"
        aria-hidden="true"
        style={{ textAlign: side === "current" ? "right" : "left" }}
      >
        {display}
      </span>
    );
  },
);
TimeDisplay.displayName = "TimeDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL ARTWORK — PERF-4: accepts isPlaying directly, isolated from TrackInfo
// ─────────────────────────────────────────────────────────────────────────────

interface VinylArtworkProps {
  src?: string;
  alt: string;
  isPlaying: boolean;
  size?: number;
  onExpand?: () => void;
}

const VinylArtwork = memo(
  ({ src, alt, isPlaying, size = 40, onExpand }: VinylArtworkProps) => (
    <div className="relative shrink-0" style={{ width: size, height: size }} onClick={onExpand} role="button" tabIndex={0} aria-label="Expand player">
      {/* Pulsing ring — Framer, isolated in this subtree */}
      <motion.div
        className="absolute rounded-full border"
        style={{ inset: -3, borderColor: "hsl(var(--primary) / 0.5)" }}
        animate={isPlaying ? RING_PLAYING : RING_PAUSED}
        transition={RING_TRANSITION}
        aria-hidden="true"
      />

      {/* Disc — CSS @keyframes vinyl-spin via Tailwind class */}
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          "border border-black/10 dark:border-white/10",
          "shadow-raised dark:shadow-[0_2px_8px_hsl(0_0%_0%/0.5)]",
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
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--foreground) / 0.18) 0%, transparent 55%)",
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
  // Re-render only when src or isPlaying changes — not on parent time updates
  (prev, next) =>
    prev.src === next.src &&
    prev.isPlaying === next.isPlaying &&
    prev.alt === next.alt &&
    prev.size === next.size,
);
VinylArtwork.displayName = "VinylArtwork";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO — PERF-4: no longer receives isPlaying — VinylArtwork gets it directly
// ─────────────────────────────────────────────────────────────────────────────

interface TrackInfoProps {
  track: ITrack;
  isPlaying: boolean;
  onExpand: () => void;
  onPrefetch?: () => void;
}

const TrackInfo = memo(
  ({ track, isPlaying, onExpand, onPrefetch }: TrackInfoProps) => {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      },
      [onExpand],
    );

    return (
      <div
        className="flex items-center gap-2.5 flex-1 md:w-[32%] md:flex-none min-w-0 cursor-pointer group"
       
        role="button"
        tabIndex={0}
        aria-label={`${track.title} by ${track.artist?.name}. Click to expand player.`}
        onKeyDown={handleKeyDown}
        onPointerEnter={() => onPrefetch?.()}
        onFocus={() => onPrefetch?.()}
      >
        <VinylArtwork
          src={track.coverImage}
          alt={`${track.title} album art`}
          isPlaying={isPlaying}
           onExpand={onExpand}
        />
        <div
          className="min-w-0 flex flex-col gap-0.5"
          onMouseEnter={(e) =>
            e.currentTarget.style.setProperty("--marquee-play-state", "paused")
          }
          onMouseLeave={(e) =>
            e.currentTarget.style.setProperty("--marquee-play-state", "running")
          }
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <TrackTitleMarquee
              id={track._id}
              title={track.title}
              mainArtist={track.artist}
              featuringArtists={track.featuringArtists}
              className="text-sm"
              artistClassName="text-xs"
            />
            <div className="md:hidden shrink-0">
              <PremiumMusicVisualizer active={isPlaying} barCount={7} />
            </div>
          </div>
        </div>
      </div>
    );
  },
  // Re-render only when track identity or isPlaying changes
  (prev, next) =>
    prev.track._id === next.track._id &&
    prev.track.title === next.track.title &&
    prev.track.coverImage === next.track.coverImage &&
    prev.isPlaying === next.isPlaying &&
    prev.onExpand === next.onExpand &&
    prev.onPrefetch === next.onPrefetch,
);
TrackInfo.displayName = "TrackInfo";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP RIGHT SECTION — isolated so isPlaying changes don't touch left side
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopRightProps {
  isPlaying: boolean;
  onExpand: () => void;
  onStop: () => void;
  onPrefetch?: () => void;
}

const DesktopRight = memo(
  ({ isPlaying, onExpand, onStop, onPrefetch }: DesktopRightProps) => (
    <div
      className="hidden md:flex items-center justify-end md:w-[32%] gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <PremiumMusicVisualizer active={isPlaying} />

      <VolumeControl className="w-24" />

      <div className="h-5 w-px mx-0.5 bg-border" aria-hidden="true" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/70 transition-all duration-150"
        onClick={onExpand}
        onMouseEnter={() => onPrefetch?.()}
        onFocus={() => onPrefetch?.()}
        title="Mở rộng player"
        aria-label="Mở rộng player"
      >
        <Maximize2 className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        onClick={onStop}
        title="Dừng phát"
        aria-label="Dừng phát nhạc"
      >
        <CircleStop className="size-4" />
      </Button>
    </div>
  ),
);
DesktopRight.displayName = "DesktopRight";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP CENTER — controls + scrubber, isolated from time updates
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopCenterProps {
  currentTime: number;
  duration: number;
  getCurrentTime: () => number;
  onSeek: (t: number) => void;
}

const DesktopCenter = memo(
  ({ currentTime, duration, getCurrentTime, onSeek }: DesktopCenterProps) => (
    <div
      className="hidden md:flex flex-col items-center justify-center flex-1 gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />

      <div className="w-full max-w-[480px] flex items-center gap-2.5">
        <TimeDisplay
          getCurrentTime={getCurrentTime}
          duration={duration}
          side="current"
        />
        <div className="flex-1">
          <ProgressBar
            hasTimeLabels={false}
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
          />
        </div>
        <TimeDisplay
          getCurrentTime={getCurrentTime}
          duration={duration}
          side="remaining"
        />
      </div>
    </div>
  ),
);
DesktopCenter.displayName = "DesktopCenter";

// ─────────────────────────────────────────────────────────────────────────────
// MINI PLAYER — main component
// ─────────────────────────────────────────────────────────────────────────────

export const MiniPlayer = memo(
  ({
    track,
    currentTime,
    isLoading,
    duration,
    isPlaying,
    onExpand,
    getCurrentTime,
    onSeek,
  }: MiniPlayerProps) => {
    const dispatch = useAppDispatch();
    const labelId = useId();

    // Prefetch lazy FullPlayer chunks on first hover/focus to improve perceived latency
    const prefetchedRef = useRef(false);
    const prefetchFullPlayer = useCallback(() => {
      if (prefetchedRef.current) return;
      prefetchedRef.current = true;
      // Warm up lazy chunks used by FullPlayer
      void import("./LyricEngine");
      void import("./MoodFocusView");
      void import("./TrackDetailPanel");
      void import("./Queuepanel");
    }, []);

    // PERF-7: stable callbacks — dispatch and onExpand are already stable
    const handleStop = useCallback(() => dispatch(stopPlaying()), [dispatch]);

    const handleStopMobileKeydown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dispatch(stopPlaying());
        }
      },
      [dispatch],
    );
    if (isLoading) {
      // Show skeleton when loading — avoids flash of empty player with spinner
      return <MiniPlayerSkeleton onExpand={onExpand} key="skeleton"/>;
    }
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:pointer-events-auto"
        role="region"
        aria-labelledby={labelId}
        aria-label="Music player"
      >
        <span id={labelId} className="sr-only">
          Now playing: {track.title} by {track.artist?.name}
        </span>

        {/* PERF-6: stable animate/initial/exit objects */}
        <motion.div
          initial={PLAYER_INITIAL}
          animate={PLAYER_ANIMATE}
          exit={PLAYER_EXIT}
          transition={PLAYER_TRANSITION}
          className={cn(
            "pointer-events-auto relative overflow-hidden select-none",
            // Mobile: floating glass capsule
            "w-[calc(100%-1.25rem)] mb-3 h-[72px] rounded-2xl",
            "shadow-brand glass-heavy",
            // Desktop: full-width player bar
            "md:w-full md:mb-0 md:h-[76px] md:rounded-none md:player-bar",
          )}
        >
          {/* Desktop: top progress line — imperative DOM, no re-render */}
          <div className="hidden md:block">
            <DesktopProgressLine
              getCurrentTime={getCurrentTime}
              duration={duration}
            />
          </div>

          {/* Mobile: bottom scrubber — imperative DOM for drag */}
          <div className="md:hidden">
            <MobileProgressBar
              getCurrentTime={getCurrentTime}
              duration={duration}
              onSeek={onSeek}
            />
          </div>

          {/* Desktop: ambient glow */}
          <div
            className="hidden dark:md:block absolute left-0 top-0 bottom-0 w-48 pointer-events-none z-0"
            style={{
              background:
                "radial-gradient(ellipse at left center, hsl(var(--primary) / 0.04) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          {/* ── MAIN CONTENT ROW ── */}
          <div className="relative z-10 h-full px-3 md:px-6 pt-2 pb-2 flex items-center gap-2 md:gap-0">
            {/* LEFT — artwork + track info */}
            <TrackInfo
              track={track}
              isPlaying={isPlaying}
              onExpand={onExpand}
              onPrefetch={prefetchFullPlayer}
            />

            {/* CENTER (desktop) — transport + scrubber */}
            <DesktopCenter
              currentTime={currentTime}
              duration={duration}
              getCurrentTime={getCurrentTime}
              onSeek={onSeek}
            />

            {/* CENTER (mobile) — transport controls */}
            <div
              className="flex md:hidden items-center shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />
            </div>

            {/* RIGHT (mobile) — like + stop */}
            <div
              className="md:hidden flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                className={cn(
                  "shrink-0 p-1.5 rounded-full",
                  "text-muted-foreground hover:bg-muted/70",
                  "transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-ring",
                )}
                onClick={handleStop}
                onKeyDown={handleStopMobileKeydown}
                aria-label="Dừng phát nhạc"
              >
                <X className="size-3.5" />
              </motion.button>
            </div>

            {/* RIGHT (desktop) — waveform + volume + expand + stop */}
            <DesktopRight
              isPlaying={isPlaying}
              onExpand={onExpand}
              onStop={handleStop}
              onPrefetch={prefetchFullPlayer}
            />
          </div>
        </motion.div>
      </div>
    );
  },
  // MiniPlayer itself re-renders only when track, isPlaying, or duration changes.
  // currentTime is intentionally excluded — progress is handled imperatively.
  (prev, next) =>
    prev.track._id === next.track._id &&
    prev.isPlaying === next.isPlaying &&
    prev.duration === next.duration &&
    prev.onExpand === next.onExpand &&
    prev.onSeek === next.onSeek &&
    prev.getCurrentTime === next.getCurrentTime,
);

MiniPlayer.displayName = "MiniPlayer";
export default MiniPlayer;
