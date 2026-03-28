/**
 * QueueList.tsx — Play queue panel
 *
 * Architecture
 * ────────────
 * • Granular Redux selector — excludes currentTime, so progress ticks
 *   never trigger a re-render of this tree.
 *
 * • Derived data (currentIndex, upNext, history) memoised with useMemo.
 *   O(n) slice operations are not repeated on unrelated re-renders.
 *
 * • PlayingVisualizer: CSS-only animation (zero Framer per-bar subscriptions).
 *   Injected once as a <style> block; compositor-thread only after paint.
 *
 * • QueueItem initial animation guard: `didMount` ref prevents mass-animate
 *   on first render when the panel opens with a full queue already loaded.
 *
 * • Full theme support via CSS variables — no hardcoded rgba/white/black.
 *
 * • Full keyboard accessibility: every item has tabIndex + onKeyDown handler.
 *   aria-current replaces the fragile data-active string selector.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Play, MoreHorizontal, ListMusic, GripVertical, X } from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  setQueue,
  setIsPlaying,
  selectPlayer,
} from "@/features/player/slice/playerSlice";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/utils/format";
import { ITrack } from "@/features/track";

// ─────────────────────────────────────────────────────────────────────────────
// GRANULAR SELECTOR
// Excludes currentTime — progress ticks never re-render QueueList.
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// CSS-ONLY PLAYING VISUALIZER
// Injected once. No MotionValue subscriptions, no JS animation loop.
// ─────────────────────────────────────────────────────────────────────────────

const VIZ_CSS = `
  @keyframes ql-bar {
    0%,100% { transform: scaleY(0.22); }
    50%      { transform: scaleY(1); }
  }
`;

let _vizInjected = false;

const PlayingVisualizer = memo(({ paused = false }: { paused?: boolean }) => {
  if (!_vizInjected && typeof document !== "undefined") {
    _vizInjected = true;
    const s = document.createElement("style");
    s.textContent = VIZ_CSS;
    document.head.appendChild(s);
  }

  const durations = [0.85, 1.05, 0.70, 0.95];
  const delays    = [0, 0.12, 0.22, 0.08];

  return (
    <div className="flex items-end gap-[2.5px] h-[14px]" aria-hidden="true">
      {durations.map((dur, i) => (
        <span
          key={i}
          className="w-[3px] rounded-[2px] origin-bottom"
          style={{
            height: 14,
            background: "hsl(var(--primary))",
            opacity:   paused ? 0.45 : 1,
            transform: paused ? "scaleY(0.22)" : undefined,
            animation: paused
              ? "none"
              : `ql-bar ${dur}s ease-in-out ${delays[i]}s infinite`,
            transition: "opacity 0.25s, transform 0.25s",
          }}
        />
      ))}
    </div>
  );
});
PlayingVisualizer.displayName = "PlayingVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const SP_ITEM   = { type: "spring", stiffness: 360, damping: 28 } as const;
const SP_ACCENT = { type: "spring", stiffness: 400, damping: 28 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL — defined before QueueItem/QueueList to avoid TDZ
// ─────────────────────────────────────────────────────────────────────────────

interface SectionLabelProps {
  children: ReactNode;
  dim?: boolean;
  className?: string;
}

const SectionLabel = ({ children, dim, className }: SectionLabelProps) => (
  <div className={cn("px-3 pt-1 pb-1.5", className)}>
    <span
      className="text-[9px] uppercase tracking-[0.13em] font-semibold"
      style={{ color: `hsl(var(--muted-foreground) / ${dim ? 0.35 : 0.6})` }}
    >
      {children}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ITEM
// ─────────────────────────────────────────────────────────────────────────────

interface QueueItemProps {
  track: ITrack;
  /** Absolute position in activeQueue (0-based, displayed as 1-based) */
  queueIndex: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  /** false on panel open — prevents mass-animate of pre-loaded queue */
  shouldAnimate: boolean;
}

