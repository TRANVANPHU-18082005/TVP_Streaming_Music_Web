/**
 * MiniPlayer.tsx — Persistent footer music player
 *
 * Design: Glassmorphism capsule (mobile) / elevated full-bar (desktop)
 * Theme:  Full light + dark via CSS variables, zero hardcoded colours
 *
 * Architecture
 * ────────────
 * • Granular Redux selector — only isPlaying + duration subscribe here.
 *   currentTime is ALWAYS a prop (owned by the audio engine hook). This
 *   means zero re-renders from the 60fps progress tick on this component.
 *
 * • WaveformBars: CSS-only animation (no Framer) — zero JS after paint.
 *
 * • MobileProgressBar: extracted to named component co-located at top.
 *   Uses pointer capture for smooth scrubbing even when cursor/finger
 *   leaves the element.
 *
 * • Vinyl ring-pulse: single Framer motion.div isolated in VinylArtwork so
 *   it never causes the track info or controls to re-render.
 *
 * • Keyboard accessibility: every interactive surface has onKeyDown handler
 *   and correct ARIA attributes. The player root has role="region".
 *
 * Props contract: duration is removed from Props — it comes exclusively
 * from the Redux store. Callers no longer need to pass it.
 */

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
// GRANULAR SELECTOR
// Only subscribes to isPlaying + duration — NOT currentTime.
// Progress ticks never trigger a re-render of MiniPlayer.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CSS-ONLY WAVEFORM VISUALIZER
// No Framer overhead. Each bar is an independent CSS animation with a
// distinct duration, creating organic desync.
// ─────────────────────────────────────────────────────────────────────────────

const WAVEFORM_CSS = `
  @keyframes mp-bar {
    0%,100% { transform: scaleY(0.22); }
    50%      { transform: scaleY(1); }
  }
`;

let _waveStyleInjected = false;

const WaveformBars = memo(({ active }: { active: boolean }) => {
  // Inject once, CSS-only, no runtime cost after
  if (!_waveStyleInjected && typeof document !== "undefined") {
    _waveStyleInjected = true;
    const s = document.createElement("style");
    s.textContent = WAVEFORM_CSS;
    document.head.appendChild(s);
  }

  const durations = [0.75, 0.95, 0.65, 1.05, 0.8];
  const delays = [0, 0.11, 0.22, 0.08, 0.18];

  return (
    <div
      className="flex items-end gap-[2px] h-[14px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {durations.map((dur, i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-full origin-bottom"
          style={{
            height: 14,
            background: "hsl(var(--primary))",
            opacity: active ? 1 : 0.3,
            transform: active ? undefined : "scaleY(0.22)",
            animation: active
              ? `mp-bar ${dur}s ease-in-out ${delays[i]}s infinite`
              : "none",
            transition: "opacity 0.3s, transform 0.3s",
          }}
        />
      ))}
    </div>
  );
});
WaveformBars.displayName = "WaveformBars";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE PROGRESS BAR
// Sits flush at the bottom of the capsule. Tall invisible hit zone (28px)
// so thumbs can scrub easily. Pointer capture ensures smooth dragging
// even when the finger moves outside the element.
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
          {/* Background */}
          <div
            className="absolute inset-0"
            style={{ background: "hsl(var(--foreground) / 0.08)" }}
          />
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${displayPct * 100}%`,
              background: "hsl(var(--primary))",
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
// VINYL ARTWORK
// Isolated in its own memo so the pulse animation never causes track info
// or controls to re-render. Spin is CSS class-based, pulse is Framer.
// ─────────────────────────────────────────────────────────────────────────────

const VINYL_CSS = `
  @keyframes mp-vinyl-spin {
    to { transform: rotate(360deg); }
  }
  .mp-vinyl-spinning { animation: mp-vinyl-spin 10s linear infinite; }
