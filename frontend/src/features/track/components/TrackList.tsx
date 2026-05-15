import React, {
  memo,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { Clock, AlertCircle, RotateCcw, Music2 } from "lucide-react";
import { shallowEqual } from "react-redux";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TrackRow } from "./TrackRow";
import {
  setQueue,
  setIsPlaying,
  jumpToIndex,
} from "@/features/player/slice/playerSlice";
import type { QueueSourceType } from "@/features/player/slice/playerSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────

const ROW_H = 56; // px — used as estimateSize, not enforced
const SKELETON_BATCH = 3;
const RESIZE_DEBOUNCE_MS = 150;
const SCROLL_RESTORE_KEY_PREFIX = "tracklist-scroll:";

const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

// Stable colgroup — same reference every render, React skips reconciliation
// Render `col` elements as an array inside <colgroup> to avoid
// accidental whitespace text nodes (which are invalid children of
// <colgroup> and cause hydration errors).
const COLGROUP = (
  <colgroup>
    {[
      <col key="c-1" style={{ width: "2rem" }} />,
      <col key="c-2" />,
      <col
        key="c-3"
        style={{ width: "200px" }}
        className="hidden md:table-column"
      />,
      <col key="c-4" style={{ width: "2.5rem" }} />,
      <col key="c-5" style={{ width: "4rem" }} />,
    ]}
  </colgroup>
);

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface TrackListProps {
  tracks: ITrack[];
  allTrackIds?: string[];
  totalItems?: number;
  isLoading?: boolean;
  error?: Error | null;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onFetchNextPage?: () => void;
  onRetry?: () => void;
  onTrackPlay?: (track: ITrack, index: number) => void;
  onContextMenu?: (track: ITrack, anchor: HTMLElement) => void;
  className?: string;
  showHeader?: boolean;
  skeletonCount?: number;
  maxHeight?: number | "auto";
  overscan?: number;
  staggerAnimation?: boolean;
  moodColor?: string;
  /** Stable ID for scroll restoration. Defaults to "default". */
  listId?: string;
  enableSelection?: boolean;
  /** Optional source context to preserve when playing within a collection */
  source?: { id: string; type: QueueSourceType; title?: string; url?: string };
}

// ─────────────────────────────────────────────────────────────
// useCallbackRef — gives a stable function reference that always
// calls the latest version of the callback without being in deps.
// Solves the #2 problem described above (stable play handler).
// ─────────────────────────────────────────────────────────────

function useCallbackRef<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
): T {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback(
    (...args: Parameters<T>) => ref.current?.(...args),
    [],
  ) as T;
}

// ─────────────────────────────────────────────────────────────
// TrackSkeleton — deterministic widths, no randomness
// ─────────────────────────────────────────────────────────────

