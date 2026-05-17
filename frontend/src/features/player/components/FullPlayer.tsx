import {
  useState,
  memo,
  useEffect,
  useRef,
  useCallback,
  startTransition,
  lazy,
  Suspense,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  useMemo,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type Variants,
  type TargetAndTransition,
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
  ListMusic,
  Loader2,
  Focus,
} from "lucide-react";
import { Clock } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store/store";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
  toggleAutoplay,
} from "@/features/player/slice/playerSlice";
import { ProgressBar } from "./ProgressBar";
import { ILyricLine, ITrack } from "@/features/track";
import { useLyrics } from "../hooks/useLyrics";
import { MarqueeText } from "./MarqueeText";
import { PlayerBackground } from "@/components/PlayerBackground";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import { EyeViewBadge } from "@/components/ui/LiveViewBadge";
import { useContextSheet } from "@/app/provider/SheetProvider";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { useSleepTimer } from "@/features/player/sleepTimer/SleepTimerProvider";
import { formatMs } from "@/utils/track-helper";
import FullPlayerSkeleton from "./FullPlayerSkeleton";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

// Lazy-loaded views to keep initial bundle small and improve responsiveness
const MoodFocusViewLazy = lazy(() =>
  import("./MoodFocusView").then((m) => ({
    default: m.MoodFocusView ?? m.default,
  })),
);
const LyricsViewLazy = lazy(() =>
  import("./LyricEngine").then((m) => ({ default: m.LyricsView ?? m.default })),
);
const TrackDetailPanelLazy = lazy(() =>
  import("./TrackDetailPanel").then((m) => ({
    default: m.TrackDetailPanel ?? m.default,
  })),
);
const QueuePanelLazy = lazy(() =>
  import("./Queuepanel").then((m) => ({ default: m.QueuePanel ?? m.default })),
);

// ─────────────────────────────────────────────────────────────────────────────
// CSS — PERF-2: inject synchronously, no FOUC
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_STYLE_ID = "__fp3-styles__";
const PLAYER_CSS = `
  @keyframes fp-slide-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .fp-enter { animation: fp-slide-in 360ms cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes fp-orb-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(26px,-14px,0) scale(1.06); } }
  @keyframes fp-orb-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-22px,18px,0) scale(1.05); } }
  .fp-orb-a { animation: fp-orb-a 18s ease-in-out infinite; will-change: transform; }
  .fp-orb-b { animation: fp-orb-b 22s ease-in-out infinite; will-change: transform; }
  @keyframes fp-vinyl-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.018); } }
  .fp-vinyl-playing { animation: fp-vinyl-breathe 3.6s cubic-bezier(0.45,0,0.55,1) infinite; }
  .fp-vinyl-paused  { animation: none; transform: scale(1); transition: transform 0.6s ease-out; }
  @keyframes fp-stagger-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .fp-stagger > *:nth-child(1) { animation: fp-stagger-up 240ms ease both 0ms; }
  .fp-stagger > *:nth-child(2) { animation: fp-stagger-up 240ms ease both 40ms; }
  .fp-stagger > *:nth-child(3) { animation: fp-stagger-up 240ms ease both 80ms; }
  .fp-stagger > *:nth-child(4) { animation: fp-stagger-up 240ms ease both 120ms; }
  .fp-stagger > *:nth-child(5) { animation: fp-stagger-up 240ms ease both 160ms; }
  .custom-scrollbar::-webkit-scrollbar { display: none; }
  .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }

  /* ── FullPlayer theme-aware tokens ── */
  .fp-surface {
    --fp-fg: hsl(var(--foreground));
    --fp-fg-muted: hsl(var(--muted-foreground));
    --fp-fg-subtle: hsl(var(--muted-foreground) / 0.5);
    --fp-fg-faint: hsl(var(--muted-foreground) / 0.3);
    --fp-border: hsl(var(--border) / 0.7);
    --fp-hover-bg: hsl(var(--muted) / 0.15);
    --fp-active-bg: hsl(var(--primary) / 0.12);
  }
  .dark .fp-surface {
    --fp-fg: hsl(0 0% 100%);
    --fp-fg-muted: hsl(0 0% 100% / 0.7);
    --fp-fg-subtle: hsl(0 0% 100% / 0.5);
    --fp-fg-faint: hsl(0 0% 100% / 0.3);
    --fp-border: hsl(0 0% 100% / 0.06);
    --fp-hover-bg: hsl(0 0% 100% / 0.08);
    --fp-active-bg: hsl(var(--primary) / 0.12);
  }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById(PLAYER_STYLE_ID)
) {
  const s = document.createElement("style");
  s.id = PLAYER_STYLE_ID;
  s.textContent = PLAYER_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_1_DELAY = 360;
const PHASE_2_DELAY = 660;
const DRAG_COLLAPSE_Y = 110;
const DRAG_COLLAPSE_VY = 500;
const SWIPE_THRESHOLD = 48;

const VIEWS = ["mood", "lyrics", "artwork", "info"] as const;
type PlayerView = (typeof VIEWS)[number];

const VIEW_LABEL: Record<PlayerView, string> = {
  mood: "Mood",
  artwork: "Đang phát",
  lyrics: "Lời bài hát",
  info: "Thông tin",
};

const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  icon: { type: "spring", stiffness: 360, damping: 28 } as const,
  gentle: { type: "spring", stiffness: 300, damping: 30 } as const,
  queue: { type: "spring", stiffness: 400, damping: 32 } as const,
  swipe: { type: "spring", stiffness: 280, damping: 30, mass: 0.8 } as const,
  sheet: { type: "spring", stiffness: 300, damping: 28, mass: 0.65 } as const,
  pill: { type: "spring", stiffness: 500, damping: 30 } as const,
} as const;

// Stable Framer animate objects — hoisted to avoid allocation per render
const RING_ANIMATE: TargetAndTransition = { opacity: [0.3, 0.75, 0.3] };
const RING_INITIAL = { opacity: 0 } as const;
const RING_EXIT = { opacity: 0 } as const;
const RING_TRANS = {
  duration: 2.4,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

const SWIPE_VARIANTS: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SHEET CONTEXT — any child can open a sheet without prop drilling
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function usePhase() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(
      () => startTransition(() => setPhase(1)),
      PHASE_1_DELAY,
    );
    const t2 = setTimeout(
      () => startTransition(() => setPhase(2)),
      PHASE_2_DELAY,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return phase;
}

function useHorizontalSwipe(onSwipe: (dir: "left" | "right") => void) {
  const ref = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(
    null,
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    ref.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      axis: null,
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = ref.current;
    if (!t || t.axis) return;
    const dx = Math.abs(e.touches[0].clientX - t.x);
    const dy = Math.abs(e.touches[0].clientY - t.y);
    if (dx > 8 || dy > 8) t.axis = dx > dy ? "x" : "y";
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = ref.current;
      ref.current = null;
      if (!t || t.axis !== "x") return;
      const dx = e.changedTouches[0].clientX - t.x;
      if (Math.abs(dx) > SWIPE_THRESHOLD) onSwipe(dx > 0 ? "right" : "left");
    },
    [onSwipe],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}

function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (
        e.shiftKey
          ? document.activeElement === first
          : document.activeElement === last
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

function useViewportHeight() {
  useEffect(() => {
    const setVh = () =>
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`,
      );
    setVh();
    window.addEventListener("resize", setVh, { passive: true });
    return () => window.removeEventListener("resize", setVh);
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED PROGRESS — PERF-3: reads time via callback, no prop re-render
// ─────────────────────────────────────────────────────────────────────────────

