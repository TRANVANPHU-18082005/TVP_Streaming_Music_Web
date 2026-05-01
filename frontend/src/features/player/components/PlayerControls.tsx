/**
 * PlayerControls.tsx — Production v4.0
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES v3 → v4:
 *
 * PERF-1  IconBtn typed properly — removed `any` type, added full TypeScript props
 * PERF-2  handlePrev/togglePlay/handleNext wrapped in useCallback — stable refs
 * PERF-3  Shuffle/Repeat handlers extracted from inline lambdas to stable callbacks
 * PERF-4  PlayerControls wrapped in memo — no re-render unless player state changes
 * UX-1    Play button "full" variant now uses design tokens (bg-primary) not bg-white
 * UX-2    Added useReducedMotion guard — respects system accessibility settings
 * UX-3    Active indicator dot uses AnimatePresence for smooth mount/unmount
 * UX-4    Play button spring animation aligned with system SP presets
 */

import { memo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} from "@/features/player/slice/playerSlice";

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — module scope, stable
// ─────────────────────────────────────────────────────────────────────────────

const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  pop:    { type: "spring", stiffness: 520, damping: 24 } as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ICON BUTTON — typed, memoized
// ─────────────────────────────────────────────────────────────────────────────

interface IconBtnProps {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
}

const IconBtn = memo(
  ({ onClick, disabled, active, children, className, title, "aria-label": ariaLabel }: IconBtnProps) => {
    const reduced = useReducedMotion();
    return (
      <motion.button
        title={title}
        aria-label={ariaLabel ?? title}
        aria-pressed={active}
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled || reduced ? {} : { scale: 1.1 }}
        whileTap={disabled || reduced ? {} : { scale: 0.88 }}
        transition={SP.snappy}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:opacity-30 disabled:pointer-events-none",
          active && "text-primary",
          className,
        )}
      >
        {children}
      </motion.button>
    );
  },
);
IconBtn.displayName = "IconBtn";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE DOT — AnimatePresence for smooth mount/unmount
// ─────────────────────────────────────────────────────────────────────────────