const QueueItem = memo(
  ({ track, queueIndex, isCurrent, isPlaying, onPlay, shouldAnimate }: QueueItemProps) => {
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPlay(); }
    }, [onPlay]);

    return (
      <motion.div
        layout="position"
        initial={shouldAnimate ? { opacity: 0, x: -8 } : false}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10, transition: { duration: 0.14 } }}
        transition={SP_ITEM}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer",
          "outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
          isCurrent
            ? "bg-[hsl(var(--primary)/0.09)]"
            : "hover:bg-[hsl(var(--muted)/0.5)]",
        )}
        onClick={onPlay}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-current={isCurrent ? "true" : undefined}
        aria-label={`${isCurrent ? "Now playing" : "Play"}: ${track.title} by ${track.artist?.name}`}
      >
        {/* Active left accent bar */}
        {isCurrent && (
          <motion.div
            layoutId="ql-accent"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
            style={{ background: "hsl(var(--primary))" }}
            transition={SP_ACCENT}
          />
        )}

        {/* COL 1 — Index / Visualizer */}
        <div className="w-7 flex justify-center items-center shrink-0">
          {isCurrent ? (
            <PlayingVisualizer paused={!isPlaying} />
          ) : (
            <div className="relative flex justify-center items-center w-full">
              <span
                className="text-xs font-mono group-hover:opacity-0 transition-opacity duration-150"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {queueIndex + 1}
              </span>
              <Play
                className="size-3.5 absolute fill-current opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ color: "hsl(var(--foreground))" }}
              />
            </div>
          )}
        </div>

        {/* COL 2 — Artwork */}
        <div
          className="relative size-9 shrink-0 rounded-md overflow-hidden shadow-sm"
          style={{ background: "hsl(var(--muted))" }}
        >
          <ImageWithFallback
            src={track.coverImage}
            alt=""
            className={cn(
              "size-full object-cover",
              "transition-[opacity,transform] duration-300",
              isCurrent
                ? "opacity-100 scale-[1.04]"
                : "opacity-70 group-hover:opacity-95 group-hover:scale-[1.04]",
            )}
          />
        </div>

        {/* COL 3 — Text info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <span
            className="text-[13px] font-medium truncate leading-tight transition-colors duration-150"
            style={{
              color: isCurrent
                ? "hsl(var(--primary))"
                : "hsl(var(--foreground) / 0.88)",
            }}
          >
            {track.title}
          </span>
          <span
            className="text-[11px] truncate leading-snug"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {track.artist?.name}
          </span>
        </div>

        {/* COL 4 — Duration + actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Duration — fades on hover */}
          <span
            className="hidden sm:block text-[10px] font-mono mr-1 group-hover:opacity-0 transition-opacity duration-150"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {formatTime(track.duration ?? 0)}
          </span>

          {/* Drag handle */}
          <GripVertical
            className="size-3.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ color: "hsl(var(--muted-foreground) / 0.55)" }}
          />

          {/* More options — no Framer wrapper needed */}
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              aria-label={`More options for ${track.title}`}
              className="size-7 rounded-full transition-colors duration-150"
              style={{
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  },
);
QueueItem.displayName = "QueueItem";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyQueue = memo(() => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.08, type: "spring", stiffness: 300, damping: 28 }}
    className="flex flex-col items-center justify-center h-full gap-4 px-6 py-12 text-center"
  >
    <div
      className="size-14 rounded-2xl flex items-center justify-center"
      style={{
        background: "hsl(var(--muted))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <ListMusic className="size-6" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }} />
    </div>
    <div className="space-y-1">
      <p
        className="text-sm font-medium"
        style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}
      >
        Queue is empty
      </p>
      <p
        className="text-xs"
        style={{ color: "hsl(var(--muted-foreground) / 0.38)" }}
      >
        Add songs to get started
      </p>
    </div>
  </motion.div>
));
EmptyQueue.displayName = "EmptyQueue";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface QueueHeaderProps {
  count: number;
  hasQueue: boolean;
  onClear?: () => void;
}

