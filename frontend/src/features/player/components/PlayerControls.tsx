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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setIsPlaying,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} from "@/features/player/slice/playerSlice";

// ── Reusable animated icon button ──────────────────────────────────────────
const IconBtn = ({
  onClick,
  disabled,
  active,
  children,
  className,
  title,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  size?: "sm" | "default" | "lg";
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => (
  <motion.button
    title={title}
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? {} : { scale: 1.1 }}
    whileTap={disabled ? {} : { scale: 0.88 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
    className={cn(
      "relative inline-flex items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      "disabled:opacity-30 disabled:pointer-events-none",
      active && "text-primary",
      className,
    )}
  >
    {children}
  </motion.button>
);

export const PlayerControls = ({
  variant = "full",
  getCurrentTime,
}: {
  variant?: "mini" | "full";
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
  const isPrevDisabled =
    !hasQueue || (currentIndex === 0 && repeatMode === "off");
  const isNextDisabled =
    !hasQueue ||
    (currentIndex === activeQueue.length - 1 && repeatMode === "off");

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPrevDisabled) return;
    dispatch(prevTrack(getCurrentTime ? getCurrentTime() : 0));
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasQueue) return;
    dispatch(setIsPlaying(!isPlaying));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNextDisabled) return;
    dispatch(nextTrack());
  };

  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasQueue) return;
    dispatch(toggleShuffle());
  };

  const handleRepeat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasQueue) return;
    dispatch(toggleRepeat());
  };

  // ── MINI VARIANT ─────────────────────────────────────────────────────────
  if (variant === "mini") {
    return (
      <div className="flex items-center gap-1">
        <IconBtn
          onClick={handlePrev}
          disabled={isPrevDisabled}
          className="text-foreground/70 hover:text-foreground p-1.5"
          title="Previous"
        >
          <SkipBack className="size-4 fill-current" />
        </IconBtn>

        {/* Play/Pause — primary pill */}
        <motion.button
          onClick={togglePlay}
          disabled={!hasQueue}
          whileHover={hasQueue ? { scale: 1.07 } : {}}
          whileTap={hasQueue ? { scale: 0.92 } : {}}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          className="relative flex items-center justify-center rounded-full size-9 bg-primary text-primary-foreground shadow-md disabled:opacity-30 disabled:pointer-events-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2 className="size-4 animate-spin" />
              </motion.span>
            ) : isPlaying ? (
              <motion.span
                key="pause"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.12 }}
              >
                <Pause className="size-4 fill-current" />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.12 }}
              >
                <Play className="size-4 fill-current ml-0.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <IconBtn
          onClick={handleNext}
          disabled={isNextDisabled}
          className="text-foreground/70 hover:text-foreground p-1.5"
          title="Next"
        >
          <SkipForward className="size-4 fill-current" />
        </IconBtn>
      </div>
    );
  }

  // ── FULL VARIANT ─────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-between w-full max-w-md mx-auto">
      {/* Shuffle */}
      <IconBtn
        onClick={handleShuffle}
        disabled={!hasQueue}
        active={isShuffling}
        className="relative text-white/60 hover:text-white p-2"
        title="Shuffle"
      >
        <Shuffle className="size-5 lg:size-[22px]" />
        {isShuffling && (
          <motion.span
            layoutId="active-dot"
            className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          />
        )}
      </IconBtn>

      {/* Prev */}
      <IconBtn
        onClick={handlePrev}
        disabled={isPrevDisabled}
        className="text-white/70 hover:text-white p-2"
        title="Previous"
      >
        <SkipBack className="size-7 fill-current" />
      </IconBtn>

      {/* Play/Pause — large primary circle */}
      <motion.button
        onClick={togglePlay}
        disabled={!hasQueue}
        whileHover={hasQueue ? { scale: 1.06 } : {}}
        whileTap={hasQueue ? { scale: 0.93 } : {}}
        transition={{ type: "spring", stiffness: 360, damping: 18 }}
        className="relative flex items-center justify-center rounded-full size-16 lg:size-[72px] bg-white text-black shadow-[0_4px_24px_rgba(255,255,255,0.22)] disabled:opacity-40 disabled:pointer-events-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.18 }}
            >
              <Loader2 className="size-7 animate-spin" />
            </motion.span>
          ) : isPlaying ? (
            <motion.span
              key="pause"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 420, damping: 20 }}
            >
              <Pause className="size-7 lg:size-8 fill-current" />
            </motion.span>
          ) : (
            <motion.span
              key="play"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 420, damping: 20 }}
            >
              <Play className="size-7 lg:size-8 fill-current ml-1" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Next */}
      <IconBtn
        onClick={handleNext}
        disabled={isNextDisabled}
        className="text-white/70 hover:text-white p-2"
        title="Next"
      >
        <SkipForward className="size-7 fill-current" />
      </IconBtn>

      {/* Repeat */}
      <IconBtn
        onClick={handleRepeat}
        disabled={!hasQueue}
        active={repeatMode !== "off"}
        className="relative text-white/60 hover:text-white p-2"
        title="Repeat"
      >
        <AnimatePresence mode="wait" initial={false}>
          {repeatMode === "one" ? (
            <motion.span
              key="repeat1"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
            >
              <Repeat1 className="size-5 lg:size-[22px] text-primary" />
            </motion.span>
          ) : (
            <motion.span
              key="repeat"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
            >
              <Repeat
                className={cn(
                  "size-5 lg:size-[22px]",
                  repeatMode !== "off" ? "text-primary" : "",
                )}
              />
            </motion.span>
          )}
        </AnimatePresence>
        {repeatMode !== "off" && (
          <motion.span
            className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          />
        )}
      </IconBtn>
    </div>
  );
};

export default PlayerControls;
