/**
 * @file TrackList.tsx — Virtual + Infinite Scroll
 *
 * @architecture
 *   Hai chế độ scroll:
 *   ─ maxHeight="auto"  → window scroll (useWindowVirtualizer)
 *   ─ maxHeight={number} → fixed height container scroll (useVirtualizer)
 *
 *   Data flow:
 *   ─ allTrackIds  ← toàn bộ IDs từ album (biết ngay, không cần fetch hết)
 *   ─ tracks       ← data.allTracks (flat từ infinite pages, lazy loaded)
 *   ─ totalItems   ← album.totalTracks (cho header badge)
 *   ─ isLoading    ← chỉ true khi chưa có page 1
 *
 * @fixes (production hardening)
 *   1. setQueue sai signature → { trackIds: string[], initialMetadata, startIndex }
 *   2. currentTrack không tồn tại trong slice state → selectCurrentTrack selector
 *   3. handlePlayTrack closure stale tracks → allTrackIds prop + trackIds ref
 *   4. height trên <Table> conflict với virtual spacer rows → xóa, chỉ dùng spacer <tr>
 *   5. Skeleton tail index → dùng vRow.index trực tiếp cho animation delay liên tục
 *   6. Window scroll getScrollElement: null → useWindowVirtualizer
 *   7. onTrackPlay gọi trước dispatch → swap thứ tự, dispatch trước
 */

import React, {
  memo,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { Clock, Disc3, AlertCircle, RefreshCw } from "lucide-react";
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
import { setQueue, setIsPlaying } from "@/features/player/slice/playerSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TrackListProps {
  /** Flat array đã load — từ data.allTracks của useAlbumTracksInfinite */
  tracks: ITrack[];
  /**
   * @fix #1 #3 — Toàn bộ IDs của album/playlist (biết ngay từ album meta).
   * Dùng để setQueue với đầy đủ trackIds ngay cả khi chưa load hết tracks.
   * Nếu không truyền, fallback về tracks.map(t => t._id) (chỉ loaded tracks).
   */
  allTrackIds?: string[];
  /**
   * Tổng số track thực — từ album.totalTracks hoặc data.totalItems.
   * Dùng cho: header badge, progress bar.
   */

  totalItems?: number;
  /** true khi chưa có page đầu tiên */
  isLoading?: boolean;
  /** Error từ query */
  error?: Error | null;
  /** true khi đang fetch page tiếp theo */
  isFetchingNextPage?: boolean;
  /** false = đã hết data */
  hasNextPage?: boolean;
  /** Gọi fetchNextPage */
  onFetchNextPage?: () => void;
  /** Gọi refetch */
  onRetry?: () => void;
  /**
   * Optional callback sau khi dispatch setQueue/setIsPlaying.
   * Được gọi SAU dispatch (không trước) để tránh activeId stale.
   */
  onTrackPlay?: (track: ITrack, index: number) => void;
  className?: string;
  showHeader?: boolean;
  /** Số skeleton rows lúc initial load */
  skeletonCount?: number;
  /**
   * Chiều cao scroll container:
   * - number  → fixed height px (embedded variant, useVirtualizer)
   * - "auto"  → window scroll   (page variant, useWindowVirtualizer)
   * Default: "auto"
   */
  maxHeight?: number | "auto";
  /** Overscan buffer rows ngoài viewport */
  overscan?: number;
  staggerAnimation?: boolean;
  moodColor: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ROW_H = 56; // h-14 = 3.5rem = 56px — phải khớp TrackRow
const SKELETON_BATCH = 3; // skeleton rows khi fetching next page

const COLGROUP = (
  <colgroup>
    <col style={{ width: "3rem" }} />
    <col />
    <col style={{ width: "200px" }} className="hidden md:table-column" />
    <col style={{ width: "3rem" }} />
    <col style={{ width: "5rem" }} />
  </colgroup>
);

// ─────────────────────────────────────────────────────────────
// TrackSkeleton
// ─────────────────────────────────────────────────────────────

const TrackSkeleton = memo(({ index }: { index: number }) => {
  const titleW = 52 + (index % 4) * 11;
  const artistW = 32 + (index % 3) * 9;
  const albumW = 38 + (index % 5) * 7;
  const rowOpacity = Math.max(0.15, 1 - (index % 10) * 0.08);
  const d = (extra = 0) => ({
    animationDelay: `${(index % 10) * 60 + extra}ms`,
  });

  return (
    <TableRow
      aria-hidden="true"
      className="h-14 border-b border-border/[0.06] hover:bg-transparent last:border-b-0"
      style={{ opacity: rowOpacity }}
    >
      <TableCell className="w-12 p-0">
        <div className="flex h-14 items-center justify-center">
          <div className="skeleton size-3.5 rounded-sm" style={d()} />
        </div>
      </TableCell>
      <TableCell className="py-0 pl-1 pr-4">
        <div className="flex items-center gap-3">
          <div className="skeleton size-10 shrink-0 rounded" style={d()} />
          <div className="flex flex-col gap-2 flex-1">
            <div
              className="skeleton skeleton-text"
              style={{ width: `${titleW}%`, ...d(80) }}
            />
            <div
              className="skeleton skeleton-text"
              style={{
                width: `${artistW}%`,
                height: "0.625rem",
                opacity: 0.7,
                ...d(160),
              }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell py-0 pr-4">
        <div
          className="skeleton skeleton-text"
          style={{
            width: `${albumW}%`,
            height: "0.625rem",
            opacity: 0.65,
            ...d(240),
          }}
        />
      </TableCell>
      <TableCell className="py-0 pr-1">
        <div className="flex justify-center">
          <div
            className="skeleton size-8 rounded-full"
            style={{ opacity: 0.5, ...d(280) }}
          />
        </div>
      </TableCell>
      <TableCell className="py-0 pr-3">
        <div className="flex justify-end">
          <div
            className="skeleton skeleton-bar w-10"
            style={{ opacity: 0.6, ...d(320) }}
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
      <div className="flex flex-col items-center justify-center gap-8 py-20 sm:py-28 animate-fade-up">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute size-32 rounded-full orb-float--brand animate-glow-pulse pointer-events-none"
            style={{ filter: "blur(36px)", opacity: 0.18 }}
            aria-hidden="true"
          />
          <div
            className="absolute size-[76px] rounded-full animate-vinyl-slow pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 72%, hsl(var(--primary)/0.32) 100%)",
            }}
            aria-hidden="true"
          />
          <div
            className={cn(
              "relative flex size-16 items-center justify-center rounded-full",
              "bg-muted border border-border/60 shadow-inset-top",
            )}
          >
            <Disc3
              className="size-7 text-muted-foreground/50 animate-vinyl-slow"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-track-title text-[15px] text-foreground">
            Danh sách trống
          </p>
          <p className="text-track-meta max-w-[240px] mx-auto leading-relaxed">
            Chưa có bài hát nào ở đây. Hãy thêm nhạc để bắt đầu.
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
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            "bg-destructive/10 border border-destructive/20",
          )}
        >
          <AlertCircle className="size-6 text-destructive/70" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[14px] font-medium text-foreground">
            Không thể tải danh sách
          </p>
          <p className="text-track-meta text-xs">
            Đã có lỗi xảy ra khi tải bài hát.
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium",
              "bg-muted hover:bg-muted/80 text-foreground border border-border/60",
              "transition-colors duration-150",
            )}
          >
            <RefreshCw className="size-3.5" />
            Thử lại
          </button>
        )}
      </div>
    </TableCell>
  </TableRow>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────