const TrackSkeleton = memo(({ index }: { index: number }) => {
  const i10 = index % 10;
  const titleW = 45 + (index % 4) * 12;
  const artistW = 28 + (index % 3) * 10;
  const albumW = 35 + (index % 5) * 8;
  const opacity = Math.max(0.12, 1 - i10 * 0.08);
  const d = (extra = 0) =>
    prefersReducedMotion ? {} : { animationDelay: `${i10 * 55 + extra}ms` };

  return (
    <TableRow
      aria-hidden="true"
      className="h-14 border-b border-border/[0.05] hover:bg-transparent last:border-b-0"
      style={{ opacity }}
    >
      <TableCell className="w-12 p-0">
        <div className="flex h-14 items-center justify-center">
          <div className="skeleton size-3 rounded-sm" style={d()} />
        </div>
      </TableCell>
      <TableCell className="py-0 pl-1 pr-4">
        <div className="flex items-center gap-3">
          <div className="skeleton size-10 shrink-0 rounded-md" style={d()} />
          <div className="flex flex-col gap-1.5 flex-1">
            <div
              className="skeleton h-[11px] rounded-sm"
              style={{ width: `${titleW}%`, ...d(70) }}
            />
            <div
              className="skeleton h-[9px] rounded-sm"
              style={{ width: `${artistW}%`, opacity: 0.65, ...d(140) }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell py-0 pr-4">
        <div
          className="skeleton h-[9px] rounded-sm"
          style={{ width: `${albumW}%`, opacity: 0.5, ...d(200) }}
        />
      </TableCell>
      <TableCell className="py-0 pr-1">
        <div className="flex justify-center">
          <div
            className="skeleton size-6 rounded-full"
            style={{ opacity: 0.4, ...d(240) }}
          />
        </div>
      </TableCell>
      <TableCell className="py-0 pr-3">
        <div className="flex justify-end">
          <div
            className="skeleton h-[9px] w-9 rounded-sm"
            style={{ opacity: 0.5, ...d(280) }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});
TrackSkeleton.displayName = "TrackSkeleton";

// ─────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <TableRow className="hover:bg-transparent border-0">
    <TableCell colSpan={5} className="p-0 border-0">
      <div className="flex flex-col items-center justify-center gap-5 py-20 sm:py-24 animate-fade-up">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-border/40 shadow-sm">
          <Music2
            className="size-6 text-muted-foreground/40"
            aria-hidden="true"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground/70">
            Danh sách trống
          </p>
          <p className="text-xs text-muted-foreground/50 max-w-[200px] mx-auto leading-relaxed">
            Chưa có bài hát nào. Hãy thêm nhạc để bắt đầu.
          </p>
        </div>
      </div>
    </TableCell>
  </TableRow>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// ErrorState
// ─────────────────────────────────────────────────────────────

const ErrorState = memo(({ onRetry }: { onRetry?: () => void }) => (
  <TableRow className="hover:bg-transparent border-0">
    <TableCell colSpan={5} className="p-0 border-0">
      <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-up">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/8 border border-destructive/15">
          <AlertCircle
            className="size-5 text-destructive/60"
            aria-hidden="true"
          />
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-sm font-medium text-foreground/80">
            Không thể tải danh sách
          </p>
          <p className="text-xs text-muted-foreground/50">
            Đã có lỗi xảy ra khi tải bài hát.
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg",
              "text-xs font-medium text-foreground/70",
              "bg-muted/80 hover:bg-muted border border-border/50",
              "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Thử lại
          </button>
        )}
      </div>
    </TableCell>
  </TableRow>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────
// ColumnHeaders — sticky, backdrop-blur
// ─────────────────────────────────────────────────────────────

const ColumnHeaders = memo(
  ({
    totalItems,
    loadedCount,
    selectedCount,
  }: {
    totalItems?: number;
    loadedCount?: number;
    selectedCount?: number;
  }) => {
    const showBadge = !!totalItems && totalItems > 0;
    const isPartial = loadedCount != null && loadedCount < (totalItems ?? 0);

    return (
      <TableHeader>
        <TableRow
          className="hover:bg-transparent"
          style={{
            background: "transparent",
            WebkitBackdropFilter: "blur(20px)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid hsl(var(--border) / 0.18)",
          }}
        >
          <TableHead className="w-12 p-0 h-9">
            <div className="flex h-9 items-center justify-center">
              <span className="text-[11px] font-medium text-muted-foreground/50 tabular-nums">
                #
              </span>
            </div>
          </TableHead>
          <TableHead className="pl-1 pr-4 h-9">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Bài hát
              </span>
              {selectedCount != null && selectedCount > 0 ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full tabular-nums leading-none text-[10px] font-medium bg-primary/15 text-primary/70 border border-primary/20">
                  {selectedCount} đã chọn
                </span>
              ) : (
                showBadge && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full tabular-nums leading-none text-[10px] font-medium bg-primary/8 text-primary/50 border border-primary/12">
                    {isPartial ? `${loadedCount} / ${totalItems}` : totalItems}
                  </span>
                )
              )}
            </div>
          </TableHead>
          <TableHead className="hidden md:table-cell pr-4 h-9">
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              Album
            </span>
          </TableHead>
          <TableHead className="pr-1 h-9" />
          <TableHead className="pr-3 h-9">
            <div className="flex items-center justify-center">
              <Clock
                className="size-3 text-muted-foreground/50"
                aria-label="Thời lượng"
              />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
    );
  },
);
ColumnHeaders.displayName = "ColumnHeaders";

// ─────────────────────────────────────────────────────────────
// ScrollProgressBar — RAF-driven, imperative DOM update
// Decision: using style.transform instead of useState avoids
// React render cycles on every scroll event (~60fps).
// ─────────────────────────────────────────────────────────────

const ScrollProgressBar = memo(
  ({
    containerRef,
  }: {
    containerRef: React.RefObject<HTMLDivElement | null>;
  }) => {
    const fillRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || prefersReducedMotion) return;

      const update = () => {
        const max = container.scrollHeight - container.clientHeight;
        if (!fillRef.current || max <= 0) {
          if (fillRef.current) fillRef.current.style.transform = "scaleX(0)";
          return;
        }
        const pct = Math.min(1, container.scrollTop / max);
        fillRef.current.style.transform = `scaleX(${pct})`;
      };

      const onScroll = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(update);
      };

      container.addEventListener("scroll", onScroll, { passive: true });
      update(); // Initial paint
      return () => {
        cancelAnimationFrame(rafRef.current);
        container.removeEventListener("scroll", onScroll);
      };
    }, [containerRef]);

    if (prefersReducedMotion) return null;

    return (
      <div
        className="absolute top-[39px] inset-x-0 h-px z-20 overflow-hidden"
        aria-hidden="true"
      >
        <div
          ref={fillRef}
          className="h-full origin-left bg-linear-to-r from-primary/40 via-primary/70 to-primary/40"
          style={{
            transform: "scaleX(0)",
            transition: "transform 80ms linear",
          }}
        />
      </div>
    );
  },
);
ScrollProgressBar.displayName = "ScrollProgressBar";