const ActiveDot = memo(({ layoutId, show }: { layoutId: string; show: boolean }) => (
  <AnimatePresence>
    {show && (
      <motion.span
        key={layoutId}
        layoutId={layoutId}
        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={SP.pop}
      />
    )}
  </AnimatePresence>
));
ActiveDot.displayName = "ActiveDot";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const PlayerControls = memo(
  ({
    variant = "full",
    getCurrentTime,
  }: {
    variant?: "mini" | "full";
    getCurrentTime?: () => number;
  }) => {
    const dispatch = useDispatch();
    const reduced = useReducedMotion();

    const {
      isPlaying,
      isShuffling,
      repeatMode,
      loadingState,
      activeQueueIds,
      currentIndex,
    } = useSelector(selectPlayer);

    const hasQueue        = activeQueueIds.length > 0;
    const isGlobalLoading = loadingState === "loading" || loadingState === "buffering";
    const isPrevDisabled  = !hasQueue || (currentIndex === 0 && repeatMode === "off");
    const isNextDisabled  = !hasQueue || (currentIndex === activeQueueIds.length - 1 && repeatMode === "off");

    // PERF-2,3: stable callbacks
    const handlePrev = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPrevDisabled) return;
        dispatch(prevTrack(getCurrentTime ? getCurrentTime() : 0));
      },
      [dispatch, isPrevDisabled, getCurrentTime],
    );

    const togglePlay = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasQueue) return;
        dispatch(setIsPlaying(!isPlaying));
      },
      [dispatch, hasQueue, isPlaying],
    );

    const handleNext = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isNextDisabled) return;
        dispatch(nextTrack());
      },
      [dispatch, isNextDisabled],
    );

    const handleShuffle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(toggleShuffle());
      },
      [dispatch],
    );

    const handleRepeat = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(toggleRepeat());
      },
      [dispatch],
    );

    // Shared Play/Pause/Loading icon renderer
    const renderMainIcon = (sizeCls: string) => (
      <AnimatePresence mode="wait" initial={false}>
        {isGlobalLoading ? (
          <motion.span
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className={cn(sizeCls, "animate-spin")} />
          </motion.span>
        ) : isPlaying ? (
          <motion.span
            key="pause"
            initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? {} : { scale: 0.5, opacity: 0 }}
            transition={SP.pop}
          >
            <Pause className={cn(sizeCls, "fill-current")} />
          </motion.span>
        ) : (
          <motion.span
            key="play"
            initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? {} : { scale: 0.5, opacity: 0 }}
            transition={SP.pop}
          >
            <Play className={cn(sizeCls, "fill-current")} />
          </motion.span>
        )}
      </AnimatePresence>
    );

    // ── MINI VARIANT ──────────────────────────────────────────────────────────
    if (variant === "mini") {
      return (
        <div className="flex items-center gap-1">
          <IconBtn
            onClick={handlePrev}
            disabled={isPrevDisabled}
            aria-label="Bài trước"
            className="p-1.5 text-foreground/70 hover:text-foreground"
          >
            <SkipBack className="size-4 fill-current" />
          </IconBtn>

          <motion.button
            onClick={togglePlay}
            disabled={!hasQueue}
            whileHover={reduced ? {} : { scale: 1.06 }}
            whileTap={reduced ? {} : { scale: 0.94 }}
            transition={SP.pop}
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            aria-pressed={isPlaying}
            className="relative flex items-center justify-center rounded-full size-9 bg-primary text-primary-foreground shadow-md focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {renderMainIcon("size-4")}
          </motion.button>

          <IconBtn
            onClick={handleNext}
            disabled={isNextDisabled}
            aria-label="Bài tiếp theo"
            className="p-1.5 text-foreground/70 hover:text-foreground"
          >
            <SkipForward className="size-4 fill-current" />
          </IconBtn>
        </div>
      );
    }

    // ── FULL VARIANT ──────────────────────────────────────────────────────────
    return (
      <div className="flex items-center justify-between w-full max-w-md mx-auto">
        <IconBtn
          onClick={handleShuffle}
          disabled={!hasQueue}
          active={isShuffling}
          aria-label={isShuffling ? "Tắt phát ngẫu nhiên" : "Bật phát ngẫu nhiên"}
          className="p-2 text-foreground/60 hover:text-foreground"
        >
          <Shuffle className="size-5" />
          <ActiveDot layoutId="dot-shuffle" show={isShuffling} />
        </IconBtn>

        <IconBtn
          onClick={handlePrev}
          disabled={isPrevDisabled}
          aria-label="Bài trước"
          className="p-2 text-foreground/80 hover:text-foreground"
        >
          <SkipBack className="size-7 fill-current" />
        </IconBtn>

        {/* Play / Pause — uses design token bg-primary */}
        <motion.button
          onClick={togglePlay}
          disabled={!hasQueue}
          whileHover={reduced ? {} : { scale: 1.05 }}
          whileTap={reduced ? {} : { scale: 0.95 }}
          transition={SP.pop}
          aria-label={isPlaying ? "Tạm dừng" : "Phát"}
          aria-pressed={isPlaying}
          className="relative flex items-center justify-center rounded-full size-16 bg-primary text-primary-foreground shadow-xl focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:pointer-events-none"
        >
          {renderMainIcon("size-8")}
        </motion.button>

        <IconBtn
          onClick={handleNext}
          disabled={isNextDisabled}
          aria-label="Bài tiếp theo"
          className="p-2 text-foreground/80 hover:text-foreground"
        >
          <SkipForward className="size-7 fill-current" />
        </IconBtn>

        <IconBtn
          onClick={handleRepeat}
          disabled={!hasQueue}
          active={repeatMode !== "off"}
          aria-label={
            repeatMode === "one"
              ? "Lặp lại bài này"
              : repeatMode === "all"
                ? "Lặp lại tất cả"
                : "Bật lặp lại"
          }
          className="p-2 text-foreground/60 hover:text-foreground"
        >
          {repeatMode === "one" ? (
            <Repeat1 className="size-5 text-primary" />
          ) : (
            <Repeat className="size-5" />
          )}
          <ActiveDot layoutId="dot-repeat" show={repeatMode !== "off"} />
        </IconBtn>
      </div>
    );
  },
);

PlayerControls.displayName = "PlayerControls";
export default PlayerControls;