interface IsolatedProgressProps {
  getCurrentTime: () => number;
  duration: number;
  onSeek: (t: number) => void;
  hasLabels?: boolean;
}

interface IsolatedProgressProps {
  getCurrentTime: () => number;
  duration: number;
  onSeek: (t: number) => void;
  hasLabels?: boolean;
  isPlaying: boolean;
}

const IsolatedProgress = memo(
  ({
    getCurrentTime,
    duration,
    onSeek,
    hasLabels,
    isPlaying,
  }: IsolatedProgressProps) => {
    const [currentTime, setCurrentTime] = useState(getCurrentTime);

    useEffect(() => {
      // Sync 1 lần khi pause
      if (!isPlaying) {
        setCurrentTime(getCurrentTime());
        return;
      }
      // Poll chỉ khi đang phát
      const id = setInterval(() => setCurrentTime(getCurrentTime()), 250);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, duration]);

    return (
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        hasTimeLabels={hasLabels}
      />
    );
  },
);
IsolatedProgress.displayName = "IsolatedProgress";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL DISK
// ─────────────────────────────────────────────────────────────────────────────

const VinylDisk = memo(
  ({ src, isPlaying }: { src?: string; isPlaying: boolean }) => (
    <div className="relative">
      {/* Outer glow ring — syncs with isPlaying */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -6,
          border: "2px solid hsl(var(--primary) / 0.25)",
          boxShadow: "0 0 24px hsl(var(--brand-glow) / 0.18)",
        }}
        animate={{ opacity: isPlaying ? 1 : 0, scale: isPlaying ? 1 : 0.96 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      <div
        className={cn(
          "relative aspect-square w-full max-w-[200px] lg:max-w-[300px]",
          "rounded-full overflow-hidden border-[5px] border-border shadow-brand",
          isPlaying ? "animate-vinyl-slow" : "pause-animation",
        )}
        style={{ willChange: "transform" }}
        role="img"
        aria-label="Album artwork"
      >
        <ImageWithFallback
          src={src}
          className="size-full object-cover"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, hsl(var(--foreground) / 0.07) 0%, transparent 55%), radial-gradient(circle at 70% 75%, hsl(var(--foreground) / 0.2) 0%, transparent 50%)",
          }}
        />
        {[18, 32, 44].map((pct) => (
          <div
            key={pct}
            className="absolute rounded-full"
            style={{
              inset: `${pct}%`,
            }}
          />
        ))}
      </div>
    </div>
  ),
);
VinylDisk.displayName = "VinylDisk";