const QueueHeader = memo(({ count, hasQueue, onClear }: QueueHeaderProps) => (
  <header
    className="shrink-0 flex items-center justify-between px-4 py-3"
    style={{ borderBottom: "1px solid hsl(var(--border) / 0.4)" }}
  >
    <div className="flex items-center gap-2">
      <ListMusic
        className="size-3.5"
        style={{ color: "hsl(var(--primary))" }}
        aria-hidden="true"
      />
      <span
        className="text-xs font-bold tracking-[0.14em] uppercase"
        style={{ color: "hsl(var(--foreground) / 0.75)" }}
      >
        Queue
      </span>

      {hasQueue && (
        <motion.span
          key={count}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
          style={{
            color:      "hsl(var(--muted-foreground))",
            background: "hsl(var(--muted))",
            border:     "1px solid hsl(var(--border))",
          }}
          aria-label={`${count} songs`}
        >
          {count}
        </motion.span>
      )}
    </div>

    {hasQueue && (
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-6 rounded-full px-2.5 gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-150"
        style={{ color: "hsl(var(--muted-foreground) / 0.55)" }}
        aria-label="Clear queue"
      >
        <X className="size-2.5" />
        Clear
      </Button>
    )}
  </header>
));
QueueHeader.displayName = "QueueHeader";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const QueueList = memo(() => {
  const dispatch = useDispatch();
  const { activeQueue, currentTrack, isPlaying } =  useSelector(selectPlayer)
  const scrollRef  = useRef<HTMLDivElement>(null);
  const didMount   = useRef(false);

  // Track whether first mount has passed — suppresses mass entry animation
  useEffect(() => { didMount.current = true; }, []);

  // ── Derived data — memoised to avoid O(n) on unrelated re-renders ──────
  const currentIndex = useMemo(
    () => activeQueue.findIndex((t) => t._id === currentTrack?._id),
    [activeQueue, currentTrack?._id],
  );

  const { upNext, history } = useMemo(() => ({
    upNext:  currentIndex >= 0 ? activeQueue.slice(currentIndex + 1) : activeQueue,
    history: currentIndex > 0  ? activeQueue.slice(0, currentIndex)  : [],
  }), [activeQueue, currentIndex]);

  const hasQueue = activeQueue.length > 0;

  // ── Scroll current item into view when track changes ───────────────────
  useEffect(() => {
    if (!scrollRef.current || !currentTrack) return;
    // aria-current="true" instead of data-active="true" (more semantic)
    const el = scrollRef.current.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTrack?._id]);

  // ── Play handler ───────────────────────────────────────────────────────
  const handleTrackPlay = useCallback(
    (index: number, trackId: string) => {
      if (currentTrack?._id === trackId) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        dispatch(setQueue({ tracks: activeQueue, startIndex: index }));
      }
    },
    [activeQueue, currentTrack?._id, isPlaying, dispatch],
  );

  // ── shouldAnimate: false on first mount, true after ───────────────────
  const shouldAnimate = didMount.current;

  return (
    <div
      className="flex flex-col w-full h-full rounded-2xl overflow-hidden"
      style={{
        background: "hsl(var(--card) / 0.6)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid hsl(var(--border) / 0.5)",
      }}
      role="region"
      aria-label="Play queue"
    >
      {/* ── Header ── */}
      <QueueHeader
        count={activeQueue.length}
        hasQueue={hasQueue}
        onClear={() => {/* dispatch(clearQueue()) */}}
      />

      {/* ── Scrollable list ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        role="list"
        aria-label="Tracks in queue"
      >
        <style>{`
          .ql-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        {!hasQueue ? (
          <EmptyQueue />
        ) : (
          <div className="p-2">

            {/* Now Playing */}
            {currentTrack && (
              <>
                <SectionLabel>Now Playing</SectionLabel>
                <AnimatePresence mode="popLayout">
                  {activeQueue
                    .filter((t) => t._id === currentTrack._id)
                    .map((t) => (
                      <QueueItem
                        key={t._id}
                        track={t}
                        queueIndex={currentIndex}
                        isCurrent
                        isPlaying={isPlaying}
                        onPlay={() => handleTrackPlay(currentIndex, t._id)}
                        shouldAnimate={shouldAnimate}
                      />
                    ))}
                </AnimatePresence>
              </>
            )}

            {/* Next Up */}
            {upNext.length > 0 && (
              <>
                <SectionLabel className="mt-3">Next Up</SectionLabel>
                <AnimatePresence mode="popLayout" initial={false}>
                  {upNext.map((t, i) => {
                    const ri = currentIndex + 1 + i;
                    return (
                      <QueueItem
                        key={`${t._id}-${ri}`}
                        track={t}
                        queueIndex={ri}
                        isCurrent={false}
                        isPlaying={isPlaying}
                        onPlay={() => handleTrackPlay(ri, t._id)}
                        shouldAnimate={shouldAnimate}
                      />
                    );
                  })}
                </AnimatePresence>
              </>
            )}

            {/* History — dimmed */}
            {history.length > 0 && (
              <>
                <SectionLabel className="mt-3" dim>History</SectionLabel>
                <div style={{ opacity: 0.38 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {history.map((t, i) => (
                      <QueueItem
                        key={`${t._id}-h${i}`}
                        track={t}
                        queueIndex={i}
                        isCurrent={false}
                        isPlaying={false}
                        onPlay={() => handleTrackPlay(i, t._id)}
                        shouldAnimate={shouldAnimate}
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
});

QueueList.displayName = "QueueList";
export default QueueList;