// ColumnHeaders
// ─────────────────────────────────────────────────────────────

const ColumnHeaders = memo(
  ({
    totalItems,
    loadedCount,
  }: {
    totalItems?: number;
    loadedCount?: number;
  }) => (
    <TableHeader className="sticky top-0 z-10">
      <TableRow
        className="hover:bg-transparent border-border/25"
        style={{
          background: "transparent",
          WebkitBackdropFilter: "var(--glass-blur-heavy)",
          backdropFilter: "var(--glass-blur-heavy)",
          borderBottom: "1px solid hsl(var(--border) / 0.25)",
        }}
      >
        <TableHead className="w-12 p-0 h-10">
          <div className="flex h-10 items-center justify-center">
            <span className="text-label text-muted-foreground">#</span>
          </div>
        </TableHead>
        <TableHead className="pl-1 pr-4 h-10">
          <div className="flex items-center gap-2">
            <span className="text-label text-muted-foreground">Bài hát</span>
            {!!totalItems && totalItems > 0 && (
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-full",
                  "text-[10px] font-medium tabular-nums leading-none",
                  "bg-muted/60 text-muted-foreground/70 border border-border/40",
                )}
              >
                {loadedCount != null && loadedCount < totalItems
                  ? `${loadedCount} / ${totalItems}`
                  : totalItems}
              </span>
            )}
          </div>
        </TableHead>
        <TableHead className="hidden md:table-cell pr-4 h-10">
          <span className="text-label text-muted-foreground">Album</span>
        </TableHead>
        <TableHead className="table-cell pr-1 h-10">
          <span className="text-label text-muted-foreground">Like</span>
        </TableHead>
        <TableHead className="pr-3 h-10">
          <div className="flex items-center justify-center">
            <Clock
              className="size-3.5 text-muted-foreground"
              aria-label="Thời lượng"
            />
          </div>
        </TableHead>
      </TableRow>
    </TableHeader>
  ),
);
ColumnHeaders.displayName = "ColumnHeaders";