// ─────────────────────────────────────────────────────────────
// FetchingIndicator
// ─────────────────────────────────────────────────────────────

const FetchingIndicator = memo(() => (
  <div className="flex items-center justify-center gap-2 py-3 animate-fade-up">
    <div className="flex gap-[3px] items-end h-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary/40 animate-bounce"
          style={{
            height: `${8 + i * 2}px`,
            animationDelay: prefersReducedMotion ? "0ms" : `${i * 100}ms`,
            animationDuration: "0.8s",
            animationPlayState: prefersReducedMotion ? "paused" : "running",
          }}
        />
      ))}
    </div>
    <span className="text-[11px] text-muted-foreground/50 font-medium">
      Đang tải thêm
    </span>
  </div>
));
FetchingIndicator.displayName = "FetchingIndicator";

// ─────────────────────────────────────────────────────────────
// VirtualTableBody — isolated memo to prevent full-list re-render
// when only player state (activeId / isPlaying) changes.
// Custom areEqual checks each prop explicitly.
// ─────────────────────────────────────────────────────────────

interface VirtualTableBodyProps {
  virtualItems: ReturnType<
    ReturnType<typeof useVirtualizer>["getVirtualItems"]
  >;
  totalVirtualH: number;
  tracks: ITrack[];
  activeId: string | null;
  isPlaying: boolean;
  selectedIds: Set<string>;
  staggerAnimation: boolean;
  onPlay: (track: ITrack, index: number) => void;
  onSelect?: (id: string, mode: "single" | "range" | "toggle") => void;
  onContextMenu?: (track: ITrack, anchor: HTMLElement) => void;
  onNavigate?: (index: number, direction: "up" | "down") => void;
}