// ─────────────────────────────────────────────────────────────────────────────
// PLAY BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface PlayButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  hasQueue: boolean;
  phase: number;
  size: "md" | "lg";
  onToggle: (e: React.MouseEvent) => void;
}

const PlayButton = memo(
  ({
    isPlaying,
    isLoading,
    hasQueue,
    phase,
    size,
    onToggle,
  }: PlayButtonProps) => {
    const dim = size === "lg" ? 76 : 64;
    const iconSize = size === "lg" ? 38 : 32;
    const sharedCls = cn(
      "control-btn relative flex items-center justify-center rounded-full shadow-lg",
      "bg-foreground text-background",
      "shadow-[0_8px_36px_hsl(var(--foreground)/0.18)] disabled:opacity-40 disabled:pointer-events-none",
    );
    const content = isLoading ? (
      <Loader2
        style={{ width: iconSize, height: iconSize }}
        className="animate-spin"
      />
    ) : isPlaying ? (
      <Pause
        style={{ width: iconSize, height: iconSize }}
        className="fill-current"
      />
    ) : (
      <Play
        style={{ width: iconSize, height: iconSize }}
        className="fill-current ml-1"
      />
    );

    if (phase < 1) {
      return (
        <button
          onClick={onToggle}
          disabled={!hasQueue}
          style={{ width: dim, height: dim }}
          className={cn(sharedCls, "active:scale-95 transition-transform")}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {content}
        </button>
      );
    }

    return (
      <motion.button
        onClick={onToggle}
        disabled={!hasQueue}
        style={{ width: dim, height: dim }}
        className={sharedCls}
        whileHover={hasQueue ? { scale: 1.06 } : {}}
        whileTap={hasQueue ? { scale: 0.91 } : {}}
        transition={SP.gentle}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isLoading ? "load" : isPlaying ? "pause" : "play"}
            initial={{ scale: 0.55, opacity: 0, rotate: isPlaying ? 8 : -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.55, opacity: 0 }}
            transition={SP.icon}
            className="flex items-center justify-center"
          >
            {content}
          </motion.span>
        </AnimatePresence>
        <motion.span
          className="absolute inset-0 rounded-full bg-black/10 pointer-events-none"
          initial={{ scale: 0, opacity: 0.6 }}
          whileTap={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
        />
        <AnimatePresence>
          {isPlaying && (
            <motion.span
              className="absolute inset-0 rounded-full ring-2 ring-foreground/20 pointer-events-none"
              initial={RING_INITIAL}
              animate={RING_ANIMATE}
              exit={RING_EXIT}
              transition={RING_TRANS}
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
PlayButton.displayName = "PlayButton";

// ─────────────────────────────────────────────────────────────────────────────
// SIDE BUTTON / SKIP BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface SideButtonProps {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled: boolean;
  label: string;
  delay: number;
  phase: number;
  isLg: boolean;
  children: ReactNode;
}

const SideButton = memo(
  ({
    active,
    onClick,
    disabled,
    label,
    delay,
    phase,
    children,
  }: SideButtonProps) => {
    const baseCls = cn(
      "absolute inset-0 flex items-center justify-center rounded-full transition-colors disabled:opacity-25 disabled:pointer-events-none",
      active
        ? "text-[hsl(var(--primary))]"
        : "text-[var(--fp-fg-subtle,hsl(var(--muted-foreground)/0.5))] hover:text-[var(--fp-fg,hsl(var(--foreground)))]",
    );
    if (phase < 1) return null;
    return (
      <motion.button
        onClick={onClick}
        disabled={disabled}
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SP.icon, delay }}
        whileHover={!disabled ? { scale: 1.14 } : {}}
        whileTap={!disabled ? { scale: 0.84 } : {}}
        className={baseCls}
        aria-label={label}
        aria-pressed={active}
      >
        {children}
        <AnimatePresence>
          {active && (
            <motion.span
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={SP.snappy}
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
SideButton.displayName = "SideButton";

interface SkipBtnProps {
  onClick: (e: React.MouseEvent) => void;
  disabled: boolean;
  label: string;
  phase: number;
  children: ReactNode;
}

const SkipBtn = memo(
  ({ onClick, disabled, label, phase, children }: SkipBtnProps) => {
    const baseCls =
      "text-[var(--fp-fg-muted,hsl(var(--foreground)/0.8))] hover:text-[var(--fp-fg,hsl(var(--foreground)))] p-1 disabled:opacity-25 disabled:pointer-events-none";
    if (phase < 1)
      return (
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(baseCls, "active:scale-90 transition-transform")}
          aria-label={label}
        >
          {children}
        </button>
      );
    return (
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.1 } : {}}
        whileTap={!disabled ? { scale: 0.88 } : {}}
        transition={SP.snappy}
        className={baseCls}
        aria-label={label}
      >
        {children}
      </motion.button>
    );
  },
);
SkipBtn.displayName = "SkipBtn";

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLS ROW
// ─────────────────────────────────────────────────────────────────────────────

interface ControlsRowProps {
  size: "md" | "lg";
  phase: number;
  getCurrentTime?: () => number;
}

const ControlsRow = memo(
  ({ size, phase, getCurrentTime }: ControlsRowProps) => {
    const dispatch = useDispatch();
    // Granular selectors — mỗi selector chỉ re-render khi field đó đổi
    const isPlaying = useSelector((s: RootState) => s.player.isPlaying);
    const isShuffling = useSelector((s: RootState) => s.player.isShuffling);
    const repeatMode = useSelector((s: RootState) => s.player.repeatMode);
    const loadingState = useSelector((s: RootState) => s.player.loadingState);
    const activeQueueLen = useSelector(
      (s: RootState) => s.player.activeQueueIds.length,
    );
    const currentIndex = useSelector((s: RootState) => s.player.currentIndex);

    const queueLen = activeQueueLen;
    const hasQueue = queueLen > 0;
    const isLg = size === "lg";
    const skipCls = isLg ? "size-9" : "size-7";
    const sideDim = isLg ? 40 : 36;
    const isLoading =
      loadingState === "loading" || loadingState === "buffering";
    const canPrev =
      hasQueue && (currentIndex > 0 || repeatMode !== "off" || isShuffling);
    const canNext =
      hasQueue &&
      (currentIndex < queueLen - 1 || repeatMode !== "off" || isShuffling);

    const handlePrev = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canPrev) dispatch(prevTrack(getCurrentTime?.() ?? 0));
      },
      [canPrev, getCurrentTime, dispatch],
    );
    const handleNext = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canNext) dispatch(nextTrack());
      },
      [canNext, dispatch],
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

    const sideSlotStyle: React.CSSProperties = {
      width: sideDim,
      height: sideDim,
    };

    return (
      <div
        className="flex items-center justify-between w-full"
        role="group"
        aria-label="Playback controls"
      >
        <div
          className="relative flex items-center justify-center"
          style={sideSlotStyle}
        >
          <SideButton
            active={isShuffling}
            onClick={handleShuf}
            disabled={!hasQueue}
            label="Shuffle"
            delay={0.04}
            phase={phase}
            isLg={isLg}
          >
            <Shuffle className={isLg ? "size-6" : "size-5"} />
          </SideButton>
        </div>
        <SkipBtn
          onClick={handlePrev}
          disabled={!canPrev}
          label="Previous track"
          phase={phase}
        >
          <SkipBack className={cn(skipCls, "fill-current")} />
        </SkipBtn>
        <PlayButton
          isPlaying={isPlaying}
          isLoading={isLoading}
          hasQueue={hasQueue}
          phase={phase}
          size={size}
          onToggle={handleToggle}
        />
        <SkipBtn
          onClick={handleNext}
          disabled={!canNext}
          label="Next track"
          phase={phase}
        >
          <SkipForward className={cn(skipCls, "fill-current")} />
        </SkipBtn>
        <div
          className="relative flex items-center justify-center"
          style={sideSlotStyle}
        >
          <SideButton
            active={repeatMode !== "off"}
            onClick={handleRep}
            disabled={!hasQueue}
            label="Repeat"
            delay={0.08}
            phase={phase}
            isLg={isLg}
          >
            <AnimatePresence mode="wait" initial={false}>
              {repeatMode === "one" ? (
                <motion.span
                  key="r1"
                  initial={{ scale: 0.7, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0.7, rotate: 20 }}
                  transition={SP.icon}
                >
                  <Repeat1 className={isLg ? "size-6" : "size-5"} />
                </motion.span>
              ) : (
                <motion.span
                  key="rall"
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.7 }}
                  transition={SP.icon}
                >
                  <Repeat className={isLg ? "size-6" : "size-5"} />
                </motion.span>
              )}
            </AnimatePresence>
          </SideButton>
        </div>
      </div>
    );
  },
);
ControlsRow.displayName = "ControlsRow";

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  showQueue: boolean;
  onToggleQueue: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  bitrate: number;
}