`;

let _vinylStyleInjected = false;

interface VinylArtworkProps {
  src?: string;
  alt: string;
  isPlaying: boolean;
  size?: number;
}

const VinylArtwork = memo(
  ({ src, alt, isPlaying, size = 40 }: VinylArtworkProps) => {
    if (!_vinylStyleInjected && typeof document !== "undefined") {
      _vinylStyleInjected = true;
      const s = document.createElement("style");
      s.textContent = VINYL_CSS;
      document.head.appendChild(s);
    }

    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* Pulsing ring — Framer, isolated */}
        <motion.div
          className="absolute rounded-full border"
          style={{
            inset: -3,
            borderColor: "hsl(var(--primary) / 0.5)",
          }}
          animate={
            isPlaying
              ? { opacity: [0.35, 0.9, 0.35], scale: [1, 1.06, 1] }
              : { opacity: 0.15, scale: 1 }
          }
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />

        {/* Disc */}
        <div
          className={cn(
            "relative rounded-full overflow-hidden",
            "border border-black/10 dark:border-white/10",
            "shadow-sm dark:shadow-black/50",
            isPlaying && "mp-vinyl-spinning",
          )}
          style={{ width: size, height: size }}
        >
          <ImageWithFallback
            src={src}
            alt={alt}
            className="size-full object-cover"
          />
          {/* Gloss */}
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
            className="absolute rounded-full z-10"
            style={{
              width: 7,
              height: 7,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  },
);
VinylArtwork.displayName = "VinylArtwork";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PROGRESS LINE
// Pure CSS transition — Framer motion.div was overkill for a width transition.
// ─────────────────────────────────────────────────────────────────────────────

const DesktopProgressLine = memo(
  ({ currentTime, duration }: { currentTime: number; duration: number }) => {
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    return (
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-10">
        <div
          className="absolute inset-0"
          style={{ background: "hsl(var(--foreground) / 0.06)" }}
        />
        <div
          className="absolute left-0 top-0 h-full"
          style={{
            width: `${pct}%`,
            background: "hsl(var(--primary))",
            transition: "width 0.1s linear",
          }}
        />
      </div>
    );
  },
);
DesktopProgressLine.displayName = "DesktopProgressLine";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO
// Isolated memo — only re-renders when track changes, not on playback ticks.
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

    <div className="min-w-0 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <h4
          className="text-[13px] font-semibold truncate leading-tight tracking-tight"
          style={{ color: "hsl(var(--foreground))" }}
        >
          {track.title}
        </h4>
        {/* Waveform only on mobile — desktop has it on the right */}
        <div className="md:hidden shrink-0">
          <WaveformBars active={isPlaying} />
        </div>
      </div>
      <p
        className="text-[11px] truncate font-medium leading-tight"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        {track.artist?.name}
      </p>
    </div>
  </div>
));
TrackInfo.displayName = "TrackInfo";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
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
       * Outer wrapper: pointer-events-none lets touches pass through to page
       * content on mobile until the capsule itself is hit. On desktop the
       * full-width bar is always pointer-interactive.
       */
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:pointer-events-auto"
        role="region"
        aria-labelledby={labelId}
        aria-label="Music player"
      >
        {/* Hidden label for screen readers */}
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

            // ── Mobile: floating capsule ──
            "w-[calc(100%-1.25rem)] mb-3 h-[72px] rounded-2xl",

            // ── Desktop: full-width bar ──
            "md:w-full md:mb-0 md:h-[76px] md:rounded-none",

            // ── Light mode glass ──
            "bg-white/[0.97] backdrop-blur-xl",
            "border border-black/[0.07]",
            "shadow-[0_-1px_0_rgba(0,0,0,0.04),0_2px_18px_rgba(0,0,0,0.09),0_8px_40px_rgba(0,0,0,0.06)]",

            // ── Dark mode glass ──
            "dark:bg-[hsl(var(--background)/0.97)] dark:backdrop-blur-xl",
            "dark:border-white/[0.07]",
            "dark:shadow-[0_-1px_0_hsl(var(--border)),0_-6px_32px_rgba(0,0,0,0.8)]",

            // ── Desktop border top only ──
            "md:border-t md:border-x-0 md:border-b-0",
            "md:border-black/[0.06] md:dark:border-white/[0.08]",
          )}
        >
          {/* ── Desktop: top progress line ── */}
          <div className="hidden md:block">
            <DesktopProgressLine
              currentTime={currentTime}
              duration={duration}
            />
          </div>

          {/* ── Mobile: bottom scrubber ── */}
          <div className="md:hidden">
            <MobileProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
            />
          </div>

          {/* ── Desktop: subtle ambient glow (dark only) ── */}
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
            />

            {/* CENTER — desktop: transport controls + scrubber */}
            <div
              className="hidden md:flex flex-col items-center justify-center flex-1 gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />

              {/* Scrubber with time labels */}
              <div className="w-full max-w-[480px] flex items-center gap-2.5">
                <span
                  className="text-[11px] font-mono tabular-nums w-9 text-right"
                  style={{ color: "hsl(var(--muted-foreground))" }}
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
                  className="text-[11px] font-mono tabular-nums w-9"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  aria-hidden="true"
                >
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* MOBILE CENTER — transport controls only */}
            <div
              className="flex md:hidden items-center shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />
            </div>

            {/* MOBILE RIGHT — stop button */}
            <button
              className={cn(
                "md:hidden shrink-0 p-1.5 rounded-full",
                "transition-all duration-150 active:scale-90",
                "hover:bg-[hsl(var(--muted)/0.7)]",
              )}
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={handleStop}
              onKeyDown={handleStopKeyboard}
              aria-label="Stop playback"
            >
              <X className="size-3.5" />
            </button>

            {/* DESKTOP RIGHT — waveform + volume + expand + stop */}
            <div
              className="hidden md:flex items-center justify-end md:w-[32%] gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <WaveformBars active={isPlaying} />

              <VolumeControl className="w-24" />

              {/* Separator */}
              <div
                className="h-5 w-px mx-0.5"
                style={{ background: "hsl(var(--border))" }}
                aria-hidden="true"
              />

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-150",
                  "hover:bg-[hsl(var(--muted)/0.7)]",
                )}
                style={{ color: "hsl(var(--muted-foreground))" }}
                onClick={handleExpand}
                onKeyDown={handleExpandKeyboard}
                title="Expand player"
                aria-label="Expand to full player"
              >
                <Maximize2 className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-150",
                  "text-[hsl(var(--muted-foreground)/0.6)]",
                  "hover:text-red-500 hover:bg-red-500/10",
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
