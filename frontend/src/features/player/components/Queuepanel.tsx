import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { shallowEqual } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, X, GripVertical, Play, Loader2, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import PlayCell from "@/features/track/components/PlayCell";

// DnD Kit
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

import type { RootState } from "@/store/store";
import type { ITrack } from "@/features/track/types";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { TrackTitleMarquee } from "./TrackTitleMarquee";
import { jumpToIndex, reorderQueue, selectPlayer, setIsPlaying } from "..";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SP = {
  snappy: { type: "spring", stiffness: 500, damping: 36 } as const,
  queue: { type: "spring", stiffness: 380, damping: 32 } as const,
} as const;

const MAX_HISTORY_VISIBLE = 20;

// Stable exit object — avoids allocating per item per render
const ITEM_EXIT = {
  opacity: 0,
  x: 10,
  transition: { duration: 0.12 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — PERF-UX-2: duration string cache
// ─────────────────────────────────────────────────────────────────────────────

const durationCache = new Map<number, string>();
function cachedFormatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  if (durationCache.has(seconds)) return durationCache.get(seconds)!;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const v = `${m}:${s.toString().padStart(2, "0")}`;
  durationCache.set(seconds, v);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-TRACK SELECTOR — PERF-1
// Each item subscribes only to its own track in the cache.
// When unrelated tracks are cached/updated, this item does NOT re-render.
// ─────────────────────────────────────────────────────────────────────────────

function useTrack(trackId: string): ITrack | null {
  return useSelector((s: RootState) =>
    trackId ? (s.player.trackMetadataCache[trackId] ?? null) : null,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE PLAY CALLBACKS — PERF-2
// Map<"index:id", () => void> — entries are reused across renders.
// New function created only when an item's position/id actually changes.
// ─────────────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string;
  index: number;
}

function useStablePlayCallbacks(
  entries: QueueEntry[],
  onPlay: (index: number, trackId: string) => void,
): Map<string, (e?: React.MouseEvent) => void> {
  const mapRef = useRef(new Map<string, (e?: React.MouseEvent) => void>());
  const onPlayRef = useRef(onPlay);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  return useMemo(() => {
    const map = mapRef.current;
    const nextKeys = new Set<string>();

    for (const { id, index } of entries) {
      const key = `${index}:${id}`;
      nextKeys.add(key);
      if (!map.has(key)) {
        const ci = index,
          ci_id = id;
        map.set(key, (_e?: React.MouseEvent) => onPlayRef.current(ci, ci_id));
      }
    }
    for (const k of map.keys()) if (!nextKeys.has(k)) map.delete(k);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────

const SectionLabel = memo(
  ({ children, dimmer }: { children: React.ReactNode; dimmer?: boolean }) => (
    <p
      className={cn(
        "text-[9px] font-bold tracking-[0.2em] uppercase px-3 pt-4 pb-1.5",
        dimmer ? "text-[var(--fp-fg-faint)]" : "text-[var(--fp-fg-subtle)]",
      )}
    >
      {children}
    </p>
  ),
);
SectionLabel.displayName = "SectionLabel";

// ─────────────────────────────────────────────────────────────────────────────
// INDEX SLOT — isolated sub-component
// PERF-3: re-renders only when isCurrent or (isCurrent && isPlaying) changes
// ─────────────────────────────────────────────────────────────────────────────

const IndexSlot = memo(
  ({
    index,
    isActive,
    isPlaying,
    onPlay,
  }: {
    index: number;
    isActive: boolean;
    isPlaying: boolean;
    onPlay?: (e?: React.MouseEvent) => void;
  }) => {
    return (
      <div
        className="w-7 flex justify-center items-center shrink-0"
        aria-hidden="true"
      >
        <div className="relative flex justify-center items-center w-full h-full">
          <PlayCell
            index={index}
            isActive={isActive}
            isPlaying={isPlaying}
            onPlay={onPlay ?? (() => {})}
          />
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    (!prev.isActive || prev.isPlaying === next.isPlaying),
);
IndexSlot.displayName = "IndexSlot";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK COVER — isolated, re-renders only on src/isActive change
// ─────────────────────────────────────────────────────────────────────────────

const TrackCover = memo(
  ({
    src,
    title,
    isActive,
    isLoading = false,
    isCurrentPlaying = false,
    onClick,
  }: {
    src?: string;
    title: string;
    isActive: boolean;
    isLoading?: boolean;
    isCurrentPlaying?: boolean;
    onClick?: (e?: React.MouseEvent) => void;
  }) => (
    <div
      className="relative size-9 shrink-0 rounded-md overflow-hidden bg-[var(--fp-border)]"
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(e);
            }
          : undefined
      }
    >
      <ImageWithFallback
        src={src}
        alt={`${title} cover`}
        className={cn(
          "size-full object-cover transition-all duration-300",
          isActive
            ? "opacity-100 scale-[1.04]"
            : "opacity-55 group-hover:opacity-90 group-hover:scale-[1.04]",
        )}
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center dark:bg-black/40 bg-black/30 backdrop-blur-[1px]"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        animate={{
          opacity:
            (isActive && isLoading) ||
            (isActive && isCurrentPlaying && !isLoading)
              ? 1
              : 0,
        }}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <Loader2 className="size-4 text-foreground animate-spin" />
          ) : isCurrentPlaying ? (
            <Pause className="size-4 text-foreground fill-foreground" />
          ) : (
            <Play className="size-4 text-foreground fill-foreground ml-0.5" />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  ),
  (prev, next) =>
    prev.src === next.src &&
    prev.isActive === next.isActive &&
    prev.isLoading === next.isLoading &&
    prev.isCurrentPlaying === next.isCurrentPlaying,
);
TrackCover.displayName = "TrackCover";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ITEM — Now Playing & History (no drag)
// PERF-1: receives trackId, selects own data
// PERF-3: custom comparator
// ─────────────────────────────────────────────────────────────────────────────

interface QueueItemProps {
  trackId: string;
  queueIndex: number;
  isCurrent: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  onPlay: (e?: React.MouseEvent) => void;
  animate: boolean;
  currentItemRef?: React.RefObject<HTMLDivElement>;
}

const QueueItem = memo(
  ({
    trackId,
    queueIndex,
    isCurrent,
    isLoading,
    isPlaying,
    onPlay,
    animate,
    currentItemRef,
  }: QueueItemProps) => {
    const track = useTrack(trackId);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      },
      [onPlay],
    );

    if (!track) return <QueueSkeleton />;

    return (
      <motion.div
        ref={isCurrent ? currentItemRef : undefined}
        layout="position"
        initial={animate ? { opacity: 0, x: -8 } : false}
        animate={{ opacity: 1, x: 0 }}
        exit={ITEM_EXIT}
        transition={SP.queue}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer",
          "transition-colors duration-150 select-none",
          isCurrent
            ? "bg-[var(--fp-active-bg)]"
            : "hover:bg-[var(--fp-hover-bg)]",
        )}
        onClick={onPlay}
        role="button"
        aria-label={`${track.title} by ${track.artist?.name}${isCurrent ? " (currently playing)" : ""}`}
        aria-current={isCurrent ? "true" : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {isCurrent && (
          <motion.div
            layoutId="queue-accent"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[hsl(var(--primary))]"
            transition={SP.queue}
          />
        )}

        <IndexSlot
          index={queueIndex}
          isActive={isCurrent}
          isPlaying={isPlaying}
          onPlay={(e) => onPlay?.(e)}
        />
        <TrackCover
          src={track.coverImage}
          title={track.title}
          isLoading={isLoading}
          isCurrentPlaying={isPlaying && isCurrent}
          isActive={isCurrent}
          onClick={(e) => onPlay?.(e)}
        />

        <div className="flex-1 min-w-0">
          {isCurrent ? (
            <TrackTitleMarquee
              id={track._id}
              title={track.title}
              mainArtist={track.artist}
              featuringArtists={track.featuringArtists}
              className="text-sm"
              artistClassName="text-xs"
            />
          ) : (
            <p
              title={track.title}
              className={cn(
                "truncate text-sm font-medium leading-snug mb-0.5 transition-colors duration-150",
                "text-foreground",
              )}
            >
              {track.title}
            </p>
          )}

          {/* Artist name — FIX B4: was missing entirely */}
          <div className="min-w-0 truncate text-xs">
            {!isCurrent && (
              <ArtistDisplay
                mainArtist={track.artist}
                featuringArtists={track.featuringArtists}
                className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
              />
            )}
          </div>
        </div>

        <span
          className="text-[10px] text-[var(--fp-fg-subtle)] font-mono shrink-0 group-hover:opacity-0 transition-opacity tabular-nums"
          aria-label={`Duration: ${cachedFormatTime(track.duration ?? 0)}`}
        >
          {cachedFormatTime(track.duration ?? 0)}
        </span>
      </motion.div>
    );
  },
  (prev, next) =>
    prev.trackId === next.trackId &&
    prev.queueIndex === next.queueIndex &&
    prev.onPlay === next.onPlay &&
    prev.animate === next.animate &&
    prev.isCurrent === next.isCurrent &&
    // isPlaying only triggers re-render for the currently playing item
    (!prev.isCurrent || prev.isPlaying === next.isPlaying),
);
QueueItem.displayName = "QueueItem";

// ─────────────────────────────────────────────────────────────────────────────
// DRAG HANDLE — PERF-5: memo prevents re-render when listeners ref is stable
// ─────────────────────────────────────────────────────────────────────────────

interface DragHandleProps {
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
  isDragging?: boolean;
}

const DragHandle = memo(
  ({ listeners, attributes, isDragging }: DragHandleProps) => (
    <button
      {...listeners}
      {...attributes}
      aria-label="Drag to reorder"
      tabIndex={-1}
      className={cn(
        "flex items-center justify-center size-6 rounded-md shrink-0",
        "touch-none select-none",
        "text-[var(--fp-fg-faint)] transition-all duration-150",
        isDragging
          ? "cursor-grabbing text-[var(--fp-fg-muted)]"
          : "cursor-grab hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)]",
        "-mr-1",
      )}
    >
      <GripVertical className="size-3.5" aria-hidden="true" />
    </button>
  ),
);
DragHandle.displayName = "DragHandle";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const QueueSkeleton = memo(() => (
  <div
    aria-hidden="true"
    className="flex items-center gap-3 px-3 py-2 rounded-xl"
  >
    <div className="w-7 h-4 bg-[var(--fp-border)] rounded animate-pulse" />
    <div className="size-9 bg-[var(--fp-border)] rounded-md animate-pulse shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-[var(--fp-border)] rounded animate-pulse w-3/4" />
      <div className="h-2.5 bg-[var(--fp-border)] rounded animate-pulse w-1/2" />
    </div>
  </div>
));
QueueSkeleton.displayName = "QueueSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SORTABLE QUEUE ITEM — Next Up only
// PERF-1: per-item selector
// PERF-3: custom comparator
// PERF-6: memoized style
// ─────────────────────────────────────────────────────────────────────────────

interface SortableQueueItemProps {
  trackId: string;
  queueIndex: number;
  isCurrent: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  onPlay: (e?: React.MouseEvent) => void;
  animate: boolean;
  isOverlay?: boolean;
  overlayTrack?: ITrack; // passed only for DragOverlay instance
}

export const SortableQueueItem = memo(
  ({
    trackId,
    queueIndex,
    isPlaying,
    isCurrent,
    isLoading = false,
    onPlay,
    animate,
    isOverlay = false,
    overlayTrack,
  }: SortableQueueItemProps) => {
    const selectorTrack = useTrack(isOverlay ? "" : trackId);
    const track = isOverlay ? (overlayTrack ?? null) : selectorTrack;

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: trackId, disabled: isOverlay });

    // PERF-6: memoize style — destructure transform fields to avoid object identity issue
    const style = useMemo(
      () => ({
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? "none" : transition,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        transform?.x,
        transform?.y,
        transform?.scaleX,
        transform?.scaleY,
        isDragging,
        transition,
      ],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      },
      [onPlay],
    );

    if (!track) return <QueueSkeleton />;

    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        layout="position"
        initial={animate ? { opacity: 0, x: -8 } : false}
        animate={{ opacity: isDragging ? 0 : 1, x: 0 }}
        exit={ITEM_EXIT}
        transition={SP.queue}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer",
          "transition-colors duration-150 select-none",
          isCurrent
            ? "bg-[var(--fp-active-bg)]"
            : "hover:bg-[var(--fp-hover-bg)]",
          isOverlay &&
            "shadow-2xl ring-1 ring-[var(--fp-border)] bg-[hsl(var(--surface-2))] opacity-95 scale-[1.02]",
        )}
        onClick={onPlay}
        role="button"
        aria-label={`${track.title} by ${track.artist?.name}${isCurrent ? " (currently playing)" : ""}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {isCurrent && (
          <motion.div
            layoutId="queue-accent"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[hsl(var(--primary))]"
            transition={SP.queue}
          />
        )}

        <IndexSlot
          index={queueIndex}
          isActive={isCurrent}
          isPlaying={isPlaying}
          onPlay={(e) => onPlay?.(e)}
        />
        <TrackCover
          src={track.coverImage}
          title={track.title}
          isActive={isCurrent}
          isLoading={isLoading}
          isCurrentPlaying={isPlaying}
          onClick={(e) => onPlay?.(e)}
        />

        <div className="flex-1 min-w-0">
          {isCurrent ? (
            <TrackTitleMarquee
              id={track._id}
              title={track.title}
              mainArtist={track.artist}
              featuringArtists={track.featuringArtists}
              className="text-sm"
              artistClassName="text-xs"
            />
          ) : (
            <p
              title={track.title}
              className={cn(
                "truncate text-sm font-medium leading-snug mb-0.5 transition-colors duration-150",
                "text-foreground",
              )}
            >
              {track.title}
            </p>
          )}

          {/* Artist name — FIX B4: was missing entirely */}
          <div className="min-w-0 truncate text-xs">
            {!isCurrent && (
              <ArtistDisplay
                mainArtist={track.artist}
                featuringArtists={track.featuringArtists}
                className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
              />
            )}
          </div>
        </div>

        <span className="text-[10px] text-[var(--fp-fg-subtle)] font-mono shrink-0 group-hover:opacity-0 transition-opacity tabular-nums">
          {cachedFormatTime(track.duration ?? 0)}
        </span>

        {!isOverlay && (
          <DragHandle
            listeners={listeners}
            attributes={attributes}
            isDragging={isDragging}
          />
        )}
      </motion.div>
    );
  },
  (prev, next) =>
    prev.trackId === next.trackId &&
    prev.queueIndex === next.queueIndex &&
    prev.onPlay === next.onPlay &&
    prev.animate === next.animate &&
    prev.isOverlay === next.isOverlay &&
    prev.isCurrent === next.isCurrent &&
    (!prev.isCurrent || prev.isPlaying === next.isPlaying),
);
SortableQueueItem.displayName = "SortableQueueItem";

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY LIST — PERF-4: cap + CSS content-visibility
// PERF-9: no AnimatePresence (history rarely changes)
// ─────────────────────────────────────────────────────────────────────────────

const HistoryList = memo(
  ({
    entries,
    onPlay,
  }: {
    entries: QueueEntry[];
    onPlay: (i: number, id: string) => void;
  }) => {
    const [showAll, setShowAll] = useState(false);
    const playCallbacks = useStablePlayCallbacks(entries, onPlay);

    // Show most recent N items by default (slice from end)
    const visible = showAll ? entries : entries.slice(-MAX_HISTORY_VISIBLE);
    const hiddenCount = entries.length - visible.length;

    return (
      <div className="opacity-35">
        {hiddenCount > 0 && !showAll && (
          <button
            className="w-full py-2 text-center text-[10px] text-[var(--fp-fg-subtle)] hover:text-[var(--fp-fg)] transition-colors"
            onClick={() => setShowAll(true)}
            aria-label={`Show ${hiddenCount} earlier tracks`}
          >
            + {hiddenCount} earlier tracks
          </button>
        )}
        {visible.map(({ id, index }) => (
          // PERF-4: CSS content-visibility defers rendering for off-screen items
          <div
            key={id}
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: "0 52px",
            }}
          >
            <QueueItem
              trackId={id}
              queueIndex={index}
              isCurrent={false}
              isPlaying={false}
              isLoading={false}
              onPlay={
                playCallbacks.get(`${index}:${id}`) ??
                ((_e?: React.MouseEvent) => onPlay(index, id))
              }
              animate={false}
            />
          </div>
        ))}
      </div>
    );
  },
);
HistoryList.displayName = "HistoryList";

// ─────────────────────────────────────────────────────────────────────────────
// UP NEXT DND SECTION
// PERF-7: stable entries sync
// PERF-8: no trackMetadataCache prop — items self-select
// ─────────────────────────────────────────────────────────────────────────────

interface UpNextDndSectionProps {
  entries: QueueEntry[];
  isLoading: boolean;
  isPlaying: boolean;
  currentTrackId: string | null;
  currentIndex: number;
  onPlay: (index: number, trackId: string) => void;
}

const UpNextDndSection = memo(
  ({
    entries,
    isLoading,
    isPlaying,
    currentTrackId,
    currentIndex,
    onPlay,
  }: UpNextDndSectionProps) => {
    const dispatch = useDispatch();
    const activeQueueIdsRef = useRef<string[]>([]);
    const activeQueueIds = useSelector(
      (s: RootState) => s.player.activeQueueIds,
    );
    activeQueueIdsRef.current = activeQueueIds;

    // PERF-7: stable sync with cached string comparison
    const [localEntries, setLocalEntries] = useState<QueueEntry[]>(entries);
    const prevIdsRef = useRef("");
    useEffect(() => {
      const nextIds = entries.map((e) => e.id).join(",");
      if (nextIds !== prevIdsRef.current) {
        prevIdsRef.current = nextIds;
        setLocalEntries(entries);
      }
    }, [entries]);

    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

    // PERF-1: overlay track from per-id selector
    const activeTrackId = activeId as string | null;
    const activeTrack = useSelector((s: RootState) =>
      activeTrackId
        ? (s.player.trackMetadataCache[activeTrackId] ?? null)
        : null,
    );
    const activeEntry = useMemo(
      () =>
        activeId ? (localEntries.find((e) => e.id === activeId) ?? null) : null,
      [activeId, localEntries],
    );

    // PERF-2: stable callbacks per item
    const playCallbacks = useStablePlayCallbacks(localEntries, onPlay);

    const sensors = useSensors(
      useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
      useSensor(TouchSensor, {
        activationConstraint: { delay: 150, tolerance: 8 },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      }),
    );

    const handleDragStart = useCallback(
      (e: DragStartEvent) => setActiveId(e.active.id),
      [],
    );
    const handleDragCancel = useCallback(() => setActiveId(null), []);

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setLocalEntries((current) => {
          const oldIdx = current.findIndex((e) => e.id === active.id);
          const newIdx = current.findIndex((e) => e.id === over.id);
          if (oldIdx === -1 || newIdx === -1) return current;
          const reordered = arrayMove(current, oldIdx, newIdx);
          const latest = activeQueueIdsRef.current;
          const newIds = [
            ...latest.slice(0, currentIndex + 1),
            ...reordered.map((e) => e.id),
          ];
          if (newIds.length === latest.length) dispatch(reorderQueue(newIds));
          return reordered;
        });
      },
      [dispatch, currentIndex],
    );

    const sortableIds = useMemo(
      () => localEntries.map((e) => e.id),
      [localEntries],
    );

    // PERF: memoize announcements object
    const trackMetadataCache = useSelector(
      (s: RootState) => s.player.trackMetadataCache,
    );
    const announcements = useMemo(
      () => ({
        onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
          `Picked up: ${trackMetadataCache[active.id as string]?.title ?? active.id}`,
        onDragOver: ({
          over,
        }: {
          active: { id: UniqueIdentifier };
          over: { id: UniqueIdentifier } | null;
        }) =>
          over
            ? `Over position ${localEntries.findIndex((e) => e.id === over.id) + 1}`
            : "",
        onDragEnd: ({
          active,
          over,
        }: {
          active: { id: UniqueIdentifier };
          over: { id: UniqueIdentifier } | null;
        }) =>
          over
            ? `${trackMetadataCache[active.id as string]?.title ?? active.id} moved to position ${localEntries.findIndex((e) => e.id === over.id) + 1}`
            : `Dropped`,
        onDragCancel: () => "Drag cancelled",
      }),
      [localEntries, trackMetadataCache],
    );

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements }}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {localEntries.map(({ id, index }, i) => (
              <SortableQueueItem
                isLoading={isLoading}
                key={id}
                trackId={id}
                queueIndex={index}
                isCurrent={id === currentTrackId}
                isPlaying={isPlaying}
                onPlay={
                  playCallbacks.get(`${index}:${id}`) ??
                  ((_e?: React.MouseEvent) => onPlay(index, id))
                }
                animate={i < 30}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        <DragOverlay
          adjustScale={false}
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeTrack && activeEntry ? (
            <SortableQueueItem
              isLoading={isLoading}
              trackId={activeTrackId!}
              overlayTrack={activeTrack}
              queueIndex={activeEntry.index}
              isCurrent={false}
              isPlaying={false}
              onPlay={() => {}}
              animate={false}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  },
);
UpNextDndSection.displayName = "UpNextDndSection";

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PANEL — main component
// ─────────────────────────────────────────────────────────────────────────────

interface QueuePanelProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const QueuePanel = memo(
  ({ onClose, showCloseButton }: QueuePanelProps) => {
    const dispatch = useDispatch();

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
    const { loadingState } = useSelector(selectPlayer); // Subscribe to player state for isActive/isPlaying
    const isGlobalLoading =
      loadingState === "loading" || loadingState === "buffering";
    // PERF-1: only current track's metadata — not whole cache
    const currentTrack = useSelector((s: RootState) =>
      currentTrackId
        ? (s.player.trackMetadataCache[currentTrackId] ?? null)
        : null,
    );

    const scrollRef = useRef<HTMLDivElement>(null);
    // UX-1: direct element ref for scroll target — no DOM query
    const currentItemRef = useRef<HTMLDivElement | null>(null);
    const hasQueue = activeQueueIds.length > 0;

    const upNextEntries = useMemo<QueueEntry[]>(
      () =>
        currentIndex >= 0
          ? activeQueueIds
              .slice(currentIndex + 1)
              .map((id, i) => ({ id, index: currentIndex + 1 + i }))
          : activeQueueIds.map((id, i) => ({ id, index: i })),
      [activeQueueIds, currentIndex],
    );

    const historyEntries = useMemo<QueueEntry[]>(
      () =>
        currentIndex > 0
          ? activeQueueIds
              .slice(0, currentIndex)
              .map((id, i) => ({ id, index: i }))
          : [],
      [activeQueueIds, currentIndex],
    );

    // UX-1: scroll via direct ref, not querySelector
    useLayoutEffect(() => {
      const container = scrollRef.current;
      const el = currentItemRef.current;
      if (!container || !el || !currentTrackId) return;
      const top =
        el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
      container.scrollTo({ top, behavior: "smooth" });
    }, [currentTrackId]);

    const handleItemPlay = useCallback(
      (index: number, trackId: string) => {
        if (currentTrackId === trackId) dispatch(setIsPlaying(!isPlaying));
        else dispatch(jumpToIndex(index));
      },
      [currentTrackId, isPlaying, dispatch],
    );

    // Stable callback for current track play toggle
    const handleCurrentPlay = useCallback(
      () => currentTrack && handleItemPlay(currentIndex, currentTrack._id),
      [handleItemPlay, currentIndex, currentTrack],
    );

    return (
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ListMusic
              className="size-3.5 text-[hsl(var(--primary))]"
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold text-[var(--fp-fg)] truncate leading-snug tracking-[0.18em] uppercase">
              Hàng chờ
            </span>
            {hasQueue && (
              <motion.span
                key={activeQueueIds.length}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SP.snappy}
                className="text-[10px] text-brand bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)] px-1.5 py-0.5 rounded-full font-mono tabular-nums"
                aria-label={`${activeQueueIds.length} bài trong hàng chờ`}
              >
                {activeQueueIds.length}
              </motion.span>
            )}
          </div>
          {showCloseButton && onClose && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="size-7 flex items-center font-semibold text-[var(--fp-fg)] truncate leading-snug justify-center rounded-full text-[var(--fp-fg)] hover:text-[var(--fp-fg-active)] hover:bg-[var(--fp-hover-bg)] transition-colors"
              aria-label="Đóng hàng chờ"
            >
              <X className="size-4" />
            </motion.button>
          )}
        </header>

        {/* ── Scrollable body ── */}
        <div
          ref={scrollRef}
          role="list"
          aria-label="Hàng chờ phát nhạc"
          className="custom-scrollbar queue-scroll flex-1 overflow-y-auto overscroll-contain"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{ touchAction: "pan-y" }}
        >
          {!hasQueue ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center py-16"
            >
              <div className="size-16 rounded-3xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shadow-inner">
                <ListMusic
                  className="size-7 text-white/15"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[13px] font-semibold text-white/30">
                  Hàng chờ trống
                </p>
                <p className="text-[11px] text-white/18">
                  Thêm bài hát để bắt đầu
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="p-2">
              {/* NOW PLAYING */}
              {currentTrack && (
                <>
                  <SectionLabel>Đang phát</SectionLabel>
                  <AnimatePresence mode="popLayout">
                    <QueueItem
                      key={currentTrack._id}
                      trackId={currentTrack._id}
                      queueIndex={currentIndex}
                      isCurrent
                      isLoading={isGlobalLoading}
                      isPlaying={isPlaying}
                      onPlay={handleCurrentPlay}
                      animate
                      currentItemRef={currentItemRef}
                    />
                  </AnimatePresence>
                </>
              )}

              {/* NEXT UP */}
              {upNextEntries.length > 0 && (
                <>
                  <SectionLabel>
                    Tiếp theo
                    <span className="ml-1.5 text-[hsl(var(--primary)/0.4)] normal-case tracking-normal font-normal text-[8px]">
                      {upNextEntries.length} bài · kéo để sắp xếp
                    </span>
                  </SectionLabel>
                  <UpNextDndSection
                    isLoading={isGlobalLoading}
                    entries={upNextEntries}
                    isPlaying={isPlaying}
                    currentTrackId={currentTrackId}
                    currentIndex={currentIndex}
                    onPlay={handleItemPlay}
                  />
                </>
              )}

              {/* HISTORY */}
              {historyEntries.length > 0 && (
                <>
                  <SectionLabel dimmer>
                    Đã phát
                    <span className="ml-1.5 normal-case tracking-normal font-normal text-[8px]">
                      {historyEntries.length} bài
                    </span>
                  </SectionLabel>
                  <HistoryList
                    entries={historyEntries}
                    onPlay={handleItemPlay}
                  />
                </>
              )}

              <div className="h-6" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    );
  },
);

QueuePanel.displayName = "QueuePanel";
export default QueuePanel;