const Toolbar = memo(
  ({
    showQueue,
    onToggleQueue,
    focusMode,
    onToggleFocus,
    bitrate = 320,
  }: ToolbarProps) => {
    const dispatch = useDispatch();
    const autoplayEnabled = useSelector(
      (s: RootState) => s.player.autoplayEnabled,
    );
    const { openSleepTimerSheet } = useContextSheet();
    const sleep = useSleepTimer();

    const items = [
      {
        icon: <Focus className="size-5" />,
        label: focusMode ? "Exit focus" : "Focus mode",
        title: focusMode ? "Thoát Focus Mode" : "Bật Focus Mode",
        active: focusMode,
        onClick: onToggleFocus,
        disabled: false,
      },
      {
        icon: (
          <div
            className="px-2 py-0.5 rounded-lg border"
            style={{
              background: "hsl(var(--muted) / 0.3)",
              borderColor: "hsl(var(--border) / 0.4)",
            }}
          >
            <span
              className="text-[10px] font-black tracking-wide"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {bitrate ? `${bitrate}k` : "--k"}
            </span>
          </div>
        ),
        label: "Bitrate",
        title: `Bitrate: ${bitrate ?? 0} kbps`,
        active: false,
        onClick: undefined as (() => void) | undefined,
        disabled: true,
      },
      {
        icon: <Play className="size-5" />,
        label: autoplayEnabled ? "Autoplay On" : "Autoplay Off",
        title: autoplayEnabled
          ? "Tắt tự động phát"
          : "Bật tự động phát khi hết nhạc",
        active: autoplayEnabled,
        onClick: () => dispatch(toggleAutoplay()),
        disabled: false,
      },
      {
        icon: <ListMusic className="size-5" />,
        label: showQueue ? "Hide queue" : "Show queue",
        title: showQueue ? "Ẩn hàng chờ" : "Xem hàng chờ",
        active: showQueue,
        onClick: onToggleQueue,
        disabled: false,
      },
    ];

    return (
      <div
        className="fp-stagger flex items-center justify-between pt-3"
        style={{
          borderTop: "1px solid var(--fp-border, hsl(var(--border) / 0.12))",
        }}
        role="toolbar"
        aria-label="Player tools"
      >
        <div className="flex items-center gap-2 relative z-[100]">
          {/** Sleep timer sheet trigger */}
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              openSleepTimerSheet();
            }}
            title={
              sleep.active
                ? `Hẹn giờ ngủ — ${formatMs(sleep.remainingMs)} còn lại`
                : "Hẹn giờ ngủ"
            }
            className={cn(
              "p-2 rounded-xl transition-colors relative",
              sleep.active
                ? "bg-[var(--fp-active-bg)] text-[hsl(var(--primary))]"
                : "text-[var(--fp-fg-subtle)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)]",
            )}
          >
            <Clock className="size-5" />
            {sleep.active && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] rounded-full px-1 leading-none">
                {Math.max(1, Math.ceil(sleep.remainingMs / 60000))}m
              </span>
            )}
          </button>
        </div>

        {items.map(({ icon, label, title, active, onClick, disabled }) => (
          <motion.button
            key={label}
            whileHover={!disabled ? { scale: 1.12 } : {}}
            whileTap={!disabled ? { scale: 0.86 } : {}}
            transition={SP.snappy}
            onClick={onClick}
            title={title}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              "p-2 rounded-xl transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              active
                ? "text-primary bg-primary/12 shadow-[0_0_12px_hsl(var(--brand-glow)/0.2)]"
                : "text-[var(--fp-fg-faint)] hover:text-[var(--fp-fg-muted)] hover:bg-[var(--fp-hover-bg)]",
            )}
          >
            {icon}
          </motion.button>
        ))}
      </div>
    );
  },
);
Toolbar.displayName = "Toolbar";

