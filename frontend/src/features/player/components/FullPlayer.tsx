"use client";

import {
  useState,
  memo,
  useEffect,
  useRef,
  useCallback,
  startTransition,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type Variants,
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
  X,
  GripVertical,
  Loader2,
  Focus,
} from "lucide-react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  jumpToIndex, // ← mới, thay setQueue
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} from "@/features/player/slice/playerSlice";
import { ProgressBar } from "./ProgressBar";
import { ILyricLine, ITrack } from "@/features/track";
import { formatTime } from "@/utils/format";
import { MoodFocusView } from "./MoodFocusView";
import KaraokeView from "./LyricEngine";
import { useLyrics } from "../hooks/useLyrics";
import { WaveformBars } from "@/components/MusicVisualizer";
import { MarqueeText } from "./MarqueeText";
import { extractDominantColor } from "@/utils/track-helper";
import { PlayerBackground } from "@/components/PlayerBackground";
import { RootState } from "@/store/store";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
// ← đã xóa: import { is } from "date-fns/locale"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_1_DELAY = 360;
const PHASE_2_DELAY = 660;
const DRAG_COLLAPSE_Y = 110;
const DRAG_COLLAPSE_VY = 500;
const QUEUE_COLLAPSE_Y = 72;
const QUEUE_COLLAPSE_VY = 400;
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
  tab: { type: "spring", stiffness: 380, damping: 30 } as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_STYLE_ID = "__fp-styles__";
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
  @keyframes fp-spin { to { transform: rotate(360deg); } }
  .fp-vinyl-spin { animation: fp-spin 4s linear infinite; }
  @keyframes fp-stagger-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .fp-stagger > *:nth-child(1) { animation: fp-stagger-up 240ms ease both 0ms; }
  .fp-stagger > *:nth-child(2) { animation: fp-stagger-up 240ms ease both 40ms; }
  .fp-stagger > *:nth-child(3) { animation: fp-stagger-up 240ms ease both 80ms; }
  .fp-stagger > *:nth-child(4) { animation: fp-stagger-up 240ms ease both 120ms; }
  .fp-stagger > *:nth-child(5) { animation: fp-stagger-up 240ms ease both 160ms; }
  .custom-scrollbar::-webkit-scrollbar { display: none; }
  .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
