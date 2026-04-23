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
  Loader2,
  Focus,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
  PlayerSheetContext,
} from "@/features/player/slice/playerSlice";
import { ProgressBar } from "./ProgressBar";
import { ILyricLine, ITrack } from "@/features/track";
import { MoodFocusView } from "./MoodFocusView";
import { LyricsView } from "./LyricEngine";
import { useLyrics } from "../hooks/useLyrics";
import { MarqueeText } from "./MarqueeText";
import { PlayerBackground } from "@/components/PlayerBackground";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import { EyeViewBadge } from "@/components/ui/LiveViewBadge";
import QueuePanel from "./Queuepanel";
import { TrackDetailPanel } from "./TrackDetailPanel";
import { AddToPlaylistSheet, OptionSheet } from "./Playersheets";

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
} as const;

// Stable Framer animate objects — hoisted to avoid allocation per render
const RING_ANIMATE = { opacity: [0.3, 0.75, 0.3] } as const;
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

type SheetType = "playlist" | "options" | null;

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

const IsolatedProgress = memo(
  ({ getCurrentTime, duration, onSeek, hasLabels }: IsolatedProgressProps) => {
    // currentTime as state — updated by interval, not from parent
    const [currentTime, setCurrentTime] = useState(getCurrentTime);

    useEffect(() => {
      const id = setInterval(() => setCurrentTime(getCurrentTime()), 250);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration]);

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
    <div
      className={cn(
        "relative aspect-square w-full max-w-[250px] lg:max-w-[320px]",
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
          width: 17,
          height: 17,
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <div
        className="absolute rounded-full bg-white/8 z-20"
        style={{
          width: 7,
          height: 7,
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
    const {
      isPlaying,
      isShuffling,
      repeatMode,
      loadingState,
      activeQueueIds,
      currentIndex,
    } = useSelector(selectPlayer);

    const queueLen = activeQueueIds.length;
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
// VIEW HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface ViewHeaderProps {
  currentView: PlayerView;
  phase: number;
  handleMoreOptions: (track: ITrack) => void;
  setView: Dispatch<SetStateAction<PlayerView>>;
  setSwipeDir: Dispatch<SetStateAction<number>>;
  onCollapse: () => void;
  track: ITrack;
}

const ViewHeader = memo(
  ({
    handleMoreOptions,
    track,
    currentView,
    phase,
    setView,
    setSwipeDir,
    onCollapse,
  }: ViewHeaderProps) => {
    const handleMore = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleMoreOptions(track);
      },
      [track, handleMoreOptions],
    );
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
          className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all"
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
                className="text-[7px] font-bold uppercase tracking-[0.22em] text-white/30"
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
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
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
                className="h-[3px] rounded-full bg-white cursor-pointer"
              />
            ))}
          </div>
        </div>

        <button
          className="flex items-center justify-center size-10 rounded-full text-white/70 hover:text-white hover:bg-white/[0.08] active:scale-90 transition-all"
          aria-label="More options"
        >
          <MoreHorizontal
            className="size-6"
            strokeWidth={2}
            onClick={handleMore}
          />
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
            <LyricsView
              isPlaying={isPlaying}
              lyricType={track.lyricType}
              plainLyrics={track.plainLyrics}
              syncedLines={(lyrics as any) ?? []}
              karaokeLines={(lyrics as any) ?? []}
              currentTime={currentTime}
              onSeek={onSeek}
              loading={loadingLyrics}
              focusRadius={focusMode ? 1 : 0}
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
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          </motion.div>
        )}

        {currentView === "info" && (
          <TrackDetailPanel track={track} direction={direction} />
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
        <div className="size-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10">
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface FullPlayerProps {
  track: ITrack;
  currentTime: number;
  listenCount: number;
  duration: number;
  onSeek: (time: number) => void;
  onCollapse: () => void;
  getCurrentTime: () => number;
  isPlaying: boolean;
}

export const FullPlayer = ({
  track,
  currentTime,
  duration,
  listenCount,
  onSeek,
  onCollapse,
  getCurrentTime,
  isPlaying,
}: FullPlayerProps) => {
  const [currentView, setCurrentView] = useState<PlayerView>("artwork");
  const [swipeDir, setSwipeDir] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [queueMounted, setQueueMounted] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const phase = usePhase();
  useViewportHeight();

  // ── Sheet state — global, shared across all children via context ────────────
  const [sheetType, setSheetType] = useState<SheetType>(null);
  const [sheetTrack, setSheetTrack] = useState<ITrack | null>(null);

  const openSheet = useCallback((type: "playlist" | "options", t: ITrack) => {
    setSheetTrack(t);
    setSheetType(type);
  }, []);
  const handleMoreOptions = useCallback(
    (t: ITrack) => openSheet("options", t),
    [openSheet],
  );
  const closeSheet = useCallback(() => {
    setSheetType(null);
    // Keep sheetTrack briefly for exit animation
    setTimeout(() => setSheetTrack(null), 400);
  }, []);

  // Transition between sheets (options → playlist)
  const switchToPlaylist = useCallback((t: ITrack) => {
    setSheetType(null);
    setTimeout(() => {
      setSheetTrack(t);
      setSheetType("playlist");
    }, 220);
  }, []);

  const queueSheetRef = useRef<HTMLElement>(null);
  const { lyrics, loading } = useLyrics(track.lyricUrl);

  useEffect(() => {
    if (showQueue && !queueMounted) setQueueMounted(true);
  }, [showQueue, queueMounted]);

  useFocusTrap(showQueue, queueSheetRef as React.RefObject<HTMLElement>);

  useEffect(() => {
    if (!showQueue) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQueue(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [showQueue]);

  // Close sheets on Escape
  useEffect(() => {
    if (!sheetType) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [sheetType, closeSheet]);

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
    <PlayerSheetContext.Provider value={{ openSheet, closeSheet }}>
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
          dominantColor="primary"
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
          {/* ── LEFT PANEL ── */}
          <div className="flex flex-col flex-1 min-h-0 lg:flex-initial lg:w-[50%] xl:w-[55%]">
            {currentView !== "mood" && (
              <ViewHeader
                track={track}
                handleMoreOptions={handleMoreOptions}
                currentView={currentView}
                phase={phase}
                setView={setCurrentView}
                setSwipeDir={setSwipeDir}
                onCollapse={onCollapse}
              />
            )}
            {currentView === "mood" &&
              (!track.moodVideo || track.moodVideo === null) && (
                <ViewHeader
                  track={track}
                  handleMoreOptions={handleMoreOptions}
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

            {/* ── MOBILE CONTROLS ── */}
            <div className="lg:hidden bg-transparent">
              {isArtwork ? (
                <div className="px-6 pb-2 pt-2 space-y-5 shrink-0 bg-transparent">
                  <TrackInfoRow
                    track={track}
                    phase={phase}
                    listenCount={listenCount}
                  />
                  {/* PERF-3: IsolatedProgress — no currentTime prop re-render */}
                  <IsolatedProgress
                    getCurrentTime={getCurrentTime}
                    duration={duration}
                    onSeek={onSeek}
                    hasLabels
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
                  <div className="px-5 pb-5 pt-2 space-y-4 shrink-0 bg-transparent shadow-[0_-4px_10px_rgba(0,0,0,0.1),0_-20px_40px_15px_rgba(0,0,0,0.15)]">
                    <IsolatedProgress
                      getCurrentTime={getCurrentTime}
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

          {/* ── RIGHT PANEL (desktop) ── */}
          <div className="hidden lg:flex flex-col lg:w-[50%] xl:w-[45%] border-l border-white/[0.05] overflow-hidden">
            <div className="shrink-0 px-10 pt-16 pb-6 flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <MarqueeText
                    text={track.title}
                    className="text-3xl font-bold text-brand truncate leading-tight tracking-tight"
                    speed={38}
                    pauseMs={1600}
                  />
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
                  <div className="flex justify-center gap-2">
                    <EyeViewBadge size="sm" count={listenCount} />
                    <TrackLikeButton id={track._id} />
                  </div>
                ) : (
                  <div className="size-7" aria-hidden="true" />
                )}
              </div>

              {/* PERF-3: IsolatedProgress for desktop */}
              <IsolatedProgress
                getCurrentTime={getCurrentTime}
                duration={duration}
                onSeek={onSeek}
                hasLabels
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

        {/* ── MOBILE QUEUE SHEET ── */}
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

        {/* ── GLOBAL PLAYER SHEETS — rendered once, shared via context ── */}
        <AddToPlaylistSheet
          track={sheetTrack}
          isOpen={sheetType === "playlist"}
          onClose={closeSheet}
        />
        <OptionSheet
          track={sheetTrack}
          isOpen={sheetType === "options"}
          onClose={closeSheet}
          onAddToPlaylist={switchToPlaylist}
        />
      </motion.div>
    </PlayerSheetContext.Provider>
  );
};

export default FullPlayer;