// ─────────────────────────────────────────────────────────────
// ScrollProgressBar — chỉ fixed height mode
// ─────────────────────────────────────────────────────────────

const ScrollProgressBar = memo(({ progress }: { progress: number }) => (
  <div
    className="absolute top-[50px] left-0 right-0 h-[2px] z-20 overflow-hidden rounded-t-2xl"
    aria-hidden="true"
  >
    <div
      className="h-full bg-linear-to-r from-primary/60 via-primary to-primary/60 transition-[width] duration-75 ease-linear"
      style={{ width: `${progress * 100}%` }}
    />
  </div>
));
ScrollProgressBar.displayName = "ScrollProgressBar";

// ─────────────────────────────────────────────────────────────
// VirtualTableBody — tách ra để dùng virtualItems từ cả 2 virtualizer
// ─────────────────────────────────────────────────────────────

interface VirtualTableBodyProps {
  virtualItems: Array<{
    index: number;
    start: number;
    end: number;
    key: string | number;
  }>;
  totalVirtualH: number;
  tracks: ITrack[];
  activeId: string | null;
  isPlaying: boolean;
  staggerAnimation: boolean;
  onPlay: (track: ITrack, index: number) => void;
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
        {/* Top spacer */}
        {topH > 0 && <tr aria-hidden="true" style={{ height: `${topH}px` }} />}

