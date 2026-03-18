/**
 * @file QueueList.tsx
 * @description Play Queue — Refined UI/UX with smooth animations
 */
import { useEffect, useRef, memo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Play, MoreHorizontal, ListMusic, GripVertical, X } from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setQueue,
  setIsPlaying,
} from "@/features/player/slice/playerSlice";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/utils/format";
import { ITrack } from "@/features/track";

// ── 1. PLAYING VISUALIZER ──────────────────────────────────────────────────
const PlayingVisualizer = ({ paused = false }: { paused?: boolean }) => (
  <div className="flex items-end gap-[2.5px] h-3.5">
    {[1, 2, 3, 4].map((i) => (
      <motion.span
        key={i}
        className="w-[3px] bg-primary rounded-[2px] origin-bottom"
        animate={
          paused
            ? { scaleY: 0.3 }
            : {
                scaleY: [0.4, 1, 0.5, 0.9, 0.3, 1],
              }
        }
        transition={
          paused
            ? { duration: 0.2 }
            : {
                duration: 0.9 + i * 0.15,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: i * 0.12,
              }
        }
        style={{ height: 14 }}
      />
    ))}
  </div>
);

// ── 2. QUEUE ITEM ──────────────────────────────────────────────────────────
interface QueueItemProps {
  track: ITrack;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

const QueueItem = memo(
  ({ track, index, isCurrent, isPlaying, onPlay }: QueueItemProps) => {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer",
          "transition-colors duration-150",
          isCurrent
            ? "bg-primary/8 dark:bg-primary/10"
            : "hover:bg-white/5 dark:hover:bg-white/5",
        )}
        onClick={onPlay}
        data-active={isCurrent}
      >
        {/* Active left accent */}
        {isCurrent && (
          <motion.div
            layoutId="active-accent"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        )}

        {/* COL 1: Index / Visualizer */}
        <div className="w-7 flex justify-center items-center shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {isCurrent ? (
              <motion.div
                key="viz"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <PlayingVisualizer paused={!isPlaying} />
              </motion.div>
            ) : (
              <motion.div
                key="index"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full flex justify-center"
              >
                <span className="text-xs font-mono text-muted-foreground group-hover:invisible">
                  {index + 1}
                </span>
                <motion.div
                  className="absolute inset-0 flex justify-center items-center invisible group-hover:visible"
                  whileHover={{ scale: 1.15 }}
                >
                  <Play className="size-3.5 fill-current text-white" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* COL 2: Artwork */}
        <div className="relative size-9 shrink-0 rounded-md overflow-hidden bg-muted/30 shadow-sm">
          <ImageWithFallback
            src={track.coverImage}
            alt={track.title}
            className={cn(
              "size-full object-cover transition-all duration-300",
              isCurrent
                ? "opacity-100 scale-105"
                : "opacity-75 group-hover:opacity-95 group-hover:scale-105",
            )}
          />
        </div>

        {/* COL 3: Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <span
            className={cn(
              "text-[13px] font-medium truncate leading-tight transition-colors",
              isCurrent
                ? "text-primary"
                : "text-foreground/90 group-hover:text-white",
            )}
          >
            {track.title}
          </span>
          <span className="text-[11px] text-muted-foreground truncate leading-tight">
            {track.artist?.name}
          </span>
        </div>

        {/* COL 4: Duration + Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Duration — fades out on hover */}
          <span
            className={cn(
              "text-[10px] text-muted-foreground font-mono mr-1 transition-opacity duration-150 hidden sm:block",
              "group-hover:opacity-0",
            )}
          >
            {formatTime(track.duration || 0)}
          </span>

          {/* Drag handle */}
          <motion.div
            className="hidden group-hover:flex items-center text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
            whileHover={{ scale: 1.1 }}
          >
            <GripVertical className="size-3.5" />
          </motion.div>

          {/* More options */}
          <motion.div
            initial={false}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-white hover:bg-white/10"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  },
);

QueueItem.displayName = "QueueItem";

// ── 3. EMPTY STATE ─────────────────────────────────────────────────────────
const EmptyQueue = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className="flex flex-col items-center justify-center h-full gap-3 pb-8 text-center px-6"
  >
    <div className="size-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
      <ListMusic className="size-6 text-muted-foreground/50" />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground/50">Queue is empty</p>
      <p className="text-xs text-muted-foreground/40 mt-0.5">
        Add songs to get started
      </p>
    </div>
  </motion.div>
);