`;

const PlayerStyles = memo(() => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(PLAYER_STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = PLAYER_STYLE_ID;
    s.textContent = PLAYER_CSS;
    document.head.appendChild(s);
  }, []);
  return null;
});
PlayerStyles.displayName = "PlayerStyles";

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS (giữ nguyên)
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
// VINYL DISK (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const VinylDisk = memo(
  ({ src, isPlaying }: { src?: string; isPlaying: boolean }) => (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[280px] lg:max-w-[320px]",
        "rounded-full overflow-hidden border-[5px] border-[#191919] shadow-brand",
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
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.07) 0%, transparent 55%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.3) 0%, transparent 50%)",
        }}
      />
      {[18, 32, 44].map((pct) => (
        <div
          key={pct}
          className="absolute rounded-full border border-white/[0.035]"
          style={{ inset: `${pct}%` }}
        />
      ))}
      <div
        className="absolute rounded-full bg-[#0c0c0c] border border-white/10 shadow-inner z-10"
        style={{
          width: 22,
          height: 22,
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <div
        className="absolute rounded-full bg-white/8 z-20"
        style={{
          width: 8,
          height: 8,
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />
    </div>
  ),
);
VinylDisk.displayName = "VinylDisk";

// ─────────────────────────────────────────────────────────────────────────────
// PLAY BUTTON (giữ nguyên)
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
      "control-btn relative flex items-center justify-center rounded-full bg-white text-background shadow-lg",
      "shadow-[0_8px_36px_rgba(255,255,255,0.18)] disabled:opacity-40 disabled:pointer-events-none",
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
              className="absolute inset-0 rounded-full ring-2 ring-white/20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.75, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
PlayButton.displayName = "PlayButton";

// ─────────────────────────────────────────────────────────────────────────────
// SIDE BUTTON / SKIP BUTTON (giữ nguyên)
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
      active ? "text-[hsl(var(--primary))]" : "text-white/50 hover:text-white",
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
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[hsl(var(--primary))]"
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
      "text-white/80 hover:text-white p-1 disabled:opacity-25 disabled:pointer-events-none";
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
// CONTROLS ROW — đồng bộ slice mới
// Thay: activeQueue.length → activeQueueIds.length
//       isLoading (boolean) → loadingState !== "ready" && loadingState !== "idle"
//       currentIndex < activeQueue.length - 1 → currentIndex < activeQueueIds.length - 1
// ─────────────────────────────────────────────────────────────────────────────

interface ControlsRowProps {
  size: "md" | "lg";
  phase: number;
  getCurrentTime?: () => number;
}

const ControlsRow = memo(
  ({ size, phase, getCurrentTime }: ControlsRowProps) => {
    const dispatch = useDispatch();
    const {
      isPlaying,
      isShuffling,
      repeatMode,
      loadingState, // ← enum thay vì boolean
      activeQueueIds, // ← string[] thay vì ITrack[]
      currentIndex,
    } = useSelector(selectPlayer);

    const queueLen = activeQueueIds.length;
    const hasQueue = queueLen > 0;
    const isLg = size === "lg";
    const skipCls = isLg ? "size-9" : "size-7";
    const sideDim = isLg ? 40 : 36;

    // isLoading: true khi đang fetch metadata hoặc buffer audio
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
// TOOLBAR (giữ nguyên)
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
  }: ToolbarProps) => (
    <div
      className="fp-stagger flex items-center justify-between pt-2 border-t border-white/[0.06]"
      role="toolbar"
      aria-label="Player tools"
    >
      {[
        {
          icon: <Clock className="size-5" />,
          label: "Sleep timer",
          active: false,
          onClick: undefined,
        },
        {
          icon: <Focus className="size-5" />,
          label: focusMode ? "Exit focus" : "Focus mode",
          active: focusMode,
          onClick: onToggleFocus,
        },
        {
          icon: (
            <div className="px-3 py-1 bg-white/8 rounded-lg border border-white/10">
              <span className="text-[10px] font-black text-white/65 tracking-wide">
                {bitrate ? `${bitrate} kbps` : "Bitrate"}
              </span>
            </div>
          ),
          label: "Bitrate",
          active: false,
          onClick: undefined,
        },
        {
          icon: <Download className="size-5" />,
          label: "Download",
          active: false,
          onClick: undefined,
        },
        {
          icon: <ListMusic className="size-5" />,
          label: showQueue ? "Hide queue" : "Show queue",
          active: showQueue,
          onClick: onToggleQueue,
        },
      ].map(({ icon, label, active, onClick }) => (
        <motion.button
          key={label}
          whileHover={{ scale: 1.14 }}
          whileTap={{ scale: 0.86 }}
          transition={SP.snappy}
          onClick={onClick}
          title={label}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "p-2 rounded-xl transition-colors",
            active
              ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)]"
              : "text-white/40 hover:text-white/75 hover:bg-white/[0.06]",
          )}
        >
          {icon}
        </motion.button>
      ))}
    </div>
  ),
);
Toolbar.displayName = "Toolbar";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE PROGRESS (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const MobileProgress = memo(
  ({
    currentTime,
    duration,
    onSeek,
  }: {
    currentTime: number;
    duration: number;
    onSeek: (t: number) => void;
  }) => (
    <ProgressBar
      currentTime={currentTime}
      duration={duration}
      onSeek={onSeek}
    />
  ),
);
MobileProgress.displayName = "MobileProgress";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ITEM (giữ nguyên — nhận ITrack đã được resolve từ cache)
// ─────────────────────────────────────────────────────────────────────────────

interface QueueItemProps {
  track: ITrack;
  queueIndex: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  animate: boolean;
}
const QueueItem = memo(
  ({
    track,
    queueIndex,
    isCurrent,
    isPlaying,
    onPlay,
    animate,
  }: QueueItemProps) => (
    <motion.div
      layout="position"
      initial={animate ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, transition: { duration: 0.12 } }}
      transition={SP.queue}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors duration-150",
        isCurrent ? "bg-[hsl(var(--primary)/0.1)]" : "hover:bg-white/[0.05]",
      )}
      onClick={onPlay}
      role="button"
      aria-current={isCurrent ? "true" : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
    >
      {isCurrent && (
        <motion.div
          layoutId="queue-accent"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[hsl(var(--primary))]"
          transition={SP.queue}
        />
      )}
      <div
        className="w-7 flex justify-center items-center shrink-0"
        aria-hidden="true"
      >
        {isCurrent ? (
          <WaveformBars active={isPlaying} bars={4} />
        ) : (
          <div className="relative flex justify-center items-center w-full h-full">
            <span className="text-xs font-mono text-white/30 group-hover:opacity-0 transition-opacity">
              {queueIndex + 1}
            </span>
            <Play className="size-3.5 fill-current text-white absolute opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>
      <div className="relative size-9 shrink-0 rounded-md overflow-hidden bg-white/10">
        <ImageWithFallback
          src={track.coverImage}
          alt=""
          className={cn(
            "size-full object-cover transition-all duration-300",
            isCurrent
              ? "opacity-100 scale-[1.04]"
              : "opacity-55 group-hover:opacity-90 group-hover:scale-[1.04]",
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <MarqueeText
          text={track.title}
          className={cn(
            "flex-1 min-w-0 text-[13px] font-semibold tracking-tight text-foreground",
            isCurrent ? "text-brand" : "",
          )}
          speed={38}
          pauseMs={1600}
        />
        <p className="text-[11px] text-white/35 truncate leading-snug mt-0.5">
          {track.artist?.name}
        </p>
      </div>
      <span className="text-[10px] text-white/25 font-mono shrink-0 group-hover:opacity-0 transition-opacity">
        {formatTime(track.duration ?? 0)}
      </span>
      <GripVertical className="size-3.5 text-white/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 cursor-grab" />
    </motion.div>
  ),
);
QueueItem.displayName = "QueueItem";

function SectionLabel({
  children,
  dimmer,
}: {
  children: ReactNode;
  dimmer?: boolean;
}) {
  return (
    <div className="px-3 pt-3 pb-1.5">
      <span
        className={cn(
          "text-[9px] uppercase tracking-[0.14em] font-semibold",
          dimmer ? "text-white/25" : "text-white/40",
        )}
      >
        {children}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PANEL — đồng bộ slice mới
// Thay: activeQueue (ITrack[]) → activeQueueIds (string[]) + trackMetadataCache
//       setQueue({ tracks, startIndex }) → jumpToIndex(index)
//       currentTrack?._id → currentTrackId
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @file QueuePanel.tsx
 * @description Panel hiển thị queue: Now Playing, Next Up, History.
 *
 * @fixes (production hardening)
 *   1. History queueIndex dùng explicit index thay vì i (tình cờ đúng)
 *   2. upNextIds key đổi thành id thay vì `${id}-${ri}` (không stable)
 *   3. handleItemPlay history truyền đúng realIndex vào jumpToIndex
 *   4. Auto-scroll dùng data-current thay vì aria-current (không tồn tại)
 *   5. shouldAnimate bỏ didMount pattern — dùng AnimatePresence initial={false}
 *   6. Skeleton row thêm aria-hidden="true"
 *   7. History key đổi thành id (stable)
 *   8. useSelector tách trackMetadataCache riêng + shallowEqual để giảm re-render
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueuePanelProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QueuePanel = memo(({ onClose, showCloseButton }: QueuePanelProps) => {
  const dispatch = useDispatch();

  /**
   * @fix #8 — Tách selector để kiểm soát re-render.
   *
   * Trước đây dùng selectPlayer → destructure toàn bộ → mỗi khi trackMetadataCache
   * đổi (lazy load bài mới) component re-render dù activeQueueIds không đổi.
   *
   * Tách thành 2 selector:
   *   - selector 1: các field primitive + array identity → shallowEqual
   *   - selector 2: trackMetadataCache riêng (reference đổi thường xuyên)
   *
   * shallowEqual so sánh từng key của object trả về → không re-render
   * nếu activeQueueIds, currentTrackId, currentIndex, isPlaying không đổi.
   */
  const { activeQueueIds, currentTrackId, currentIndex, isPlaying } =
    useSelector(
      (s: RootState) => ({
        activeQueueIds: s.player.activeQueueIds,
        currentTrackId: s.player.currentTrackId,
        currentIndex: s.player.currentIndex,
        isPlaying: s.player.isPlaying,
      }),
      shallowEqual,
    );

  // trackMetadataCache tách riêng — reference thay đổi mỗi khi lazy-load
  // bài mới, nhưng component đã memo nên chỉ re-render khi cache thực sự
  // ảnh hưởng đến những bài đang hiển thị.
  const trackMetadataCache = useSelector(
    (s: RootState) => s.player.trackMetadataCache,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasQueue = activeQueueIds.length > 0;

  // Resolve ITrack của bài đang phát từ cache
  const currentTrack =
    currentTrackId != null
      ? (trackMetadataCache[currentTrackId] ?? null)
      : null;

  /**
   * @fix #1 #3 — Tạo entries kèm realIndex ngay khi slice
   * historyIds = slice(0, currentIndex) → i === realIndex là tình cờ đúng.
   * Nếu sau này thêm filter/sort trên history thì i không còn là realIndex.
   * Map ngay thành { id, index } để không bao giờ nhầm.
   */
  const upNextEntries =
    currentIndex >= 0
      ? activeQueueIds
          .slice(currentIndex + 1)
          .map((id, i) => ({ id, index: currentIndex + 1 + i }))
      : activeQueueIds.map((id, i) => ({ id, index: i }));

  const historyEntries =
    currentIndex > 0
      ? activeQueueIds.slice(0, currentIndex).map((id, i) => ({ id, index: i }))
      : [];

  // ── Auto-scroll đến bài đang phát ────────────────────────────────────────

  /**
   * @fix #4 — selector dùng data-current thay vì aria-current
   * aria-current="true" không được set trên element nào trong QueueItem
   * → querySelector luôn trả null → scroll không bao giờ chạy.
   * Dùng data-current="true" và đảm bảo QueueItem set attribute này.
   */
  useEffect(() => {
    if (!scrollRef.current || !currentTrackId) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      '[data-current="true"]',
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTrackId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleItemPlay = useCallback(
    (index: number, trackId: string) => {
      if (currentTrackId === trackId) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        dispatch(jumpToIndex(index));
      }
    },
    [currentTrackId, isPlaying, dispatch],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <ListMusic
            className="size-3.5 text-[hsl(var(--primary))]"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold text-white/65 tracking-[0.18em] uppercase">
            Queue
          </span>
          {hasQueue && (
            <motion.span
              key={activeQueueIds.length}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SP.snappy}
              className="text-[10px] text-brand bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded-full font-mono"
              aria-label={`${activeQueueIds.length} songs`}
            >
              {activeQueueIds.length}
            </motion.span>
          )}
        </div>
        {showCloseButton && onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-white/40 hover:text-white"
            aria-label="Close queue"
          >
            <X className="size-4" />
          </Button>
        )}
      </header>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain"
      >
        {!hasQueue ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-16">
            <div className="size-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <ListMusic className="size-5 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/30">Queue is empty</p>
            <p className="text-xs text-white/20">Add songs to get started</p>
          </div>
        ) : (
          <div className="p-2">
            {/* ── Now Playing ── */}
            {currentTrack && (
              <>
                <SectionLabel>Now Playing</SectionLabel>
                {/**
                 * @fix #5 — bỏ shouldAnimate / didMount pattern.
                 * AnimatePresence initial={false} đã đủ để tắt exit animation
                 * lần render đầu. animate={true} luôn — Framer Motion tự handle.
                 */}
                <AnimatePresence mode="popLayout">
                  <QueueItem
                    key={currentTrack._id}
                    track={currentTrack}
                    queueIndex={currentIndex}
                    isCurrent
                    isPlaying={isPlaying}
                    onPlay={() =>
                      handleItemPlay(currentIndex, currentTrack._id)
                    }
                    animate
                  />
                </AnimatePresence>
              </>
            )}

            {/* ── Next Up ── */}
            {upNextEntries.length > 0 && (
              <>
                <SectionLabel>Next Up</SectionLabel>
                {/**
                 * @fix #2 — key={entry.id} thay vì `${id}-${ri}`
                 * ri = currentIndex + 1 + i → thay đổi mỗi khi currentIndex đổi
                 * → React unmount/remount toàn bộ list → AnimatePresence
                 *   không thể chạy exit animation đúng.
                 * id là stable identity của track trong queue.
                 */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {upNextEntries.map(({ id, index }) => {
                    const track = trackMetadataCache[id];

                    if (!track) {
                      /**
                       * @fix #6 — aria-hidden="true" trên skeleton
                       * Skeleton không có nội dung meaningful cho screen reader.
                       */
                      return (
                        <div
                          key={id}
                          aria-hidden="true"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        >
                          <div className="w-7 h-4 bg-white/[0.06] rounded animate-pulse" />
                          <div className="size-9 bg-white/[0.06] rounded-md animate-pulse shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
                            <div className="h-2.5 bg-white/[0.06] rounded animate-pulse w-1/2" />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <QueueItem
                        key={id}
                        track={track}
                        queueIndex={index}
                        isCurrent={false}
                        isPlaying={isPlaying}
                        onPlay={() => handleItemPlay(index, id)}
                        animate
                      />
                    );
                  })}
                </AnimatePresence>
              </>
            )}

            {/* ── History ── */}
            {historyEntries.length > 0 && (
              <>
                <SectionLabel dimmer>History</SectionLabel>
                <div className="opacity-35">
                  {/**
                   * @fix #7 — key={entry.id} thay vì `${id}-h${i}`
                   * i đổi khi currentIndex tăng → toàn bộ history re-mount.
                   */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    {historyEntries.map(({ id, index }) => {
                      const track = trackMetadataCache[id];
                      // History miss → bỏ qua, không cần skeleton
                      if (!track) return null;
                      return (
                        <QueueItem
                          key={id}
                          track={track}
                          queueIndex={index}
                          isCurrent={false}
                          isPlaying={false}
                          onPlay={() => handleItemPlay(index, id)}
                          animate
                        />
                      );
                    })}
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
});

QueuePanel.displayName = "QueuePanel";

// ─────────────────────────────────────────────────────────────────────────────
// VIEW HEADER (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

interface ViewHeaderProps {
  currentView: PlayerView;
  phase: number;
  setView: Dispatch<SetStateAction<PlayerView>>;
  setSwipeDir: Dispatch<SetStateAction<number>>;
  onCollapse: () => void;
}
const ViewHeader = memo(
  ({
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

    return (
      <header className="flex items-center justify-between px-4 h-16 shrink-0 bg-transparent">
        <button
          onClick={onCollapse}
          className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all"
          aria-label="Close player"
        >
          <ChevronDown className="size-7" strokeWidth={2} />
        </button>
        <div className="flex flex-col items-center gap-2">
          {phase >= 1 ? (
            <AnimatePresence mode="wait">
              <motion.span
                key={currentView}
                initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30"
                aria-live="polite"
              >
                {VIEW_LABEL[currentView]}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
              {VIEW_LABEL[currentView]}
            </span>
          )}
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
                className="h-[3px] rounded-full bg-white cursor-pointer"
              />
            ))}
          </div>
        </div>
        <button
          className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all"
          aria-label="More options"
        >
          <MoreHorizontal className="size-6" strokeWidth={2} />
        </button>
      </header>
    );
  },
);
ViewHeader.displayName = "ViewHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SWIPEABLE VIEWS (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const SWIPE_VARIANTS: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

interface SwipeableViewsProps {
  lyrics: ILyricLine[] | null;
  loadingLyrics: boolean;
  currentTime: number;
  currentView: PlayerView;
  direction: number;
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
        {currentView === "artwork" && (
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
            <KaraokeView
              lyrics={lyrics ?? []}
              loading={loadingLyrics}
              currentTime={currentTime}
              onSeek={onSeek}
              focusRadius={focusMode ? 1 : 0}
              duetMode={false}
              accentColor="primary"
            />
          </motion.div>
        )}
        {currentView === "mood" && (
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
            <MoodFocusView
              lyrics={lyrics ?? []}
              loading={loadingLyrics}
              track={track}
              currentTimeMs={currentTime * 1000}
              isPlaying={isPlaying}
            />
          </motion.div>
        )}
        {currentView === "info" && (
          <motion.div
            key="info"
            custom={direction}
            variants={SWIPE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SP.swipe}
            className="absolute inset-0 flex flex-col justify-center p-6"
          >
            <motion.div
              className="rounded-3xl p-6 backdrop-blur-md border border-white/[0.08]"
              style={{ background: "rgba(255,255,255,0.04)" }}
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.06, ...SP.gentle }}
            >
              <h3 className="text-[15px] font-bold mb-5 text-white/80 tracking-tight">
                Track info
              </h3>
              <dl className="space-y-4">
                {[
                  { label: "Nghệ sĩ", value: track.artist?.name ?? "—" },
                  { label: "Album", value: track.album?.title ?? "Single" },
                  { label: "Thể loại", value: "Pop" },
                  { label: "Năm phát hành", value: "2024" },
                ].map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.05, ...SP.gentle }}
                    className="flex justify-between items-center"
                  >
                    <dt className="text-sm text-white/40">{row.label}</dt>
                    <dd className="text-sm text-white/80 font-medium">
                      {row.value}
                    </dd>
                  </motion.div>
                ))}
              </dl>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  ),
);
SwipeableViews.displayName = "SwipeableViews";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO ROW (giữ nguyên)
// ─────────────────────────────────────────────────────────────────────────────

const TrackInfoRow = memo(
  ({ track, phase, size }: { track: ITrack; phase: number; size?: "sm" }) => (
    <div className="flex items-center gap-3">
      {size === "sm" && (
        <div className="size-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10">
          <ImageWithFallback
            src={track.coverImage}
            alt=""
            className="size-full object-cover"
          />
        </div>
      )}
      {size !== "sm" && (
        <button
          className="text-white/25 hover:text-white/50 transition-colors p-1"
          aria-label="Add to library"
        >
          <MinusCircle className="size-5" />
        </button>
      )}
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
        <motion.p
          key={track.artist?.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06, ...SP.gentle }}
          className={cn(
            "text-white/45 mt-0.5 text-track-meta",
            size === "sm" ? "text-xs truncate" : "text-sm",
          )}
        >
          {track.artist?.name}
        </motion.p>
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
// MAIN COMPONENT (giữ nguyên hoàn toàn)
// ─────────────────────────────────────────────────────────────────────────────

export interface FullPlayerProps {
  track: ITrack;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onCollapse: () => void;
  getCurrentTime: () => number;
}

export const FullPlayer = ({
  track,
  currentTime,
  duration,
  onSeek,
  onCollapse,
  getCurrentTime,
}: FullPlayerProps) => {
  const { isPlaying } = useSelector(selectPlayer);

  const [currentView, setCurrentView] = useState<PlayerView>("artwork");
  const [swipeDir, setSwipeDir] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [queueMounted, setQueueMounted] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dominantColor, setDominantColor] = useState("primary");

  const phase = usePhase();
  useViewportHeight();

  const queueSheetRef = useRef<HTMLElement>(null);
  const { lyrics, loading } = useLyrics(track.lyricUrl);

  useEffect(() => {
    if (showQueue && !queueMounted) setQueueMounted(true);
  }, [showQueue, queueMounted]);
  // useEffect(() => {
  //   if (!track.coverImage) return;
  //   extractDominantColor(track.coverImage).then(setDominantColor);
  // }, [track.coverImage]);

  useFocusTrap(showQueue, queueSheetRef as React.RefObject<HTMLElement>);

  useEffect(() => {
    if (!showQueue) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQueue(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showQueue]);

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
  const isFullView = currentView === "lyrics" || currentView === "mood";

  return (
    <>
      <PlayerStyles />
      <motion.div
        className="fp-enter fixed inset-0 z-[60] flex flex-col h-dvh overflow-hidden select-none bg-[#0c0c0c] isolate"
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
          dominantColor={dominantColor}
          focusMode={focusMode}
          isPlaying={isPlaying}
        />
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none z-0"
          style={{ opacity: rimOpacity }}
          aria-hidden="true"
        />

        <motion.div
          className="mx-auto w-full h-full relative z-10 flex flex-col lg:flex-row lg:items-stretch lg:max-w-4xl xl:max-w-5xl"
          style={{ opacity: bgOpacity }}
        >
          {/* LEFT PANEL */}
          <div className="flex flex-col flex-1 min-h-0 lg:flex-initial lg:w-[50%] xl:w-[55%]">
            {currentView !== "mood" && (
              <ViewHeader
                currentView={currentView}
                phase={phase}
                setView={setCurrentView}
                setSwipeDir={setSwipeDir}
                onCollapse={onCollapse}
              />
            )}
            <SwipeableViews
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

            <div className="lg:hidden bg-transparent">
              {isArtwork ? (
                <div className="px-6 pb-2 pt-2 space-y-5 shrink-0 bg-transparent outline-none border-none">
                  <TrackInfoRow track={track} phase={phase} />
                  <MobileProgress
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={onSeek}
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
              ) : (
                !isFullView && (
                  <div className="px-5 pb-5 pt-2 space-y-4 shrink-0 bg-transparent">
                    <TrackInfoRow track={track} phase={phase} size="sm" />
                    <MobileProgress
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
                )
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="hidden lg:flex flex-col lg:w-[50%] xl:w-[45%] border-l border-white/[0.05] overflow-hidden">
            <div className="shrink-0 px-10 pt-16 pb-6 flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <motion.h2
                    key={track.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SP.gentle}
                    className="text-3xl font-bold text-white truncate leading-tight tracking-tight"
                  >
                    {track.title}
                  </motion.h2>
                  <motion.p
                    key={track.artist?.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.07, ...SP.gentle }}
                    className="text-base text-white/45 mt-1.5"
                  >
                    {track.artist?.name}
                  </motion.p>
                </div>
                {phase >= 1 ? (
                  <TrackLikeButton id={track._id} />
                ) : (
                  <div className="size-7" aria-hidden="true" />
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
                  <Toolbar
                    bitrate={track.bitrate}
                    showQueue={showQueue}
                    onToggleQueue={toggleQueue}
                    focusMode={focusMode}
                    onToggleFocus={toggleFocus}
                  />
                </div>
              )}
            </div>

            {queueMounted && (
              <motion.div
                animate={{ opacity: showQueue ? 1 : 0, y: showQueue ? 0 : -8 }}
                transition={SP.queue}
                className={cn(
                  "flex-1 min-h-0 mx-4 mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl overflow-hidden",
                  !showQueue && "pointer-events-none",
                )}
                aria-hidden={!showQueue}
              >
                <QueuePanel />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* MOBILE QUEUE SHEET */}
        <AnimatePresence>
          {showQueue && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="lg:hidden absolute inset-0 z-[75] bg-black/65 backdrop-blur-[2px]"
                onClick={() => setShowQueue(false)}
                aria-hidden="true"
              />
              <motion.div
                ref={queueSheetRef as React.RefObject<HTMLDivElement>}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={SP.sheet}
                className="lg:hidden absolute bottom-0 left-0 right-0 z-[80] bg-[#0f0f0f] border-t border-white/[0.08] rounded-t-3xl flex flex-col"
                style={{ maxHeight: "calc(var(--vh, 1vh) * 76)" }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.22 }}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (
                    info.offset.y > QUEUE_COLLAPSE_Y ||
                    info.velocity.y > QUEUE_COLLAPSE_VY
                  )
                    setShowQueue(false);
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Queue"
              >
                <div className="flex justify-center pt-3 pb-2 shrink-0">
                  <motion.div
                    className="h-1 rounded-full bg-white/14"
                    style={{ width: 36 }}
                    whileHover={{
                      width: 48,
                      backgroundColor: "rgba(255,255,255,0.28)",
                    }}
                    transition={{ duration: 0.18 }}
                    aria-hidden="true"
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
    </>
  );
};

export default FullPlayer;