// ─────────────────────────────────────────────────────────────────────────────
// VIEW HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface ViewHeaderProps {
  currentView: PlayerView;
  phase: number;
  handleMoreOptions: (e: React.MouseEvent) => void;
  setView: Dispatch<SetStateAction<PlayerView>>;
  setSwipeDir: Dispatch<SetStateAction<number>>;
  onCollapse: () => void;
  track: ITrack;
}

const ViewHeader = memo(
  ({
    handleMoreOptions,

    currentView,
    phase,
    setView,
    setSwipeDir,
    onCollapse,
  }: ViewHeaderProps) => {
    const handleViewChange = useCallback(
      (v: PlayerView) => {
        setSwipeDir(VIEWS.indexOf(v) > VIEWS.indexOf(currentView) ? -1 : 1);
        setView(v);
      },
      [currentView, setView, setSwipeDir],
    );
    const { currentSource } = useSelector(selectPlayer);

    return (
      <header className="flex items-center justify-between px-4 h-16 shrink-0 bg-transparent">
        <button
          onClick={onCollapse}
          className="flex items-center justify-center size-10 rounded-full text-[var(--fp-fg-muted)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)] active:scale-90 transition-all"
          aria-label="Close player"
        >
          <ChevronDown className="size-7" strokeWidth={2} />
        </button>

        <div className="flex flex-col items-center gap-1">
          {phase >= 1 ? (
            <AnimatePresence mode="wait">
              <motion.span
                key={currentView}
                initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-[7px] font-bold uppercase tracking-[0.22em] text-(--fp-fg-muted) truncate"
                aria-live="polite"
              >
                {currentView === "artwork"
                  ? currentSource?.type === "single"
                    ? VIEW_LABEL[currentView]
                    : "PHÁT TỪ"
                  : VIEW_LABEL[currentView]}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--fp-fg-muted) truncate">
              {VIEW_LABEL[currentView]}
            </span>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="max-w-50"
            >
              {currentView === "artwork" &&
                currentSource &&
                currentSource?.type !== "single" && (
                  <MarqueeText
                    text={`${currentSource?.type}: ${currentSource?.title}  `}
                    className="text-[10px] font-bold uppercase tracking-widest text-brand"
                    speed={38}
                    pauseMs={1600}
                  />
                )}
            </motion.div>
          </AnimatePresence>

          <div
            className="flex gap-1.5"
            role="tablist"
            aria-label="Player views"
          >
            {VIEWS.map((v) => (
              <motion.button
                key={v}
                role="tab"
                aria-selected={currentView === v}
                aria-label={VIEW_LABEL[v]}
                onClick={() => handleViewChange(v)}
                animate={{
                  width: currentView === v ? 20 : 6,
                  opacity: currentView === v ? 1 : 0.28,
                }}
                transition={SP.pill}
                className="h-[3px] rounded-full bg-foreground cursor-pointer"
              />
            ))}
          </div>
        </div>

        <button
          className="flex items-center justify-center size-10 rounded-full text-[var(--fp-fg-muted)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)] active:scale-90 transition-all"
          aria-label="More options"
          onClick={handleMoreOptions}
        >
          <MoreHorizontal className="size-6" strokeWidth={2} />
        </button>
      </header>
    );
  },
);
ViewHeader.displayName = "ViewHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SWIPEABLE VIEWS — PERF-4: currentTime only passed to active view
// ─────────────────────────────────────────────────────────────────────────────

interface SwipeableViewsProps {
  lyrics: ILyricLine[] | null;
  loadingLyrics: boolean;
  currentTime: number;
  currentView: PlayerView;
  direction: number;
  showQueue: boolean;
  toggleQueue: () => void;
  track: ITrack;
  isPlaying: boolean;
  phase: number;
  swipeHandlers: ReturnType<typeof useHorizontalSwipe>;
  onSeek: (t: number) => void;
  focusMode: boolean;
}

const SwipeableViews = memo(
  ({
    lyrics,
    showQueue,
    toggleQueue,
    loadingLyrics,
    currentTime,
    currentView,
    direction,
    track,
    isPlaying,
    phase,
    swipeHandlers,
    onSeek,
    focusMode,
  }: SwipeableViewsProps) => (
    <main
      className="relative flex-1 overflow-hidden touch-pan-y bg-transparent"
      {...swipeHandlers}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {!showQueue && currentView === "artwork" && (
          <motion.div
            key="artwork"
            custom={direction}
            variants={SWIPE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SP.swipe}
            className="absolute inset-0 flex items-center justify-center p-8 lg:p-10"
          >
            <AnimatePresence>
              {phase >= 1 && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                  style={{
                    background:
                      "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 72%)",
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
            custom={direction}
            variants={SWIPE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SP.swipe}
            className="absolute inset-0"
          >
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-foreground">
                  Đang tải lời...
                </div>
              }
            >
              <LyricsViewLazy
                isPlaying={isPlaying}
                lyricType={track.lyricType}
                plainLyrics={track.plainLyrics}
                syncedLines={lyrics ?? []}
                karaokeLines={lyrics ?? []}
                currentTime={currentTime}
                onSeek={onSeek}
                loading={loadingLyrics}
                focusRadius={focusMode ? 1 : 0}
              />
            </Suspense>
          </motion.div>
        )}

        {currentView === "mood" && !showQueue && (
          <motion.div
            key="mood"
            custom={direction}
            variants={SWIPE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SP.swipe}
            className="absolute inset-0 bg-transparent"
          >
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-foreground">
                  Đang tải...
                </div>
              }
            >
              <MoodFocusViewLazy
                lyrics={lyrics ?? []}
                loading={loadingLyrics}
                track={track}
                currentTime={currentTime}
                isPlaying={isPlaying}
              />
            </Suspense>
          </motion.div>
        )}

        {currentView === "info" && !showQueue && (
          <motion.div
            key="track-detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={SP.queue}
            className="absolute inset-0 flex flex-col z-50"
          >
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-foreground">
                  Đang tải thông tin...
                </div>
              }
            >
              <TrackDetailPanelLazy track={track} direction={direction} />
            </Suspense>
          </motion.div>
        )}
        {showQueue && (
          /* Queue view — slides in when showQueue is active */
          <motion.div
            key="queue-panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={SP.queue}
            className="absolute inset-0 flex flex-col z-50"
          >
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-foreground">
                  Đang tải hàng chờ...
                </div>
              }
            >
              <QueuePanelLazy showCloseButton onClose={toggleQueue} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  ),
);
SwipeableViews.displayName = "SwipeableViews";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO ROW
// ─────────────────────────────────────────────────────────────────────────────

const TrackInfoRow = memo(
  ({
    track,
    phase,
    size,
    listenCount,
  }: {
    track: ITrack;
    phase: number;
    size?: "sm";
    listenCount: number;
  }) => (
    <div className="flex items-center gap-3">
      {size === "sm" && (
        <div className="size-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border">
          <ImageWithFallback
            src={track.coverImage}
            alt=""
            className="size-full object-cover"
          />
        </div>
      )}
      {size !== "sm" && <EyeViewBadge size="sm" count={listenCount} />}
      <div className={cn("flex-1 min-w-0", size !== "sm" && "text-center")}>
        <MarqueeText
          text={track.title}
          className={cn(
            "flex-1 min-w-0 font-semibold tracking-tight text-brand",
            size === "sm" ? "text-sm" : "text-lg",
          )}
          speed={38}
          pauseMs={1600}
        />
        <ArtistDisplay
          mainArtist={track.artist}
          featuringArtists={track.featuringArtists}
          className="text-[11px] flex items-center justify-center gap-1"
        />
      </div>
      {phase >= 1 ? (
        <TrackLikeButton id={track._id} />
      ) : (
        <div
          className={size === "sm" ? "size-5" : "size-6"}
          aria-hidden="true"
        />
      )}
    </div>
  ),
);
TrackInfoRow.displayName = "TrackInfoRow";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface FullPlayerProps {
  track: ITrack;
  listenCount: number;
  duration: number;
  isLoading: boolean;
  onSeek: (time: number) => void;
  onCollapse: () => void;
  getCurrentTime: () => number;
  isPlaying: boolean;
}

const FullPlayerComponent = ({
  track,
  duration,
  listenCount,
  isLoading,
  onSeek,
  onCollapse,
  getCurrentTime,
  isPlaying,
}: FullPlayerProps) => {
  const [currentView, setCurrentView] = useState<PlayerView>("artwork");
  const [swipeDir, setSwipeDir] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  // Keep-alive: track views đã mount, không bao giờ unmount sau lần đầu
  const [mountedViews, setMountedViews] = useState<Set<PlayerView>>(
    () => new Set<PlayerView>(["artwork"]),
  );
  const trackIds = useMemo(() => (track?._id ? [track._id] : []), [track?._id]);
  useSyncInteractions(trackIds, "like", "track", !!track?._id);
  const phase = usePhase();
  useViewportHeight();
  // LOCAL currentTime: poll via getCurrentTime() so parent time ticks
  // don't force FullPlayer re-renders. Updates at ~4Hz when playing.
  const [currentTime, setCurrentTime] = useState(getCurrentTime);
  useEffect(() => {
    if (!isPlaying) {
      setCurrentTime(getCurrentTime());
      return;
    }
    const id = setInterval(() => setCurrentTime(getCurrentTime()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration]);

  // ── Sheet delegation: use global sheet context (centralized rendering)
  const { openTrackSheet, closeContextSheet } = useContextSheet();

  const handleMoreOptions = useCallback(
    (t: ITrack) => openTrackSheet(t),
    [openTrackSheet],
  );
  const closeSheet = useCallback(() => {
    closeContextSheet();
  }, [closeContextSheet]);

  const queueSheetRef = useRef<HTMLElement>(null);
  // Lazy fetch: chỉ fetch khi user vào tab Lyrics hoặc Mood
  const lyricsEnabled = currentView === "lyrics" || currentView === "mood";
  const rawLyricSrc = track.lyricUrl;
  const LyricSrc = rawLyricSrc;
  const { lyrics, loading } = useLyrics(LyricSrc, lyricsEnabled);

  // Lazy mount: khi chuyển view, thêm vào Set (không bao giờ unmount)
  useEffect(() => {
    setMountedViews((prev) => {
      if (prev.has(currentView)) return prev;
      const next = new Set(prev);
      next.add(currentView);
      return next;
    });
  }, [currentView]);

  useFocusTrap(showQueue, queueSheetRef as React.RefObject<HTMLElement>);

  // PERF: merged Escape handlers — single listener instead of two
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showQueue) {
        setShowQueue(false);
        return;
      }
      closeSheet();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [showQueue, closeSheet]);

  // Prefetch heavy view chunks shortly after mount to reduce latency on first open
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import("./LyricEngine");
      void import("./MoodFocusView");
      void import("./TrackDetailPanel");
      void import("./Queuepanel");
    }, 180);
    return () => clearTimeout(id);
  }, []);

  const dragY = useMotionValue(0);
  const cardScale = useTransform(dragY, [0, 300], [1, 0.94]);
  const rimOpacity = useTransform(dragY, [0, 80, 300], [0, 0, 0.45]);
  const bgOpacity = useTransform(dragY, [0, 300], [1, 0.5]);

  const handleViewSwipe = useCallback((dir: "left" | "right") => {
    setCurrentView((cur) => {
      const i = VIEWS.indexOf(cur);
      if (dir === "right" && i > 0) {
        setSwipeDir(1);
        return VIEWS[i - 1];
      }
      if (dir === "left" && i < VIEWS.length - 1) {
        setSwipeDir(-1);
        return VIEWS[i + 1];
      }
      return cur;
    });
  }, []);

  const swipeHandlers = useHorizontalSwipe(handleViewSwipe);
  const toggleQueue = useCallback(() => setShowQueue((v) => !v), []);
  const toggleFocus = useCallback(() => setFocusMode((v) => !v), []);
  const isArtwork = currentView === "artwork";
  if (isLoading) {
    return <FullPlayerSkeleton key="skeleton" />;
  }
  return (
    <motion.div
      className="fp-enter fp-surface fixed inset-0 z-[60] flex flex-col h-dvh overflow-hidden select-none bg-background isolate"
      style={{ scale: cardScale }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.13 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (
          info.offset.y > DRAG_COLLAPSE_Y ||
          info.velocity.y > DRAG_COLLAPSE_VY
        )
          onCollapse();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${track.title}`}
    >
      <PlayerBackground
        coverImage={track.coverImage}
        dominantColor="primary"
        focusMode={focusMode}
        isPlaying={isPlaying}
      />
      <motion.div
        className="absolute inset-0 bg-overlay pointer-events-none z-0"
        style={{ opacity: rimOpacity }}
        aria-hidden="true"
      />

      <motion.div
        className="mx-auto w-full h-full relative z-10 flex flex-col lg:flex-row lg:items-stretch lg:max-w-4xl xl:max-w-5xl"
        style={{ opacity: bgOpacity }}
      >
        {/* ── LEFT PANEL ── */}
        <div className="flex flex-col flex-1 min-h-0 lg:flex-initial lg:w-[50%] xl:w-[55%]">
          {/* Fix: ViewHeader chỉ render 1 instance duy nhất */}
          {currentView !== "mood" && !showQueue && (
            <ViewHeader
              track={track}
              handleMoreOptions={(e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                handleMoreOptions(track);
              }}
              currentView={currentView}
              phase={phase}
              setView={setCurrentView}
              setSwipeDir={setSwipeDir}
              onCollapse={onCollapse}
            />
          )}

          <SwipeableViews
            showQueue={showQueue}
            toggleQueue={toggleQueue}
            lyrics={lyrics}
            loadingLyrics={loading}
            currentTime={currentTime}
            currentView={currentView}
            direction={swipeDir}
            track={track}
            isPlaying={isPlaying}
            phase={phase}
            swipeHandlers={swipeHandlers}
            onSeek={onSeek}
            focusMode={focusMode}
          />

          {/* ── MOBILE CONTROLS ── */}
          <div className="lg:hidden bg-transparent">
            {isArtwork && !showQueue && (
              <div className="px-6 pb-2 pt-2 space-y-5 shrink-0 bg-transparent">
                <TrackInfoRow
                  track={track}
                  phase={phase}
                  listenCount={listenCount}
                />
                {/* Divider */}
                <div className="divider-glow" aria-hidden="true" />
                <IsolatedProgress
                  getCurrentTime={getCurrentTime}
                  duration={duration}
                  onSeek={onSeek}
                  hasLabels
                  isPlaying={isPlaying}
                />
                <ControlsRow
                  size="lg"
                  phase={phase}
                  getCurrentTime={getCurrentTime}
                />
                {phase >= 1 && (
                  <Toolbar
                    bitrate={track.bitrate}
                    showQueue={showQueue}
                    onToggleQueue={toggleQueue}
                    focusMode={focusMode}
                    onToggleFocus={toggleFocus}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL (desktop) ── */}
        <div
          className="hidden lg:flex flex-col lg:w-[50%] xl:w-[45%] border-l overflow-hidden relative"
          style={{ borderColor: "var(--fp-border)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {/* Controls view */}
            <motion.div
              key="controls"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={SP.queue}
              className="absolute inset-0 shrink-0 px-10 pt-16 pb-6 flex flex-col"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <MarqueeText
                    text={track.title}
                    className="text-3xl font-bold text-brand truncate leading-tight tracking-tight"
                    speed={38}
                    pauseMs={1600}
                  />
                  <ArtistDisplay
                    mainArtist={track.artist}
                    featuringArtists={track.featuringArtists}
                    className="text-[11px] flex gap-1 items-center text-(--fp-fg-muted) mt-1 text-2xl"
                  />
                </div>
                {phase >= 1 ? (
                  <div className="flex justify-center gap-2">
                    <EyeViewBadge size="sm" count={listenCount} />
                    <TrackLikeButton
                      id={track._id}
                      showCount
                      likeCount={track.likeCount}
                    />
                  </div>
                ) : (
                  <div className="size-7" aria-hidden="true" />
                )}
              </div>

              <IsolatedProgress
                getCurrentTime={getCurrentTime}
                duration={duration}
                onSeek={onSeek}
                hasLabels
                isPlaying={isPlaying}
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
                  <Toolbar
                    bitrate={track.bitrate}
                    showQueue={showQueue}
                    onToggleQueue={toggleQueue}
                    focusMode={focusMode}
                    onToggleFocus={toggleFocus}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── GLOBAL PLAYER SHEETS — rendered once, shared via context ── */}
      {/* Mobile: QueueSheet slides up from bottom. Desktop: shown inline in right panel (see above). */}

      {/* Queue sheet — mobile only (lg:hidden via max-w gate inside the sheet) */}
      {/* <div className="lg:hidden">
        <QueueSheet isOpen={showQueue} onClose={toggleQueue} />
      </div> */}

      {/* OptionSheet handled globally by ContextSheetProvider */}
    </motion.div>
  );
};

export const FullPlayer = memo(
  FullPlayerComponent,
  (prev: FullPlayerProps, next: FullPlayerProps) =>
    prev.track._id === next.track._id &&
    prev.listenCount === next.listenCount &&
    prev.duration === next.duration &&
    prev.isPlaying === next.isPlaying &&
    prev.onSeek === next.onSeek &&
    prev.getCurrentTime === next.getCurrentTime &&
    prev.onCollapse === next.onCollapse,
);

export default FullPlayer;
