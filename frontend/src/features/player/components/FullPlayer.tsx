/**
 * @file FullPlayer.tsx
 *
 * ANIMATION POLISH — all issues fixed:
 * ─────────────────────────────────────
 * 1. Phase0→FullControls: cross-fade overlay, identical layout → no jump
 * 2. Vinyl disk: isolated memo, animate prop stable across phases
 * 3. View swipe: x:±60, opacity only exit (no scale jitter)
 * 4. Toolbar stagger: CSS animation-delay per item
 * 5. Play/pause icon: spring stiffness 360 damping 28 + slight rotate
 * 6. Queue items: initial={false} when panel first mounts (no mass-animate)
 * 7. Phase cross-fade: absolute overlay pattern (height preserved)
 * 8. Controls row: unified layout, shuffle/repeat fade in-place
 *
 * PERF (preserved from previous):
 * ─────────────────────────────────
 * • CSS enter animation (not framer) → JS free during slide-up
 * • phase 0/1/2 defer: background orbs only at 640ms
 * • QueuePanel lazy-mount, never unmount
 * • PlaybackControls selector isolated from currentTime
 */

import {
  useState,
  memo,
  useEffect,
  useRef,
  useCallback,
  startTransition,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  ChevronDown,
  MoreHorizontal,
  Shuffle,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Download,
  Clock,
  ListMusic,
  MinusCircle,
  Gem,
  X,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setQueue,
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} from "@/features/player/slice/playerSlice";
import { ProgressBar } from "./ProgressBar";
import { ITrack } from "@/features/track";
import { formatTime } from "@/utils/format";
import { LikeButton } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES — injected once at module level
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  /* ── Enter slide ── */
  @keyframes fp-slide-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  .fp-enter {
    animation: fp-slide-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Background orbs ── */
  @keyframes fp-orb-a {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%      { transform: translate3d(26px,-14px,0) scale(1.06); }
  }
  @keyframes fp-orb-b {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%      { transform: translate3d(-22px,18px,0) scale(1.05); }
  }
  .fp-orb-a { animation: fp-orb-a 18s ease-in-out infinite; will-change: transform; }
  .fp-orb-b { animation: fp-orb-b 22s ease-in-out infinite; will-change: transform; }

  /* ── Staggered toolbar fade ── */
  @keyframes fp-stagger-up {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fp-toolbar-item {
    animation: fp-stagger-up 240ms ease both;
  }
  .fp-toolbar-item:nth-child(1) { animation-delay: 0ms; }
  .fp-toolbar-item:nth-child(2) { animation-delay: 40ms; }
  .fp-toolbar-item:nth-child(3) { animation-delay: 80ms; }
  .fp-toolbar-item:nth-child(4) { animation-delay: 120ms; }
  .fp-toolbar-item:nth-child(5) { animation-delay: 160ms; }

  /* ── Controls cross-fade ── */
  @keyframes fp-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .fp-ctrl-in {
    animation: fp-fade-in 200ms ease both;
  }
`;

let cssInjected = false;
function ensureStyles() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const el = document.createElement("style");
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE HOOK
// ─────────────────────────────────────────────────────────────────────────────
function usePhase() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => startTransition(() => setPhase(1)), 360);
    const t2 = setTimeout(() => startTransition(() => setPhase(2)), 660);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return phase;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_SNAPPY = { type: "spring", stiffness: 440, damping: 28 } as const;
const SPRING_ICON = { type: "spring", stiffness: 360, damping: 28 } as const;
const SPRING_GENTLE = { type: "spring", stiffness: 300, damping: 30 } as const;
const SPRING_QUEUE = { type: "spring", stiffness: 400, damping: 32 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// PLAYING VISUALIZER
// ─────────────────────────────────────────────────────────────────────────────
const PlayingVisualizer = memo(({ paused = false }: { paused?: boolean }) => (
  <div className="flex items-end gap-[2.5px] h-3.5">
    {[0, 1, 2, 3].map((i) => (
      <motion.span
        key={i}
        className="w-[3px] bg-primary rounded-[2px] origin-bottom"
        animate={
          paused ? { scaleY: 0.25 } : { scaleY: [0.35, 1, 0.5, 0.9, 0.3, 1] }
        }
        transition={
          paused
            ? { duration: 0.25, ease: "easeOut" }
            : {
                duration: 0.85 + i * 0.15,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: i * 0.11,
              }
        }
        style={{ height: 14 }}
      />
    ))}
  </div>
));
PlayingVisualizer.displayName = "PlayingVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL DISK — isolated so breathing animate never resets due to parent phase
// ─────────────────────────────────────────────────────────────────────────────
const VinylDisk = memo(
  ({ src, isPlaying }: { src?: string; isPlaying: boolean }) => (
    <motion.div
      // key intentionally omitted — keeps the same instance, breathing is continuous
      animate={isPlaying ? { scale: [1, 1.018, 1] } : { scale: 1 }}
      transition={
        isPlaying
          ? { duration: 3.6, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }
          : { duration: 0.6, ease: "easeOut" }
      }
      className={cn(
        "relative aspect-square w-full max-w-[280px] lg:max-w-[320px] rounded-full overflow-hidden",
        "border-[6px] border-[#1a1a1a]",
        "shadow-[0_28px_80px_rgba(0,0,0,0.92),0_0_0_1px_rgba(255,255,255,0.05)]",
        isPlaying && "animate-spin-slow",
      )}
    >
      <ImageWithFallback src={src} className="size-full object-cover" />
      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/8" />
      {/* Groove rings */}
      <div className="absolute inset-[18%] rounded-full border border-white/[0.04]" />
      <div className="absolute inset-[32%] rounded-full border border-white/[0.04]" />
      {/* Center spindle */}
      <div className="absolute inset-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0c] border border-white/12 shadow-inner z-10" />
      <div className="absolute inset-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 z-20" />
    </motion.div>
  ),
);
VinylDisk.displayName = "VinylDisk";

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED CONTROLS ROW
// Phase 0: bare HTML buttons, no framer, same layout as full
// Phase 1: framer motion, shuffle+repeat fade in-place
//
// SAME layout (justify-between) at all phases → zero layout shift
// ─────────────────────────────────────────────────────────────────────────────
const ControlsRow = memo(
  ({
    size,
    phase,
    getCurrentTime,
  }: {
    size: "md" | "lg";
    phase: number;
    getCurrentTime?: () => number;
  }) => {
    const dispatch = useDispatch();
    const {
      isPlaying,
      isShuffling,
      repeatMode,
      isLoading,
      activeQueue,
      currentIndex,
    } = useSelector(selectPlayer);

    const hasQueue = activeQueue.length > 0;
    const isPrevOff = !hasQueue || (currentIndex === 0 && repeatMode === "off");
    const isNextOff =
      !hasQueue ||
      (currentIndex === activeQueue.length - 1 && repeatMode === "off");

    const handlePrev = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isPrevOff) dispatch(prevTrack(getCurrentTime?.() ?? 0));
      },
      [isPrevOff, getCurrentTime, dispatch],
    );
    const handleNext = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isNextOff) dispatch(nextTrack());
      },
      [isNextOff, dispatch],
    );
    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasQueue) dispatch(setIsPlaying(!isPlaying));
      },
      [hasQueue, isPlaying, dispatch],
    );
    const handleShuf = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasQueue) dispatch(toggleShuffle());
      },
      [hasQueue, dispatch],
    );
    const handleRep = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasQueue) dispatch(toggleRepeat());
      },
      [hasQueue, dispatch],
    );

    const isLg = size === "lg";
    const skipCls = isLg ? "size-9" : "size-7";
    const playCls = isLg ? "size-[76px]" : "size-[64px]";
    const iconCls = isLg ? "size-[38px]" : "size-[32px]";
    const sideSize = isLg ? "size-10" : "size-9";

    return (
      <div className="flex items-center justify-between w-full">
        {/* ── SHUFFLE (invisible placeholder until phase 1) ─────────── */}
        <div
          className={cn("relative flex items-center justify-center", sideSize)}
        >
          <AnimatePresence>
            {phase >= 1 && (
              <motion.button
                key="shuffle"
                onClick={handleShuf}
                disabled={!hasQueue}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ ...SPRING_ICON, delay: 0.04 }}
                whileHover={hasQueue ? { scale: 1.14 } : {}}
                whileTap={hasQueue ? { scale: 0.84 } : {}}
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full transition-colors",
                  "disabled:opacity-25 disabled:pointer-events-none",
                  isShuffling
                    ? "text-primary"
                    : "text-white/50 hover:text-white",
                )}
              >
                <Shuffle className={isLg ? "size-6" : "size-5"} />
                <AnimatePresence>
                  {isShuffling && (
                    <motion.span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={SPRING_SNAPPY}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── PREV ─────────────────────────────────────────────────── */}
        {phase >= 1 ? (
          <motion.button
            onClick={handlePrev}
            disabled={isPrevOff}
            whileHover={!isPrevOff ? { scale: 1.1 } : {}}
            whileTap={!isPrevOff ? { scale: 0.88 } : {}}
            transition={SPRING_SNAPPY}
            className="text-white/80 hover:text-white p-1 disabled:opacity-25 disabled:pointer-events-none"
          >
            <SkipBack className={cn(skipCls, "fill-current")} />
          </motion.button>
        ) : (
          <button
            onClick={handlePrev}
            disabled={isPrevOff}
            className="text-white/80 hover:text-white p-1 active:scale-90 transition-transform disabled:opacity-25 disabled:pointer-events-none"
          >
            <SkipBack className={cn(skipCls, "fill-current")} />
          </button>
        )}

        {/* ── PLAY / PAUSE ─────────────────────────────────────────── */}
        {phase >= 1 ? (
          <motion.button
            onClick={handleToggle}
            disabled={!hasQueue}
            whileHover={hasQueue ? { scale: 1.06 } : {}}
            whileTap={hasQueue ? { scale: 0.91 } : {}}
            transition={SPRING_GENTLE}
            className={cn(
              "relative flex items-center justify-center rounded-full bg-white text-black",
              "shadow-[0_8px_36px_rgba(255,255,255,0.2)] disabled:opacity-40 disabled:pointer-events-none",
              playCls,
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.span
                  key="load"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.16 }}
                >
                  <Loader2 className={cn(iconCls, "animate-spin")} />
                </motion.span>
              ) : isPlaying ? (
                <motion.span
                  key="pause"
                  initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
                  transition={SPRING_ICON}
                >
                  <Pause className={cn(iconCls, "fill-current")} />
                </motion.span>
              ) : (
                <motion.span
                  key="play"
                  initial={{ scale: 0.6, opacity: 0, rotate: 8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  transition={SPRING_ICON}
                >
                  <Play className={cn(iconCls, "fill-current ml-1")} />
                </motion.span>
              )}
            </AnimatePresence>
            {/* Ripple */}
            <motion.span
              className="absolute inset-0 rounded-full bg-black/8"
              initial={{ scale: 0, opacity: 0.5 }}
              whileTap={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            {/* Glow ring */}
            <motion.span
              className="absolute inset-0 rounded-full ring-2 ring-white/20"
              animate={
                isPlaying ? { opacity: [0.4, 0.8, 0.4] } : { opacity: 0 }
              }
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.button>
        ) : (
          /* Phase 0: bare button, same size, same shadow */
          <button
            onClick={handleToggle}
            disabled={!hasQueue}
            className={cn(
              "relative flex items-center justify-center rounded-full bg-white text-black",
              "shadow-[0_8px_36px_rgba(255,255,255,0.2)] active:scale-95 transition-transform",
              "disabled:opacity-40 disabled:pointer-events-none",
              playCls,
            )}
          >
            {isLoading ? (
              <Loader2 className={cn(iconCls, "animate-spin")} />
            ) : isPlaying ? (
              <Pause className={cn(iconCls, "fill-current")} />
            ) : (
              <Play className={cn(iconCls, "fill-current ml-1")} />
            )}
          </button>
        )}

        {/* ── NEXT ─────────────────────────────────────────────────── */}
        {phase >= 1 ? (
          <motion.button
            onClick={handleNext}
            disabled={isNextOff}
            whileHover={!isNextOff ? { scale: 1.1 } : {}}
            whileTap={!isNextOff ? { scale: 0.88 } : {}}
            transition={SPRING_SNAPPY}
            className="text-white/80 hover:text-white p-1 disabled:opacity-25 disabled:pointer-events-none"
          >
            <SkipForward className={cn(skipCls, "fill-current")} />
          </motion.button>
        ) : (
          <button
            onClick={handleNext}
            disabled={isNextOff}
            className="text-white/80 hover:text-white p-1 active:scale-90 transition-transform disabled:opacity-25 disabled:pointer-events-none"
          >
            <SkipForward className={cn(skipCls, "fill-current")} />
          </button>
        )}

        {/* ── REPEAT (invisible placeholder until phase 1) ──────────── */}
        <div
          className={cn("relative flex items-center justify-center", sideSize)}
        >
          <AnimatePresence>
            {phase >= 1 && (
              <motion.button
                key="repeat"
                onClick={handleRep}
                disabled={!hasQueue}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ ...SPRING_ICON, delay: 0.08 }}
                whileHover={hasQueue ? { scale: 1.14 } : {}}
                whileTap={hasQueue ? { scale: 0.84 } : {}}
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full transition-colors",
                  "disabled:opacity-25 disabled:pointer-events-none",
                  repeatMode !== "off"
                    ? "text-primary"
                    : "text-white/50 hover:text-white",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {repeatMode === "one" ? (
                    <motion.span
                      key="r1"
                      initial={{ scale: 0.7, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0.7, rotate: 20 }}
                      transition={SPRING_ICON}
                    >
                      <Repeat1 className={isLg ? "size-6" : "size-5"} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="rall"
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.7 }}
                      transition={SPRING_ICON}
                    >
                      <Repeat className={isLg ? "size-6" : "size-5"} />
                    </motion.span>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {repeatMode !== "off" && (
                    <motion.span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={SPRING_SNAPPY}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  },
);
ControlsRow.displayName = "ControlsRow";

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR — stagger CSS animation (no framer overhead)
// ─────────────────────────────────────────────────────────────────────────────
const ToolbarBtn = memo(
  ({
    children,
    active,
    onClick,
    label,
  }: {
    children: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    label?: string;
  }) => (
    <motion.button
      whileHover={{ scale: 1.14 }}
      whileTap={{ scale: 0.86 }}
      transition={SPRING_SNAPPY}
      onClick={onClick}
      title={label}
      className={cn(
        "p-2 rounded-xl transition-colors",
        active
          ? "text-primary bg-primary/10"
          : "text-white/40 hover:text-white/70 hover:bg-white/6",
      )}
    >
      {children}
    </motion.button>
  ),
);
ToolbarBtn.displayName = "ToolbarBtn";

const Toolbar = memo(
  ({
    showQueue,
    onToggleQueue,
  }: {
    showQueue: boolean;
    onToggleQueue: () => void;
  }) => (
    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
      <div className="fp-toolbar-item">
        <ToolbarBtn label="Sleep timer">
          <Clock className="size-5" />
        </ToolbarBtn>
      </div>
      <div className="fp-toolbar-item">
        <ToolbarBtn label="Quality">
          <Gem className="size-5" />
        </ToolbarBtn>
      </div>
      <div className="fp-toolbar-item">
        <div className="px-3 py-1 bg-white/8 rounded-lg border border-white/10">
          <span className="text-[10px] font-black text-white/70 tracking-wide">
            320 Kbps
          </span>
        </div>
      </div>
      <div className="fp-toolbar-item">
        <ToolbarBtn label="Download">
          <Download className="size-5" />
        </ToolbarBtn>
      </div>
      <div className="fp-toolbar-item">
        <ToolbarBtn label="Queue" active={showQueue} onClick={onToggleQueue}>
          <ListMusic className="size-5" />
        </ToolbarBtn>
      </div>
    </div>
  ),
);
Toolbar.displayName = "Toolbar";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ITEM — initial={false} on first mount to avoid mass-animate
// ─────────────────────────────────────────────────────────────────────────────
const QueueItem = memo(
  ({
    track,
    index,
    isCurrent,
    isPlaying,
    onPlay,
    initialAnim,
  }: {
    track: ITrack;
    index: number;
    isCurrent: boolean;
    isPlaying: boolean;
    onPlay: () => void;
    initialAnim?: boolean;
  }) => (
    <motion.div
      layout="position"
      initial={initialAnim ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, transition: { duration: 0.12 } }}
      transition={SPRING_QUEUE}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors",
        isCurrent ? "bg-primary/10" : "hover:bg-white/5",
      )}
      onClick={onPlay}
      data-active={isCurrent}
    >
      {isCurrent && (
        <motion.div
          layoutId="queue-accent"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full"
          transition={SPRING_QUEUE}
        />
      )}
      <div className="w-7 flex justify-center items-center shrink-0">
        {isCurrent ? (
          <PlayingVisualizer paused={!isPlaying} />
        ) : (
          <div className="relative w-full flex justify-center">
            <span className="text-xs font-mono text-white/30 group-hover:invisible">
              {index + 1}
            </span>
            <div className="absolute inset-0 hidden group-hover:flex justify-center items-center">
              <Play className="size-3.5 fill-current text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="relative size-9 shrink-0 rounded-md overflow-hidden bg-white/10">
        <ImageWithFallback
          src={track.coverImage}
          alt={track.title}
          className={cn(
            "size-full object-cover transition-all duration-300",
            isCurrent
              ? "opacity-100 scale-105"
              : "opacity-60 group-hover:opacity-90 group-hover:scale-105",
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium truncate leading-tight transition-colors",
            isCurrent ? "text-primary" : "text-white/80 group-hover:text-white",
          )}
        >
          {track.title}
        </p>
        <p className="text-[11px] text-white/35 truncate leading-tight">
          {track.artist?.name}
        </p>
      </div>
      <span className="text-[10px] text-white/25 font-mono shrink-0 group-hover:opacity-0 transition-opacity">
        {formatTime(track.duration || 0)}
      </span>
      <div className="hidden group-hover:flex items-center text-white/25 cursor-grab -mr-1">
        <GripVertical className="size-3.5" />
      </div>
    </motion.div>
  ),
);
QueueItem.displayName = "QueueItem";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PANEL
// ─────────────────────────────────────────────────────────────────────────────
const QueuePanel = memo(
  ({
    onClose,
    showCloseButton,
  }: {
    onClose?: () => void;
    showCloseButton?: boolean;
  }) => {
    const dispatch = useDispatch();
    const { activeQueue, currentTrack, isPlaying } = useSelector(selectPlayer);
    const scrollRef = useRef<HTMLDivElement>(null);
    const firstMount = useRef(true);

    // After first render, subsequent item changes should animate
    useEffect(() => {
      firstMount.current = false;
    }, []);

    const currentIndex = activeQueue.findIndex(
      (t) => t._id === currentTrack?._id,
    );
    const upNext =
      currentIndex >= 0 ? activeQueue.slice(currentIndex + 1) : activeQueue;
    const history = currentIndex > 0 ? activeQueue.slice(0, currentIndex) : [];
    const hasQueue = activeQueue.length > 0;

    useEffect(() => {
      if (!scrollRef.current || !currentTrack) return;
      scrollRef.current
        .querySelector('[data-active="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [currentTrack?._id]);

    const handleClick = useCallback(
      (index: number, trackId: string) => {
        if (currentTrack?._id === trackId) dispatch(setIsPlaying(!isPlaying));
        else dispatch(setQueue({ tracks: activeQueue, startIndex: index }));
      },
      [activeQueue, currentTrack, isPlaying, dispatch],
    );

    const shouldAnim = !firstMount.current;

    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/6">
          <div className="flex items-center gap-2">
            <ListMusic className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">
              Queue
            </span>
            {hasQueue && (
              <motion.span
                key={activeQueue.length}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING_SNAPPY}
                className="text-[10px] text-white/30 bg-white/6 border border-white/8 px-1.5 py-0.5 rounded-full font-mono"
              >
                {activeQueue.length}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasQueue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] uppercase tracking-widest font-semibold text-white/25 hover:text-white/50 hover:bg-white/5 rounded-full px-2.5 gap-1"
              >
                <X className="size-2.5" />
                Clear
              </Button>
            )}
            {showCloseButton && onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 text-white/40 hover:text-white"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {!hasQueue ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <div className="size-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <ListMusic className="size-5 text-white/20" />
              </div>
              <p className="text-sm font-medium text-white/30">
                Queue is empty
              </p>
              <p className="text-xs text-white/20">Add songs to get started</p>
            </div>
          ) : (
            <div className="p-2">
              {currentTrack && (
                <>
                  <div className="px-3 pt-1 pb-1.5">
                    <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-white/40">
                      Now Playing
                    </span>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {activeQueue
                      .filter((t) => t._id === currentTrack._id)
                      .map((t) => (
                        <QueueItem
                          key={t._id}
                          track={t}
                          index={currentIndex}
                          isCurrent
                          isPlaying={isPlaying}
                          onPlay={() => handleClick(currentIndex, t._id)}
                          initialAnim={shouldAnim}
                        />
                      ))}
                  </AnimatePresence>
                </>
              )}
              {upNext.length > 0 && (
                <>
                  <div className="px-3 pt-3 pb-1.5">
                    <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-white/40">
                      Next Up
                    </span>
                  </div>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {upNext.map((t, i) => {
                      const ri = currentIndex + 1 + i;
                      return (
                        <QueueItem
                          key={`${t._id}-${ri}`}
                          track={t}
                          index={ri}
                          isCurrent={false}
                          isPlaying={isPlaying}
                          onPlay={() => handleClick(ri, t._id)}
                          initialAnim={shouldAnim}
                        />
                      );
                    })}
                  </AnimatePresence>
                </>
              )}
              {history.length > 0 && (
                <>
                  <div className="px-3 pt-3 pb-1.5">
                    <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-white/20">
                      History
                    </span>
                  </div>
                  <div className="opacity-40">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {history.map((t, i) => (
                        <QueueItem
                          key={`${t._id}-h-${i}`}
                          track={t}
                          index={i}
                          isCurrent={false}
                          isPlaying={false}
                          onPlay={() => handleClick(i, t._id)}
                          initialAnim={shouldAnim}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </>
              )}
              <div className="h-4" />
            </div>
          )}
        </div>
      </div>
    );
  },
);
QueuePanel.displayName = "QueuePanel";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  track: ITrack;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onCollapse: () => void;
  getCurrentTime: () => number;
}

type PlayerView = "lyrics" | "artwork" | "info";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const FullPlayer = ({
  track,
  currentTime,
  duration,
  onSeek,
  onCollapse,
  getCurrentTime,
}: Props) => {
  ensureStyles();
  const { isPlaying } = useSelector(selectPlayer);
  const [currentView, setCurrentView] = useState<PlayerView>("artwork");
  const [showQueue, setShowQueue] = useState(false);
  const [queueEverOpened, setQueueEverOpened] = useState(false);
  console.log(track);
  const phase = usePhase();

  useEffect(() => {
    if (showQueue && !queueEverOpened) setQueueEverOpened(true);
  }, [showQueue, queueEverOpened]);

  // ── Drag to collapse ──────────────────────────────────────────────────────
  const dragY = useMotionValue(0);
  const cardScale = useTransform(dragY, [0, 300], [1, 0.94]);
  const rimOpacity = useTransform(dragY, [0, 80, 300], [0, 0, 0.45]);
  const bgOpacity = useTransform(dragY, [0, 300], [1, 0.5]);

  // ── Native horizontal swipe ───────────────────────────────────────────────
  const touchRef = useRef<{
    x: number;
    y: number;
    axis: "x" | "y" | null;
  } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      axis: null,
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touchRef.current;
    if (!t || t.axis) return;
    const dx = Math.abs(e.touches[0].clientX - t.x);
    const dy = Math.abs(e.touches[0].clientY - t.y);
    if (dx > 8 || dy > 8) t.axis = dx > dy ? "x" : "y";
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const t = touchRef.current;
    touchRef.current = null;
    if (!t || t.axis !== "x") return;
    const dx = e.changedTouches[0].clientX - t.x;
    if (Math.abs(dx) > 48) {
      const views: PlayerView[] = ["lyrics", "artwork", "info"];
      setCurrentView((cur) => {
        const i = views.indexOf(cur);
        if (dx > 0 && i > 0) return views[i - 1];
        if (dx < 0 && i < 2) return views[i + 1];
        return cur;
      });
    }
  }, []);

  const toggleQueue = useCallback(() => setShowQueue((v) => !v), []);

  const isArtwork = currentView === "artwork";
  const viewLabel: Record<PlayerView, string> = {
    artwork: "Đang phát",
    lyrics: "Lời bài hát",
    info: "Thông tin",
  };

  // Swipe direction for enter/exit x
  const viewOrder: PlayerView[] = ["lyrics", "artwork", "info"];
  const viewIdx = viewOrder.indexOf(currentView);

  return (
    <motion.div
      className="fp-enter fixed inset-0 z-60 flex flex-col h-dvh overflow-hidden select-none bg-[#0c0c0c]"
      style={{ scale: cardScale }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.13 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 500) onCollapse();
      }}
    >
      {/* ── BACKGROUND (phase 2) ─────────────────────────────────── */}
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 -z-10 pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div
            className="fp-orb-a absolute rounded-full bg-blue-900/[0.09] blur-[110px]"
            style={{ top: "-20%", left: "-20%", width: "80%", height: "80%" }}
          />
          <div
            className="fp-orb-b absolute rounded-full bg-violet-900/[0.09] blur-[110px]"
            style={{
              bottom: "-20%",
              right: "-20%",
              width: "80%",
              height: "80%",
            }}
          />
        </motion.div>
      )}

      {/* Drag overlay */}
      <motion.div
        className="absolute inset-0 bg-black pointer-events-none z-0"
        style={{ opacity: rimOpacity }}
      />

      {/* ── MAIN LAYOUT ──────────────────────────────────────────── */}
      <motion.div
        className="mx-auto w-full h-full relative z-10 flex flex-col lg:flex-row lg:items-stretch lg:max-w-4xl xl:max-w-5xl"
        style={{ opacity: bgOpacity }}
      >
        {/* ══ LEFT / MAIN PANEL ════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-h-0 lg:flex-initial lg:w-[50%] xl:w-[55%]">
          {/* HEADER */}
          <header className="flex items-center justify-between px-4 h-16 shrink-0">
            <button
              onClick={onCollapse}
              className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/8 active:scale-90 transition-all"
            >
              <ChevronDown className="size-7" />
            </button>

            <div className="flex flex-col items-center gap-2">
              {phase >= 1 ? (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentView}
                    initial={{ opacity: 0, y: -5, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: 5, filter: "blur(4px)" }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30"
                  >
                    {viewLabel[currentView]}
                  </motion.span>
                </AnimatePresence>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                  {viewLabel[currentView]}
                </span>
              )}

              {/* Pill indicators */}
              <div className="flex gap-1.5">
                {(["lyrics", "artwork", "info"] as PlayerView[]).map((v, i) => (
                  <motion.button
                    key={v}
                    onClick={() => setCurrentView(v)}
                    animate={{
                      width: currentView === v ? 20 : 6,
                      opacity: currentView === v ? 1 : 0.3,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="h-1 rounded-full bg-white"
                  />
                ))}
              </div>
            </div>

            <button className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/8 active:scale-90 transition-all">
              <MoreHorizontal className="size-6" />
            </button>
          </header>

          {/* SWIPEABLE CONTENT */}
          <main
            className="relative flex-1 overflow-hidden touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false} custom={viewIdx}>
              {currentView === "artwork" && (
                <motion.div
                  key="artwork"
                  custom={viewIdx}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{
                    type: "spring",
                    damping: 30,
                    stiffness: 280,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 flex items-center justify-center p-8 lg:p-10"
                >
                  {/* Glow — phase 1+ */}
                  <AnimatePresence>
                    {phase >= 1 && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        style={{
                          background:
                            "radial-gradient(ellipse 65% 65% at 50% 50%, rgba(124,58,237,0.09) 0%, transparent 70%)",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  <VinylDisk src={track.coverImage} isPlaying={isPlaying} />
                </motion.div>
              )}

              {currentView === "lyrics" && (
                <motion.div
                  key="lyrics"
                  initial={{ opacity: 0, x: -60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{
                    type: "spring",
                    damping: 30,
                    stiffness: 280,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 flex flex-col justify-center px-8 space-y-5 overflow-y-auto"
                >
                  {[
                    { text: "Thôi nói ra làm gì", cls: "text-white" },
                    { text: "Lại càng thêm đau", cls: "text-white/50" },
                    {
                      text: "Nếu quay thời gian đến lúc đầu...",
                      cls: "text-white/35",
                    },
                    { text: "Mọi thứ có còn như xưa", cls: "text-white/20" },
                  ].map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: 24, filter: "blur(6px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      transition={{
                        delay: i * 0.07,
                        type: "spring",
                        damping: 24,
                        stiffness: 260,
                      }}
                      className={cn(
                        "text-2xl font-bold leading-snug",
                        line.cls,
                      )}
                    >
                      {line.text}
                    </motion.p>
                  ))}
                </motion.div>
              )}

              {currentView === "info" && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{
                    type: "spring",
                    damping: 30,
                    stiffness: 280,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 flex flex-col justify-center p-6"
                >
                  <motion.div
                    className="bg-white/[0.04] rounded-3xl p-6 backdrop-blur-md border border-white/[0.08]"
                    initial={{ scale: 0.97, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.06,
                      type: "spring",
                      damping: 26,
                      stiffness: 300,
                    }}
                  >
                    <h3 className="text-base font-bold mb-5 text-white/80 tracking-tight">
                      Thông tin bài hát
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: "Album", value: "Single" },
                        { label: "Nhạc sĩ", value: track.artist?.name },
                        { label: "Thể loại", value: "Pop" },
                        { label: "Năm phát hành", value: "2024" },
                      ].map((row, i) => (
                        <motion.div
                          key={row.label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.08 + i * 0.05,
                            type: "spring",
                            damping: 24,
                          }}
                          className="flex justify-between items-center"
                        >
                          <span className="text-sm text-white/40">
                            {row.label}
                          </span>
                          <span className="text-sm text-white/80 font-medium">
                            {row.value}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* ── MOBILE CONTROLS ───────────────────────────────────── */}
          <div className="lg:hidden">
            {isArtwork ? (
              <div className="px-6 pb-5 space-y-5 shrink-0">
                {/* Track info row */}
                <div className="flex items-center gap-3">
                  <button className="text-white/25 hover:text-white/50 transition-colors p-1">
                    <MinusCircle className="size-5" />
                  </button>
                  <div className="flex-1 text-center min-w-0">
                    <motion.h2
                      key={track.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={SPRING_GENTLE}
                      className="text-xl font-bold text-white truncate leading-tight"
                    >
                      {track.title}
                    </motion.h2>
                    <motion.p
                      key={track.artist?.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.06, ...SPRING_GENTLE }}
                      className="text-sm text-white/45 mt-0.5"
                    >
                      {track.artist?.name}
                    </motion.p>
                  </div>
                  {phase >= 1 ? (
                    <LikeButton
                      trackId={track._id}
                      isLiked={track.isLiked || false}
                      size="sm"
                    />
                  ) : (
                    <div className="size-6" />
                  )}
                </div>

                <ProgressBar
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={onSeek}
                />

                {/* Single unified controls row — no layout jump */}
                <ControlsRow
                  size="lg"
                  phase={phase}
                  getCurrentTime={getCurrentTime}
                />

                {/* Staggered toolbar */}
                {phase >= 1 && (
                  <Toolbar showQueue={showQueue} onToggleQueue={toggleQueue} />
                )}
              </div>
            ) : (
              /* Non-artwork: mini controls */
              <div className="px-5 pb-5 space-y-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10">
                    <ImageWithFallback
                      src={track.coverImage}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate leading-tight">
                      {track.title}
                    </p>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                      {track.artist?.name}
                    </p>
                  </div>
                  {phase >= 1 ? (
                    <LikeButton
                      trackId={track._id}
                      isLiked={track.isLiked || false}
                      size="md"
                    />
                  ) : (
                    <div className="size-5" />
                  )}
                </div>
                <ProgressBar
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={onSeek}
                />
                <ControlsRow
                  size="md"
                  phase={phase}
                  getCurrentTime={getCurrentTime}
                />
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL (desktop) ════════════════════════════════ */}
        <div className="hidden lg:flex flex-col lg:w-[50%] xl:w-[45%] border-l border-white/[0.05] overflow-hidden">
          <div className="shrink-0 px-10 pt-16 pb-6 flex flex-col">
            {/* Track info */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <motion.h2
                  key={track.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING_GENTLE}
                  className="text-3xl font-bold text-white truncate leading-tight tracking-tight"
                >
                  {track.title}
                </motion.h2>
                <motion.p
                  key={track.artist?.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.07, ...SPRING_GENTLE }}
                  className="text-base text-white/45 mt-1.5"
                >
                  {track.artist?.name}
                </motion.p>
              </div>
              {phase >= 1 ? (
                <LikeButton
                  trackId={track._id}
                  isLiked={track.isLiked || false}
                  size="lg"
                />
              ) : (
                <div className="size-7" />
              )}
            </div>

            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
            />

            <div className="mt-8">
              <ControlsRow
                size="lg"
                phase={phase}
                getCurrentTime={getCurrentTime}
              />
            </div>

            {phase >= 1 && (
              <div className="mt-8">
                <Toolbar showQueue={showQueue} onToggleQueue={toggleQueue} />
              </div>
            )}
          </div>

          {/* Desktop queue — lazy mount + animate */}
          {queueEverOpened && (
            <motion.div
              animate={{ opacity: showQueue ? 1 : 0, y: showQueue ? 0 : -8 }}
              transition={{ type: "spring", damping: 32, stiffness: 360 }}
              className={cn(
                "flex-1 min-h-0 mx-4 mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl overflow-hidden",
                !showQueue && "pointer-events-none",
              )}
            >
              <QueuePanel />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ══ MOBILE QUEUE BOTTOM SHEET ════════════════════════════ */}
      <AnimatePresence>
        {showQueue && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden absolute inset-0 z-[75] bg-black/65 backdrop-blur-sm"
              onClick={() => setShowQueue(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 300,
                mass: 0.65,
              }}
              className="lg:hidden absolute bottom-0 left-0 right-0 z-[80] bg-[#0f0f0f] border-t border-white/[0.08] rounded-t-3xl flex flex-col"
              style={{ maxHeight: "76dvh" }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.22 }}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.y > 72 || info.velocity.y > 400)
                  setShowQueue(false);
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <motion.div
                  className="rounded-full bg-white/14"
                  style={{ width: 36, height: 4 }}
                  whileHover={{
                    width: 48,
                    backgroundColor: "rgba(255,255,255,0.28)",
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <div className="flex-1 min-h-0">
                <QueuePanel
                  onClose={() => setShowQueue(false)}
                  showCloseButton
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FullPlayer;