// ── 4. MAIN COMPONENT ──────────────────────────────────────────────────────
export const QueueList = () => {
  const dispatch = useDispatch();
  const { activeQueue, currentTrack, isPlaying } = useSelector(selectPlayer);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Current index for context
  const currentIndex = activeQueue.findIndex(
    (t) => t._id === currentTrack?._id,
  );
  const upNext =
    currentIndex >= 0 ? activeQueue.slice(currentIndex + 1) : activeQueue;
  const history = currentIndex > 0 ? activeQueue.slice(0, currentIndex) : [];

  // Auto-scroll to current track
  useEffect(() => {
    if (!scrollRef.current || !currentTrack) return;
    const el = scrollRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTrack?._id]);

  const handleTrackClick = useCallback(
    (index: number, trackId: string) => {
      if (currentTrack?._id === trackId) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        dispatch(setQueue({ tracks: activeQueue, startIndex: index }));
      }
    },
    [activeQueue, currentTrack, isPlaying, dispatch],
  );

  const hasQueue = activeQueue.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col w-full h-full bg-background/60 dark:bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/8 overflow-hidden"
    >
      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <ListMusic className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
            Queue
          </span>
          {hasQueue && (
            <motion.span
              key={activeQueue.length}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[10px] text-muted-foreground bg-white/6 border border-white/8 px-1.5 py-0.5 rounded-full font-mono"
            >
              {activeQueue.length}
            </motion.span>
          )}
        </div>

        {hasQueue && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5 rounded-full px-2.5 gap-1"
            >
              <X className="size-2.5" />
              Clear
            </Button>
          </motion.div>
        )}
      </div>

      {/* ── LIST ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {!hasQueue ? (
          <EmptyQueue />
        ) : (
          <div className="p-2 space-y-0">
            {/* NOW PLAYING section */}
            {currentTrack && (
              <>
                <SectionLabel label="Now Playing" />
                <AnimatePresence mode="popLayout">
                  {activeQueue
                    .filter((t) => t._id === currentTrack._id)
                    .map((track) => (
                      <QueueItem
                        key={track._id}
                        track={track}
                        index={currentIndex}
                        isCurrent={true}
                        isPlaying={isPlaying}
                        onPlay={() => handleTrackClick(currentIndex, track._id)}
                      />
                    ))}
                </AnimatePresence>
              </>
            )}

            {/* NEXT UP section */}
            {upNext.length > 0 && (
              <>
                <SectionLabel label="Next Up" className="mt-3" />
                <AnimatePresence mode="popLayout" initial={false}>
                  {upNext.map((track, i) => {
                    const realIndex = currentIndex + 1 + i;
                    return (
                      <QueueItem
                        key={`${track._id}-${realIndex}`}
                        track={track}
                        index={realIndex}
                        isCurrent={false}
                        isPlaying={isPlaying}
                        onPlay={() => handleTrackClick(realIndex, track._id)}
                      />
                    );
                  })}
                </AnimatePresence>
              </>
            )}

            {/* HISTORY section (collapsed) */}
            {history.length > 0 && (
              <>
                <SectionLabel label="History" className="mt-3" dim />
                <div className="opacity-40">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {history.map((track, i) => (
                      <QueueItem
                        key={`${track._id}-h-${i}`}
                        track={track}
                        index={i}
                        isCurrent={false}
                        isPlaying={false}
                        onPlay={() => handleTrackClick(i, track._id)}
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
    </motion.div>
  );
};

// ── Section label helper ───────────────────────────────────────────────────
const SectionLabel = ({
  label,
  className,
  dim,
}: {
  label: string;
  className?: string;
  dim?: boolean;
}) => (
  <div className={cn("px-3 pt-1 pb-1.5", className)}>
    <span
      className={cn(
        "text-[9px] uppercase tracking-[0.12em] font-semibold",
        dim ? "text-muted-foreground/35" : "text-muted-foreground/60",
      )}
    >
      {label}
    </span>
  </div>
);

export default QueueList;
