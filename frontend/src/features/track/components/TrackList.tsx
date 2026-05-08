import React, {
  memo,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
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

// Eager import — no Suspense flicker while scrolling
import { TrackRow } from "./TrackRow";

import { setQueue, setIsPlaying } from "@/features/player/slice/playerSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────
// Types
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
  className?: string;
  showHeader?: boolean;
  skeletonCount?: number;
  maxHeight?: number | "auto";
  overscan?: number;
  staggerAnimation?: boolean;
  moodColor: string;
}

// ─────────────────────────────────────────────────────────────
// Constants — defined outside component, zero GC pressure
// ─────────────────────────────────────────────────────────────

const ROW_H = 56;
const SKELETON_BATCH = 3;

const COLGROUP = (
  <colgroup>
    <col style={{ width: "2rem" }} />
    <col />
    <col style={{ width: "200px" }} className="hidden md:table-column" />
    <col style={{ width: "4rem" }} />
  </colgroup>
);

// ─────────────────────────────────────────────────────────────
// TrackSkeleton
// ─────────────────────────────────────────────────────────────

const TrackSkeleton = memo(({ index }: { index: number }) => {
  // Widths computed deterministically per index — no randomness, no hydration mismatch
  const i10 = index % 10;
  const titleW = 45 + (index % 4) * 12;
  const artistW = 28 + (index % 3) * 10;
  const albumW = 35 + (index % 5) * 8;
  const opacity = Math.max(0.12, 1 - i10 * 0.08);
  const d = (extra = 0) => ({ animationDelay: `${i10 * 55 + extra}ms` });

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
            className="skeleton size-7 rounded-full"
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
// EmptyState — refined, minimal
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
// ErrorState — compact, actionable
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
            <RotateCcw className="size-3" />
            Thử lại
          </button>
        )}
      </div>
    </TableCell>
  </TableRow>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────
// ColumnHeaders — sticky, blurred, refined
// ─────────────────────────────────────────────────────────────

const ColumnHeaders = memo(
  ({
    totalItems,
    loadedCount,
  }: {
    totalItems?: number;
    loadedCount?: number;
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
              {showBadge && (
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded-full tabular-nums leading-none",
                    "text-[10px] font-medium",
                    "bg-primary/8 text-primary/50 border border-primary/12",
                  )}
                >
                  {isPartial ? `${loadedCount} / ${totalItems}` : totalItems}
                </span>
              )}
            </div>
          </TableHead>
          <TableHead className="hidden md:table-cell pr-4 h-9">
            <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              Album
            </span>
          </TableHead>

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
// ScrollProgressBar — 1px, RAF-driven, imperative
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
      if (!container) return;

      const update = () => {
        const max = container.scrollHeight - container.clientHeight;
        if (!fillRef.current) return;
        if (max <= 0) {
          fillRef.current.style.transform = "scaleX(0)";
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
      return () => {
        cancelAnimationFrame(rafRef.current);
        container.removeEventListener("scroll", onScroll);
      };
    }, [containerRef]);

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
// VirtualTableBody — custom areEqual to skip unnecessary renders
// ─────────────────────────────────────────────────────────────

interface VirtualTableBodyProps {
  virtualItems: ReturnType<
    ReturnType<typeof useVirtualizer>["getVirtualItems"]
  >;
  totalVirtualH: number;
  tracks: ITrack[];
  activeId: string | null;
  isPlaying: boolean;
  staggerAnimation: boolean;
  onPlay: (track: ITrack, index: number) => void;
}

function virtualBodyAreEqual(
  prev: VirtualTableBodyProps,
  next: VirtualTableBodyProps,
) {
  // Re-render only when virtual window, data, or player state changes
  if (prev.virtualItems !== next.virtualItems) return false;
  if (prev.totalVirtualH !== next.totalVirtualH) return false;
  if (prev.tracks !== next.tracks) return false;
  if (prev.activeId !== next.activeId) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.staggerAnimation !== next.staggerAnimation) return false;
  if (prev.onPlay !== next.onPlay) return false;
  return true;
}

