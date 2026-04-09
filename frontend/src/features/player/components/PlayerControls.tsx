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

// --- IconBtn component giữ nguyên ---
const IconBtn = ({
  onClick,
  disabled,
  active,
  children,
  className,
  title,
}: any) => (
  <motion.button
    title={title}
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? {} : { scale: 1.1 }}
    whileTap={disabled ? {} : { scale: 0.88 }}
    className={cn(
      "relative inline-flex items-center justify-center rounded-full transition-colors outline-none",
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

  // 1. Lấy đúng các state từ PlayerSlice mới
  const {
    isPlaying,
    isShuffling,
    repeatMode,
    loadingState, // Dùng loadingState thay cho isLoading
    activeQueueIds, // Dùng mảng ID
    currentIndex,
  } = useSelector(selectPlayer);

  // 2. Logic kiểm tra trạng thái
  const hasQueue = activeQueueIds.length > 0;

  // loading thực sự khi đang fetch metadata hoặc đang buffer audio
  const isGlobalLoading =
    loadingState === "loading" || loadingState === "buffering";

  const isPrevDisabled =
    !hasQueue || (currentIndex === 0 && repeatMode === "off");
  const isNextDisabled =
    !hasQueue ||
    (currentIndex === activeQueueIds.length - 1 && repeatMode === "off");

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPrevDisabled) return;
    // Gửi currentTime hiện tại để Slice quyết định: Replay bài hay Back bài
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

  // ... (handleShuffle, handleRepeat giữ nguyên)

  // ── RENDER LOGIC ─────────────────────────────────────────────────────────

  // Helper render Play/Pause/Loading icon
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
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
        >
          <Pause className={cn(sizeCls, "fill-current")} />
        </motion.span>
      ) : (
        <motion.span
          key="play"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
        >
          <Play className={cn(sizeCls, "fill-current")} />
        </motion.span>
      )}
    </AnimatePresence>
  );

  if (variant === "mini") {
    return (
      <div className="flex items-center gap-1">
        <IconBtn
          onClick={handlePrev}
          disabled={isPrevDisabled}
          className="p-1.5"
        >
          <SkipBack className="size-4 fill-current" />
        </IconBtn>
        <motion.button
          onClick={togglePlay}
          disabled={!hasQueue}
          className="relative flex items-center justify-center rounded-full size-9 bg-primary text-primary-foreground shadow-md"
        >
          {renderMainIcon("size-4")}
        </motion.button>
        <IconBtn
          onClick={handleNext}
          disabled={isNextDisabled}
          className="p-1.5"
        >
          <SkipForward className="size-4 fill-current" />
        </IconBtn>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full max-w-md mx-auto">
      <IconBtn
        onClick={() => dispatch(toggleShuffle())}
        disabled={!hasQueue}
        active={isShuffling}
        className="p-2"
      >
        <Shuffle className="size-5" />
        {isShuffling && (
          <motion.span
            layoutId="dot-s"
            className="absolute bottom-1 size-1 rounded-full bg-primary"
          />
        )}
      </IconBtn>

      <IconBtn onClick={handlePrev} disabled={isPrevDisabled} className="p-2">
        <SkipBack className="size-7 fill-current" />
      </IconBtn>

      <motion.button
        onClick={togglePlay}
        disabled={!hasQueue}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center justify-center rounded-full size-16 bg-white text-black shadow-xl"
      >
        {renderMainIcon("size-8")}
      </motion.button>

      <IconBtn onClick={handleNext} disabled={isNextDisabled} className="p-2">
        <SkipForward className="size-7 fill-current" />
      </IconBtn>

      <IconBtn
        onClick={() => dispatch(toggleRepeat())}
        disabled={!hasQueue}
        active={repeatMode !== "off"}
        className="p-2"
      >
        {repeatMode === "one" ? (
          <Repeat1 className="size-5 text-primary" />
        ) : (
          <Repeat className="size-5" />
        )}
        {repeatMode !== "off" && (
          <motion.span
            layoutId="dot-r"
            className="absolute bottom-1 size-1 rounded-full bg-primary"
          />
        )}
      </IconBtn>
    </div>
  );
};
export default PlayerControls;