        {virtualItems.map((vRow) => {
          const track = tracks[vRow.index];

          if (!track) {
            /**
             * @fix #5 — dùng vRow.index thay vì (vRow.index - tracks.length)
             * để animation delay tiếp tục liên tục từ bài cuối đã load.
             * TrackSkeleton tự mod index % 10 để tránh delay quá lớn.
             */
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
                staggerAnimation ? Math.min(vRow.index * 28, 280) : 0
              }
            />
          );
        })}

        {/* Bottom spacer */}
        {botH > 0 && <tr aria-hidden="true" style={{ height: `${botH}px` }} />}
      </TableBody>
    );
  },
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
    className,
    moodColor = "",
    showHeader = true,
    skeletonCount = 10,
    maxHeight = "auto",
    overscan = 6,
    staggerAnimation = true,
  }: TrackListProps) => {
    const dispatch = useAppDispatch();

    /**
     * @fix #2 — selectCurrentTrack (memoized selector) thay vì s.player.currentTrack
     * playerSlice ID-First không có field currentTrack — chỉ có currentTrackId + cache.
     * selectCurrentTrack = createSelector(currentTrackId, cache) → ITrack | null
     */
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
    const [scrollProgress, setScrollProgress] = useState(0);

    const isFixedHeight = maxHeight !== "auto";
    const isEmpty = !isLoading && !error && tracks.length === 0;

    // Skeleton tail khi isFetchingNextPage
    const skeletonRows = isFetchingNextPage ? SKELETON_BATCH : 0;
    const virtualCount = tracks.length + skeletonRows;

    /**
     * @fix #3 — trackIds ref để handlePlayTrack không cần tracks/allTrackIds trong closure.
     * allTrackIds (toàn bộ album IDs) stable hơn tracks (grow với mỗi page).
     * Ref luôn trỏ tới giá trị mới nhất mà không làm callback invalidate.
     */
    const trackIdsRef = useRef<string[]>([]);
    useEffect(() => {
      trackIdsRef.current = allTrackIds ?? tracks.map((t) => t._id);
    }, [allTrackIds, tracks]);

    // tracks ref — cho initialMetadata trong setQueue
    const tracksRef = useRef<ITrack[]>(tracks);
    useEffect(() => {
      tracksRef.current = tracks;
    }, [tracks]);

    // ── Virtualizer — fixed height mode ───────────────────────
    const fixedVirtualizer = useVirtualizer({
      count: isFixedHeight ? virtualCount : 0,
      getScrollElement: () =>
        isFixedHeight ? scrollContainerRef.current : null,
      estimateSize: () => ROW_H,
      overscan,
      enabled: isFixedHeight,
    });

    /**
     * @fix #6 — useWindowVirtualizer thay vì getScrollElement: null
     * useVirtualizer với null scroll element không observe window scroll events.
     * useWindowVirtualizer được thiết kế đúng cho window scroll.
     */
    const windowVirtualizer = useWindowVirtualizer({
      count: !isFixedHeight ? virtualCount : 0,
      estimateSize: () => ROW_H,
      overscan,
      scrollMargin: scrollContainerRef.current?.offsetTop ?? 0,
      enabled: !isFixedHeight,
    });

    const virtualizer = isFixedHeight ? fixedVirtualizer : windowVirtualizer;
    const virtualItems = virtualizer.getVirtualItems();
    const totalVirtualH = virtualizer.getTotalSize();

    // ── Progress bar (fixed height mode) ──────────────────────
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        if (!isFixedHeight) return;
        const el = e.currentTarget;
        const max = el.scrollHeight - el.clientHeight;
        setScrollProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      },
      [isFixedHeight],
    );

    // ── Intersection Observer sentinel ─────────────────────────
    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel || !hasNextPage || isFetchingNextPage) return;

      const root = isFixedHeight ? scrollContainerRef.current : null;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) onFetchNextPage?.();
        },
        { root, rootMargin: "300px", threshold: 0 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, isFixedHeight, onFetchNextPage]);
    // ── Play handler ───────────────────────────────────────────
    /**
     * @fix #1 — setQueue signature: { trackIds, initialMetadata, startIndex }
     * @fix #3 — trackIdsRef / tracksRef để không invalidate callback saat tracks grow
     * @fix #7 — dispatch trước, onTrackPlay callback sau
     *           (onTrackPlay trước có thể dispatch action → activeId stale trong closure)
     */
    console.log(tracksRef.current);
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
                // Tự động thêm chữ 's' vào sourceType để match với route (ví dụ: /albums/, /playlists/)
                url: ``,
              },
            }),
          );
        }
        // @fix #7 — callback sau dispatch, không trước
        onTrackPlay?.(track, index);
      },
      // trackIdsRef, tracksRef không masuk deps — stable refs
      [dispatch, activeId, isPlaying, onTrackPlay],
    );

    // ── Skeleton array (initial load) ──────────────────────────
    const skeletons = useMemo(
      () => Array.from({ length: skeletonCount }, (_, i) => i),
      [skeletonCount],
    );

    // ── Container style ────────────────────────────────────────
    const scrollStyle: React.CSSProperties = isFixedHeight
      ? { maxHeight: `${maxHeight}px`, overflowY: "auto", overflowX: "hidden" }
      : { overflowX: "hidden" };

    // ── Shared header table (sticky, luar scroll container) ────
    const headerTable = showHeader && (
      <div className="px-4 pt-4 shrink-0">
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
    );

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────

    return (
      <div
        className={cn(
          "relative rounded-2xl flex flex-col",
          "border border-border/50 dark:border-primary/15",
          "shadow-brand-dynamic", // Class mới tạo ở trên
          "animate-fade-up animation-fill-both",
        )}
        style={
          {
            animationDelay: "80ms",
            // Nếu không có moodColor thì fallback về màu primary mặc định
            "--local-shadow-color": moodColor || "var(--primary)",
          } as React.CSSProperties
        }
      >
        {/* Progress bar — fixed height only */}
        {isFixedHeight && scrollProgress > 0 && (
          <ScrollProgressBar progress={scrollProgress} />
        )}

        {/* Sticky header — ngoài scroll container */}
        {headerTable}

        {/* ── Scroll container ───────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          role="region"
          aria-label="Danh sách bài hát"
          className={cn("px-4 pb-4 flex-1", className)}
          style={scrollStyle}
          onScroll={handleScroll}
        >
          {/* CASE 1 — Initial loading */}
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
               * @fix #4 — KHÔNG set height trên <Table>
               * Trước đây: height={estimatedTotalHeight} trên Table conflict với
               * spacer <tr> bên trong → double-counting, scrollbar sai.
               * Đúng: chỉ dùng spacer <tr> top/bottom trong VirtualTableBody.
               * totalVirtualH từ virtualizer.getTotalSize() đã bao gồm
               * estimated height của toàn bộ rows (kể cả chưa load).
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

              {/* Sentinel: trigger fetchNextPage */}
              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

              {/* Bottom status */}
              <div className="flex items-center justify-center min-h-[40px]">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 animate-fade-up">
                    <svg
                      className="size-3.5 animate-spin text-primary/50"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span className="text-label">Đang tải thêm...</span>
                  </div>
                )}
                {!hasNextPage && !isFetchingNextPage && tracks.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/35 text-label tabular-nums">
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