const VirtualTableBody = memo(
  ({
    virtualItems,
    totalVirtualH,
    tracks,
    activeId,
    isPlaying,
    staggerAnimation,
    onPlay,
  }: VirtualTableBodyProps) => {
    const first = virtualItems[0];
    const last = virtualItems[virtualItems.length - 1];
    const topH = first && first.start > 0 ? first.start : 0;
    const botH = last ? totalVirtualH - last.end : 0;

    return (
      <TableBody style={{ display: "table-row-group" }}>
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
              onPlay={() => onPlay(track, vRow.index)}
              animationDelay={
                staggerAnimation ? Math.min(vRow.index * 24, 240) : 0
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
// FetchingIndicator — separated for clean rendering
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
            animationDelay: `${i * 100}ms`,
            animationDuration: "0.8s",
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
    className,
    moodColor = "",
    showHeader = true,
    skeletonCount = 10,
    maxHeight = "auto",
    overscan = 6,
    staggerAnimation = true,
  }: TrackListProps) => {
    const dispatch = useAppDispatch();

    const { currentTrackId, isPlaying } = useAppSelector(
      (s) => ({
        currentTrackId: s.player.currentTrackId,
        isPlaying: s.player.isPlaying,
      }),
      shallowEqual,
    );

    const activeId = currentTrackId;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const scrollMarginRef = useRef(0);

    const isFixedHeight = maxHeight !== "auto";
    const isEmpty = !isLoading && !error && tracks.length === 0;
    const skeletonRows = isFetchingNextPage ? SKELETON_BATCH : 0;
    const virtualCount = tracks.length + skeletonRows;

    // Stable refs — prevent callback recreation when data grows
    const trackIdsRef = useRef<string[]>([]);
    useEffect(() => {
      trackIdsRef.current = allTrackIds ?? tracks.map((t) => t._id);
    }, [allTrackIds, tracks]);

    const tracksRef = useRef<ITrack[]>(tracks);
    useEffect(() => {
      tracksRef.current = tracks;
    }, [tracks]);

    // Capture scrollMargin once after mount (stable, not stale)
    useLayoutEffect(() => {
      if (!isFixedHeight) {
        scrollMarginRef.current = scrollContainerRef.current?.offsetTop ?? 0;
      }
    }, [isFixedHeight]);

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

    // ── Sentinel (IntersectionObserver) ────────────────────────
    const onFetchNextPageRef = useRef(onFetchNextPage);
    useEffect(() => {
      onFetchNextPageRef.current = onFetchNextPage;
    }, [onFetchNextPage]);

    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel || !hasNextPage || isFetchingNextPage) return;

      const root = isFixedHeight ? scrollContainerRef.current : null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) onFetchNextPageRef.current?.();
        },
        { root, rootMargin: "300px", threshold: 0 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, isFixedHeight]);

    // ── Play handler ───────────────────────────────────────────
    const handlePlayTrack = useCallback(
      (track: ITrack, index: number) => {
        if (activeId === track._id) {
          dispatch(setIsPlaying(!isPlaying));
        } else {
          dispatch(
            setQueue({
              trackIds: trackIdsRef.current,
              initialMetadata: tracksRef.current,
              startIndex: index,
              isShuffling: false,
              source: {
                id: track._id,
                type: "single",
                title: track.title,
                url: "",
              },
            }),
          );
        }
        onTrackPlay?.(track, index);
      },
      [dispatch, activeId, isPlaying, onTrackPlay],
    );

    // ── Memoized values ────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────

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
            "--local-shadow-color": moodColor || "var(--primary)",
          } as React.CSSProperties
        }
      >
        {isFixedHeight && (
          <ScrollProgressBar containerRef={scrollContainerRef} />
        )}

        {/* ── Sticky header (outside scroll container) ──────── */}
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
              />
            </Table>
          </div>
        )}

        {/* ── Scroll container ──────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          role="region"
          aria-label="Danh sách bài hát"
          className={cn("px-2 pb-2 flex-1", className)}
          style={scrollStyle}
        >
          {/* CASE 1 — Initial skeleton */}
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
              {/**
               * @fix #4 — NO height on <Table>
               * Only spacer <tr> rows drive scroll height — avoids double-counting.
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
                  staggerAnimation={staggerAnimation}
                  onPlay={handlePlayTrack}
                />
              </Table>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

              {/* Bottom status */}
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