function virtualBodyAreEqual(
  prev: VirtualTableBodyProps,
  next: VirtualTableBodyProps,
) {
  if (prev.virtualItems !== next.virtualItems) return false;
  if (prev.totalVirtualH !== next.totalVirtualH) return false;
  if (prev.tracks !== next.tracks) return false;
  if (prev.activeId !== next.activeId) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.selectedIds !== next.selectedIds) return false;
  if (prev.staggerAnimation !== next.staggerAnimation) return false;
  if (prev.onPlay !== next.onPlay) return false;
  if (prev.onSelect !== next.onSelect) return false;
  if (prev.onContextMenu !== next.onContextMenu) return false;
  if (prev.onNavigate !== next.onNavigate) return false;
  return true;
}

const VirtualTableBody = memo(
  ({
    virtualItems,
    totalVirtualH,
    tracks,
    activeId,
    isPlaying,
    selectedIds,
    staggerAnimation,
    onPlay,
    onSelect,
    onContextMenu,
    onNavigate,
  }: VirtualTableBodyProps) => {
    const first = virtualItems[0];
    const last = virtualItems[virtualItems.length - 1];
    const topH = first && first.start > 0 ? first.start : 0;
    const botH = last ? totalVirtualH - last.end : 0;

    return (
      <TableBody>
        {topH > 0 && <tr aria-hidden="true" style={{ height: topH }} />}

        {virtualItems.map((vRow) => {
          const track = tracks[vRow.index];

          if (!track) {
            return (
              <TrackSkeleton key={`sk-tail-${vRow.index}`} index={vRow.index} />
            );
          }

          return (
            <TrackRow
              key={track._id}
              track={track}
              index={vRow.index}
              isActive={activeId === track._id}
              isPlaying={isPlaying}
              isSelected={selectedIds.has(track._id)}
              onPlay={() => onPlay(track, vRow.index)}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onNavigate={
                onNavigate ? (dir) => onNavigate(vRow.index, dir) : undefined
              }
              animationDelay={
                staggerAnimation && !prefersReducedMotion
                  ? Math.min(vRow.index * 24, 240)
                  : 0
              }
            />
          );
        })}

        {botH > 0 && <tr aria-hidden="true" style={{ height: botH }} />}
      </TableBody>
    );
  },
  virtualBodyAreEqual,
);
VirtualTableBody.displayName = "VirtualTableBody";

// ─────────────────────────────────────────────────────────────
// TrackList — main export
// ─────────────────────────────────────────────────────────────

