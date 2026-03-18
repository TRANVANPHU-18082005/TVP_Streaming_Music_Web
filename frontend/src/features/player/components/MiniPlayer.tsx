/**
 * @file MiniPlayer.tsx
 * @description Persistent Footer Music Player — Theme-aware, Sharp Contrast
 * @style Sharp Capsule (Mobile) | Elevated Full Bar (Desktop)
 * @theme Light/Dark adaptive using CSS variables from index.css
 */
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { CircleStop, Maximize2, X } from "lucide-react";
import { useRef, useState, useCallback } from "react";

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

interface Props {
  track: ITrack;
  currentTime: number;
  duration?: number;
  onExpand: () => void;
  getCurrentTime: () => number;
  onSeek: (time: number) => void;
}

// ── Waveform visualizer ───────────────────────────────────────────────────────
const WaveformBars = ({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[2px] h-[14px] w-[18px] shrink-0">
    {[3, 5, 4, 6, 3].map((h, i) => (
      <motion.span
        key={i}
        className="w-[2px] rounded-full bg-primary"
        animate={
          active
            ? { scaleY: [0.3, 1, 0.5, 0.85, 0.3], opacity: 1 }
            : { scaleY: 0.25, opacity: 0.35 }
        }
        transition={
          active
            ? {
                duration: 0.75 + i * 0.1,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: i * 0.11,
              }
            : { duration: 0.3 }
        }
        style={{ height: h * 2, originY: 1 }}
      />
    ))}
  </div>
);

// ── Mobile scrubber — slim bar at bottom of capsule, tall hit zone ───────────
const MobileProgressBar = ({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);

  const getPercent = useCallback((clientX: number) => {
    if (!barRef.current) return 0;
    const { left, width } = barRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - left) / width));
  }, []);

  const displayPercent =
    dragPercent !== null
      ? dragPercent
      : duration > 0
        ? currentTime / duration
        : 0;
  const displayTime =
    dragPercent !== null ? dragPercent * duration : currentTime;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragPercent(getPercent(e.clientX));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragPercent(getPercent(e.clientX));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    onSeek(getPercent(e.clientX) * duration);
    setIsDragging(false);
    setDragPercent(null);
  };

  return (
    // Tall invisible hit zone flush to capsule bottom
    <div
      ref={barRef}
      className="absolute bottom-0 left-0 pl-3 pr-3 pb-1 right-0 h-7 flex items-end cursor-pointer touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tooltip on drag */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="absolute bottom-[8px] pointer-events-none z-20"
            style={{ left: `calc(${displayPercent * 100}%)`, x: "-50%" }}
            initial={{ opacity: 0, y: 3, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
          >
            <div className="px-1.5 py-px rounded-md bg-foreground/90 dark:bg-white/90 text-background dark:text-foreground text-[10px] font-mono font-semibold whitespace-nowrap shadow-md">
              {formatTime(displayTime)}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-l-transparent border-r-transparent border-t-foreground/90 dark:border-t-white/90" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual bar — grows on drag */}
      <div
        className="relative w-full rounded-b-2xl overflow-hidden transition-[height] duration-150"
        style={{ height: isDragging ? 4 : 2.5 }}
      >
        {/* Track */}
        <div className="absolute inset-0 bg-foreground/8 dark:bg-white/8">
          <motion.div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{ width: `${displayPercent * 100}%` }}
            transition={
              isDragging ? { duration: 0 } : { duration: 0.1, ease: "linear" }
            }
          />
        </div>

        {/* Thumb — only while dragging */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 size-[13px] rounded-full bg-primary"
              style={{
                left: `calc(${displayPercent * 100}% - 6.5px)`,
                boxShadow:
                  "0 0 0 4px hsl(var(--primary) / 0.2), 0 2px 6px rgba(0,0,0,0.25)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const MiniPlayer = ({
  track,
  currentTime,
  onExpand,
  getCurrentTime,
  onSeek,
}: Props) => {
  const { duration = 0, isPlaying } = useSelector(selectPlayer);
  const dispatch = useAppDispatch();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:pointer-events-auto">
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className={cn(
          "pointer-events-auto relative overflow-hidden select-none",

          // Mobile: same compact 68px height as original
          "w-[calc(100%-1.25rem)] mb-3 h-[68px] rounded-2xl",

          // Desktop bar
          "md:w-full md:mb-0 md:h-[76px] md:rounded-none md:border-x-0 md:border-b-0",

          // ── Light mode ──
          "bg-white/[0.97] backdrop-blur-xl",
          "border border-black/[0.07]",
          "shadow-[0_-1px_0_rgba(0,0,0,0.05),0_2px_16px_rgba(0,0,0,0.1),0_8px_40px_rgba(0,0,0,0.07)]",

          // ── Dark mode ──
          "dark:bg-[#101010]/[0.98] dark:backdrop-blur-xl",
          "dark:border-white/[0.07]",
          "dark:shadow-[0_-1px_0_rgba(255,255,255,0.04),0_-6px_32px_rgba(0,0,0,0.8)]",

          "md:border-t md:border-black/[0.06] md:dark:border-white/[0.08]",
        )}
      >
        {/* ── Desktop: thin progress line at top ── */}
        <div className="hidden md:block absolute top-0 left-0 right-0 h-[2px] z-10">
          <div className="absolute inset-0 bg-foreground/6 dark:bg-white/5" />
          <motion.div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{
              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </div>

        {/* ── Mobile: slim scrubber at bottom ── */}
        <div className="md:hidden">
          <MobileProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
          />
        </div>

        {/* Ambient glow — dark desktop only */}
        <div
          className="hidden dark:md:block absolute left-0 top-0 bottom-0 w-48 pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(ellipse at left center, rgba(255,255,255,0.02) 0%, transparent 70%)",
          }}
        />

        {/* ── MAIN LAYOUT ── */}
        <div className="relative z-10 h-full px-3 md:px-6 flex items-center gap-2 md:gap-0">
          {/* LEFT: Artwork + Info */}
          <div
            className="flex items-center gap-2.5 flex-1 md:w-[32%] md:flex-none min-w-0 cursor-pointer"
            onClick={onExpand}
          >
            {/* Vinyl */}
            <div className="relative shrink-0">
              <motion.div
                className="absolute -inset-[3px] rounded-full border border-primary/50"
                animate={
                  isPlaying
                    ? { opacity: [0.4, 1, 0.4], scale: [1, 1.05, 1] }
                    : { opacity: 0.15, scale: 1 }
                }
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div
                className={cn(
                  "relative h-10 w-10 rounded-full overflow-hidden",
                  "border border-black/10 dark:border-white/10",
                  "shadow-sm dark:shadow-black/50",
                  isPlaying ? "animate-[spin_10s_linear_infinite]" : "",
                )}
              >
                <ImageWithFallback
                  src={track.coverImage}
                  alt={track.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-1/2 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white dark:bg-[#101010] border border-black/10 dark:border-white/10 z-10" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
              </div>
            </div>

            {/* Track info */}
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <h4 className="text-[13px] font-semibold truncate text-foreground leading-tight tracking-tight">
                  {track.title}
                </h4>
                <div className="md:hidden shrink-0">
                  <WaveformBars active={isPlaying} />
                </div>
              </div>
              <p className="text-[11px] text-foreground/45 dark:text-white/40 truncate font-medium leading-tight">
                {track.artist?.name}
              </p>
            </div>
          </div>

          {/* CENTER: Desktop controls + scrubber */}
          <div
            className="hidden md:flex flex-col items-center justify-center flex-1 gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />
            <div className="w-full max-w-[480px] flex items-center gap-2.5">
              <span className="text-[11px] font-mono text-foreground/30 tabular-nums w-9 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 flex h-4 items-center">
                <ProgressBar
                  hasTimeLabels={false}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={onSeek}
                />
              </div>
              <span className="text-[11px] font-mono text-foreground/30 tabular-nums w-9">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* MOBILE: controls */}
          <div
            className="flex md:hidden items-center shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <PlayerControls variant="mini" getCurrentTime={getCurrentTime} />
          </div>

          {/* MOBILE: expand */}
          <button
            className="md:hidden shrink-0 p-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 active:scale-90 transition-all"
            onClick={() => dispatch(stopPlaying())}
          >
            <X className="size-3.5 text-foreground/45" />
          </button>

          {/* RIGHT: Desktop volume + actions */}
          <div
            className="hidden md:flex items-center justify-end md:w-[32%] gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <WaveformBars active={isPlaying} />
            <VolumeControl className="w-24" />
            <div className="h-5 w-px bg-foreground/10 mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-foreground/35 hover:text-foreground hover:bg-foreground/8 transition-all"
              onClick={onExpand}
              title="Expand"
            >
              <Maximize2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-all"
              onClick={() => dispatch(stopPlaying())}
              title="Stop"
            >
              <CircleStop className="size-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MiniPlayer;