export const TrackList = memo(
  ({
    tracks,
    allTrackIds,
    totalItems = 0,
    isLoading = false,
    error = null,
    isFetchingNextPage = false,
    hasNextPage = false,
    onFetchNextPage,
    onRetry,
    onTrackPlay,
    onContextMenu,
    className,
    moodColor = "hsl(var(--primary))",
    showHeader = true,
    skeletonCount = 10,
    maxHeight = "auto",
    overscan = 6,
    staggerAnimation = true,
    listId = "default",
    enableSelection = false,
    source,
  }: TrackListProps) => {
    const dispatch = useAppDispatch();

    // ── Redux state: minimal selector, shallow equal ────────────
    const { currentTrackId, isPlaying, currentSource } = useAppSelector(
      (s) => ({
        currentTrackId: s.player.currentTrackId,
        isPlaying: s.player.isPlaying,
        currentSource: s.player.currentSource,
      }),
      shallowEqual,
    );

    // ── Local UI state ─────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const activeId = currentTrackId;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const scrollMarginRef = useRef(0);
    const lastSelectedIndexRef = useRef<number>(-1);

    const isFixedHeight = maxHeight !== "auto";
    const isEmpty = !isLoading && !error && tracks.length === 0;
    const skeletonRows = isFetchingNextPage ? SKELETON_BATCH : 0;
    const virtualCount = tracks.length + skeletonRows;

    // ── Stable data refs — track latest without causing re-renders
    const trackIdsRef = useRef<string[]>([]);
    useEffect(() => {
      trackIdsRef.current = allTrackIds ?? tracks.map((t) => t._id);
    }, [allTrackIds, tracks]);

    const tracksRef = useRef<ITrack[]>(tracks);
    useEffect(() => {
      tracksRef.current = tracks;
    }, [tracks]);

    // Volatile player state in refs — read at call time in stable handler
    const activeIdRef = useRef(activeId);
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => {
      activeIdRef.current = activeId;
      isPlayingRef.current = isPlaying;
    }, [activeId, isPlaying]);

    // Keep latest source in a ref so the stable play handler can read it
    const currentSourceRef = useRef(currentSource);
    useEffect(() => {
      currentSourceRef.current = currentSource;
    }, [currentSource]);

    // Keep latest prop source in a ref too (optional)
    const sourceRef = useRef<
      | { id: string; type: QueueSourceType; title?: string; url?: string }
      | undefined
    >(source);
    useEffect(() => {
      sourceRef.current = source;
    }, [source]);

    // ── Scroll margin: captured once after mount ────────────────
    useLayoutEffect(() => {
      if (!isFixedHeight) {
        scrollMarginRef.current = scrollContainerRef.current?.offsetTop ?? 0;
      }
    }, [isFixedHeight]);

    // ── Scroll restoration ──────────────────────────────────────
    const scrollKey = `${SCROLL_RESTORE_KEY_PREFIX}${listId}`;

    useLayoutEffect(() => {
      if (!isFixedHeight || isLoading) return;
      const saved = sessionStorage.getItem(scrollKey);
      if (saved && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = parseInt(saved, 10);
      }
    }, [isFixedHeight, isLoading, scrollKey]);

    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container || !isFixedHeight) return;

      const save = () => {
        sessionStorage.setItem(scrollKey, String(container.scrollTop));
      };

      // Save on unmount and on visibility change (tab switch, navigation)
      window.addEventListener("beforeunload", save);
      document.addEventListener("visibilitychange", save);
      return () => {
        save();
        window.removeEventListener("beforeunload", save);
        document.removeEventListener("visibilitychange", save);
      };
    }, [isFixedHeight, scrollKey]);

    // ── Virtualizer ────────────────────────────────────────────
    const fixedVirtualizer = useVirtualizer({
      count: isFixedHeight ? virtualCount : 0,
      getScrollElement: () =>
        isFixedHeight ? scrollContainerRef.current : null,
      estimateSize: () => ROW_H,
      overscan,
      enabled: isFixedHeight,
    });

    const windowVirtualizer = useWindowVirtualizer({
      count: !isFixedHeight ? virtualCount : 0,
      estimateSize: () => ROW_H,
      overscan,
      scrollMargin: scrollMarginRef.current,
      enabled: !isFixedHeight,
    });

    const virtualizer = isFixedHeight ? fixedVirtualizer : windowVirtualizer;
    const virtualItems = virtualizer.getVirtualItems();
    const totalVirtualH = virtualizer.getTotalSize();

    // ── Resize observer: update scroll margin for window mode ───
    useEffect(() => {
      if (isFixedHeight) return;
      const container = scrollContainerRef.current;
      if (!container || typeof ResizeObserver === "undefined") return;

      let debounce: ReturnType<typeof setTimeout>;
      const observer = new ResizeObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          scrollMarginRef.current = container.offsetTop;
        }, RESIZE_DEBOUNCE_MS);
      });

      observer.observe(container);
      return () => {
        clearTimeout(debounce);
        observer.disconnect();
      };
    }, [isFixedHeight]);

    // ── Infinite scroll sentinel ────────────────────────────────
    const onFetchNextPageStable = useCallbackRef(onFetchNextPage);

    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel || !hasNextPage || isFetchingNextPage) return;

      const root = isFixedHeight ? scrollContainerRef.current : null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) onFetchNextPageStable?.();
        },
        { root, rootMargin: "300px", threshold: 0 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, isFixedHeight, onFetchNextPageStable]);

    // ── STABLE play handler (key optimization) ─────────────────
    // This function's identity NEVER changes (no deps array items that change).
    // It reads volatile values from refs at call time.
    // Without this pattern, every player state change recreates the callback,
    // which propagates through memo to every visible TrackRow.
    const handlePlayTrack = useCallback(
      (track: ITrack, index: number) => {
        if (activeIdRef.current === track._id) {
          dispatch(setIsPlaying(!isPlayingRef.current));
          onTrackPlay?.(track, index);
          return;
        }

        // Resolve index in the full id list when possible (handles paged lists)
        const resolvedIndex =
          trackIdsRef.current.indexOf(track._id) !== -1
            ? trackIdsRef.current.indexOf(track._id)
            : index;

        // If a `source` prop was provided and it matches the current player
        // source, just jump to the index to preserve collection state/animation.
        const propSource = sourceRef.current;
        const playingSource = currentSourceRef.current;
        const isSameCollection =
          propSource &&
          playingSource &&
          propSource.id === playingSource.id &&
          propSource.type === playingSource.type;

        if (isSameCollection) {
          dispatch(jumpToIndex(resolvedIndex));
          onTrackPlay?.(track, resolvedIndex);
          return;
        }

        // Default: set a fresh queue for this list, using provided source if any
        dispatch(
          setQueue({
            trackIds: trackIdsRef.current,
            initialMetadata: tracksRef.current,
            startIndex: resolvedIndex,
            isShuffling: false,
            source: propSource ?? {
              id: track._id,
              type: "single",
              title: track.title,
              url: "",
            },
          }),
        );

        onTrackPlay?.(track, resolvedIndex);
      },
      // Keep handler stable: only dispatch is required; state refs used for volatile values
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [dispatch],
    );

    // ── Selection handler ───────────────────────────────────────
    const handleSelect = useCallback(
      (id: string, mode: "single" | "range" | "toggle") => {
        if (!enableSelection) return;

        setSelectedIds((prev) => {
          const next = new Set(prev);
          const idx = tracksRef.current.findIndex((t) => t._id === id);

          if (mode === "toggle") {
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
              lastSelectedIndexRef.current = idx;
            }
          } else if (mode === "range" && lastSelectedIndexRef.current >= 0) {
            const start = Math.min(lastSelectedIndexRef.current, idx);
            const end = Math.max(lastSelectedIndexRef.current, idx);
            for (let i = start; i <= end; i++) {
              const t = tracksRef.current[i];
              if (t) next.add(t._id);
            }
          } else {
            // Single: clear and select one
            next.clear();
            next.add(id);
            lastSelectedIndexRef.current = idx;
          }

          return next;
        });
      },
      [enableSelection],
    );

    // ── Keyboard navigation between rows ────────────────────────
    // Focuses the adjacent row's DOM element without scrollIntoView (virtualizer
    // handles scroll). The virtualizer must have the target row rendered, so we
    // scrollToIndex first if needed.
    const handleNavigate = useCallback(
      (currentIndex: number, direction: "up" | "down") => {
        const targetIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= tracks.length) return;

        virtualizer.scrollToIndex(targetIndex, { align: "auto" });

        // Focus after virtualizer renders the row (next frame)
        requestAnimationFrame(() => {
          const container = scrollContainerRef.current ?? document;
          const rows = container.querySelectorAll<HTMLElement>(
            "[role='row'][tabindex='0']",
          );
          // rows are in DOM order which matches virtual item order
          rows[targetIndex]?.focus({ preventScroll: true });
        });
      },
      [tracks.length, virtualizer],
    );

    // ── Escape clears selection ─────────────────────────────────
    useEffect(() => {
      if (!enableSelection) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setSelectedIds(new Set());
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [enableSelection]);

    // ── Memoized skeleton indices ───────────────────────────────
    const skeletons = useMemo(
      () => Array.from({ length: skeletonCount }, (_, i) => i),
      [skeletonCount],
    );

    const scrollStyle = useMemo<React.CSSProperties>(
      () =>
        isFixedHeight
          ? {
              maxHeight: `${maxHeight}px`,
              overflowY: "auto",
              overflowX: "hidden",
            }
          : { overflowX: "hidden" },
      [isFixedHeight, maxHeight],
    );

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────

    return (
      <div
        className={cn(
          "relative rounded-2xl flex flex-col",
          "border border-border/40 dark:border-white/[0.07]",
          "shadow-brand-dynamic",
          "animate-fade-up animation-fill-both",
        )}
        style={
          {
            animationDelay: "80ms",
            "--local-shadow-color": moodColor || "hsl(var(--primary))",
          } as React.CSSProperties
        }
        role="grid"
        aria-label="Danh sách bài hát"
        aria-rowcount={totalItems || tracks.length}
      >
        {isFixedHeight && (
          <ScrollProgressBar containerRef={scrollContainerRef} />
        )}

        {/* ── Sticky header (outside scroll container to stay fixed) */}
        {showHeader && (
          <div className="px-2 pt-2 shrink-0">
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
              {COLGROUP}
              <ColumnHeaders
                totalItems={totalItems || tracks.length}
                loadedCount={tracks.length}
                selectedCount={selectedIds.size}
              />
            </Table>
          </div>
        )}

        {/* ── Scroll container ────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          className={cn("px-2 pb-2 flex-1", className)}
          style={scrollStyle}
          // Momentum scrolling on iOS
          // @ts-expect-error — vendor prefix
          css={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* CASE 1 — Initial loading skeleton */}
          {isLoading && (
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
              {COLGROUP}
              <TableBody>
                {skeletons.map((i) => (
                  <TrackSkeleton key={`sk-init-${i}`} index={i} />
                ))}
              </TableBody>
            </Table>
          )}

          {/* CASE 2 — Error */}
          {!isLoading && !!error && (
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
              {COLGROUP}
              <TableBody>
                <ErrorState onRetry={onRetry} />
              </TableBody>
            </Table>
          )}

          {/* CASE 3 — Empty */}
          {isEmpty && (
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
              {COLGROUP}
              <TableBody>
                <EmptyState />
              </TableBody>
            </Table>
          )}

          {/* CASE 4 — Virtual list */}
          {!isLoading && !error && tracks.length > 0 && (
            <>
              {/*
               * No height on <Table> — only spacer <tr> rows drive the total
               * scroll height. Setting height here would double-count.
               */}
              <Table
                className="w-full border-collapse"
                style={{ tableLayout: "fixed" }}
              >
                {COLGROUP}
                <VirtualTableBody
                  virtualItems={virtualItems}
                  totalVirtualH={totalVirtualH}
                  tracks={tracks}
                  activeId={activeId}
                  isPlaying={isPlaying}
                  selectedIds={selectedIds}
                  staggerAnimation={staggerAnimation}
                  onPlay={handlePlayTrack}
                  onSelect={enableSelection ? handleSelect : undefined}
                  onContextMenu={onContextMenu}
                  onNavigate={handleNavigate}
                />
              </Table>

              {/* Infinite scroll trigger point */}
              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

              {/* Bottom status bar */}
              <div className="flex items-center justify-center min-h-[44px]">
                {isFetchingNextPage && <FetchingIndicator />}

                {!hasNextPage && !isFetchingNextPage && tracks.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/30 tabular-nums font-medium">
                    {tracks.length}
                    {totalItems > 0 && tracks.length < totalItems
                      ? ` / ${totalItems}`
                      : ""}{" "}
                    bài hát
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  },
);

TrackList.displayName = "TrackList";
export default TrackList;
