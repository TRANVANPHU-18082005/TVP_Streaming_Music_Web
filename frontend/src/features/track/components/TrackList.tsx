/**
 * TrackList.tsx
 *
 * Virtualization-ready track table with skeleton, empty, and error states.
 * Designed for Spotify/YouTube Music quality — responsive, accessible, performant.
 *
 * Architecture decisions:
 * - `showHeader` prop allows embedding in contexts (modals, sidebars) without header.
 * - `skeletonCount` configurable — shorter lists (search results) need fewer.
 * - `onTrackPlay` callback forwarded from parent for full decoupling.
 *   Parent owns the play logic; TrackList is purely presentational + dispatch.
 * - colgroup widths are the single source of truth for column sizing.
 *   Never rely on per-cell widths — they conflict and produce jank.
 * - `isEmpty` derived synchronously — no useEffect needed.
 */

import React, { memo, useCallback, useRef, useMemo } from "react";
import { Clock, Disc3 } from "lucide-react";
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
import { setQueue, setIsPlaying } from "@/features/player";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TrackListProps {
  tracks: ITrack[];
  isLoading?: boolean;
  /** Forwarded if parent wants to intercept play (e.g., analytics, paywall) */
  onTrackPlay?: (track: ITrack, index: number) => void;
  className?: string;
  /** Hide the column header row — useful inside modals / panels */
  showHeader?: boolean;
  /** Skeleton row count while loading */
  skeletonCount?: number;
  /** Stagger entry animation (set false for instant render in modals) */
  staggerAnimation?: boolean;
}

// ─────────────────────────────────────────────────────────────
// TrackSkeleton
//
// Cinematic waterfall loading:
//   - Opacity fades out progressively (rows further down = more transparent)
//   - Width randomised via index modulo to mimic real content variance
// ─────────────────────────────────────────────────────────────

interface TrackSkeletonProps {
  index: number;
}

const TrackSkeleton = memo(({ index }: TrackSkeletonProps) => {
  // Deterministic "random" widths per row — no hydration mismatch risk
  const titleW = 52 + (index % 4) * 11; // 52 – 85%
  const artistW = 32 + (index % 3) * 9; // 32 – 59%
  const albumW = 38 + (index % 5) * 7; // 38 – 66%

  return (
    <TableRow
      aria-hidden="true"
      className="h-14 border-b border-[hsl(var(--border)/0.06)] hover:bg-transparent last:border-b-0"
      style={{ opacity: Math.max(0.2, 1 - index * 0.09) }}
    >
      {/* Index placeholder */}
      <TableCell className="w-12 p-0">
        <div className="flex h-14 items-center justify-center">
          <div
            className="size-3.5 rounded-sm"
            style={{
              background: "hsl(var(--muted)/0.65)",
              animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60}ms infinite`,
            }}
          />
        </div>
      </TableCell>

      {/* Cover + text */}
      <TableCell className="py-0 pl-1 pr-4">
        <div className="flex items-center gap-3">
          {/* Cover placeholder */}
          <div
            className="size-10 shrink-0 rounded"
            style={{
              background: "hsl(var(--muted)/0.7)",
              animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60}ms infinite`,
            }}
          />
          {/* Text placeholders */}
          <div className="flex flex-col gap-2 flex-1">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${titleW}%`,
                background: "hsl(var(--muted)/0.7)",
                animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60 + 80}ms infinite`,
              }}
            />
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${artistW}%`,
                background: "hsl(var(--muted)/0.4)",
                animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60 + 160}ms infinite`,
              }}
            />
          </div>
        </div>
      </TableCell>

      {/* Album placeholder (md+) */}
      <TableCell className="hidden md:table-cell py-0 pr-4">
        <div
          className="h-2.5 rounded-full"
          style={{
            width: `${albumW}%`,
            background: "hsl(var(--muted)/0.38)",
            animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60 + 240}ms infinite`,
          }}
        />
      </TableCell>

      {/* Duration placeholder */}
      <TableCell className="py-0 pr-3">
        <div className="flex justify-end">
          <div
            className="h-2.5 w-10 rounded-full"
            style={{
              background: "hsl(var(--muted)/0.35)",
              animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${index * 60 + 320}ms infinite`,
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});
TrackSkeleton.displayName = "TrackSkeleton";

// ─────────────────────────────────────────────────────────────
// EmptyState
//
// Premium empty UI — spinning disc + ambient glow.
// All animations driven by CSS classes from index.css.
// ─────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <TableRow className="hover:bg-transparent border-0">
    <TableCell colSpan={4} className="p-0 border-0">
      <div
        className="flex flex-col items-center justify-center gap-7 py-20 sm:py-28"
        style={{ animation: "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Disc icon with ambient glow */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing radial glow */}
          <div
            className="absolute size-28 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary)/0.15) 0%, transparent 72%)",
              animation: "glow-pulse 3.2s ease-in-out infinite",
            }}
          />

          {/* Outer spinning ring */}
          <div
            className="absolute size-[72px] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 75%, hsl(var(--primary)/0.35) 100%)",
              animation: "vinyl-spin 6s linear infinite",
            }}
          />

          {/* Icon container */}
          <div
            className="relative flex size-16 items-center justify-center rounded-full"
            style={{
              background: "hsl(var(--muted)/0.8)",
              border: "1px solid hsl(var(--border)/0.6)",
              boxShadow: "inset 0 1px 0 hsl(0 0% 100%/0.08)",
            }}
          >
            <Disc3
              className="size-7"
              style={{
                color: "hsl(var(--muted-foreground))",
                opacity: 0.55,
                animation: "vinyl-spin 8s linear infinite",
              }}
            />
          </div>
        </div>

        {/* Copy */}
        <div className="text-center">
          <p
            className="text-[15px] font-semibold tracking-tight mb-1.5"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Danh sách trống
          </p>
          <p
            className="text-sm max-w-[240px] leading-relaxed"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Chưa có bài hát nào ở đây. Hãy thêm nhạc để bắt đầu.
          </p>
        </div>
      </div>
    </TableCell>
  </TableRow>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// ColumnHeaders — sticky, glassmorphism top bar
// ─────────────────────────────────────────────────────────────

const ColumnHeaders = memo(() => (
  <TableHeader className="sticky top-0 z-10">
    <TableRow
      className="hover:bg-transparent"
      style={{
        borderBottom: "1px solid hsl(var(--border)/0.25)",
        // Glassmorphism — backdrop matches whatever is behind
        background: "hsl(var(--background)/0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* # */}
      <TableHead className="w-12 p-0 h-10">
        <div className="flex h-10 items-center justify-center">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            #
          </span>
        </div>
      </TableHead>

      {/* Bài hát */}
      <TableHead className="pl-1 pr-4 h-10">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          Bài hát
        </span>
      </TableHead>

      {/* Album — hidden < md */}
      <TableHead className="hidden md:table-cell pr-4 h-10">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          Album
        </span>
      </TableHead>

      {/* Duration */}
      <TableHead className="pr-3 h-10 text-right">
        <div className="flex items-center justify-end">
          <Clock
            className="size-3.5"
            style={{ color: "hsl(var(--muted-foreground))" }}
            aria-label="Thời lượng"
          />
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>
));
ColumnHeaders.displayName = "ColumnHeaders";

// ─────────────────────────────────────────────────────────────
// TrackList — main export
// ─────────────────────────────────────────────────────────────

export const TrackList = memo(
  ({
    tracks,
    isLoading = false,
    onTrackPlay,
    className,
    showHeader = true,
    skeletonCount = 8,
    staggerAnimation = true,
  }: TrackListProps) => {
    const dispatch = useAppDispatch();
    const { currentTrack, isPlaying } = useAppSelector((s) => s.player);
    const containerRef = useRef<HTMLDivElement>(null);

    // ── Derived state (synchronous, no extra hook) ──────────
    const isEmpty = !isLoading && tracks.length === 0;

    // ── Stable ID set for O(1) active lookup ───────────────
    const activeId = currentTrack?._id ?? null;

    /**
     * Core play handler.
     * Separates the "same track → toggle" from "new track → replace queue".
     * Parent callback (`onTrackPlay`) fires first — enables analytics / paywall.
     */
    const handlePlayTrack = useCallback(
      (track: ITrack, index: number) => {
        // Allow parent to intercept (analytics, paywall checks, etc.)
        onTrackPlay?.(track, index);

        if (activeId === track._id) {
          dispatch(setIsPlaying(!isPlaying));
          return;
        }

        dispatch(setQueue({ tracks, startIndex: index }));
      },
      [dispatch, tracks, activeId, isPlaying, onTrackPlay],
    );

    // ── Memoised skeleton array — stable reference ──────────
    const skeletons = useMemo(
      () => Array.from({ length: skeletonCount }, (_, i) => i),
      [skeletonCount],
    );

    return (
      <div
        ref={containerRef}
        role="region"
        aria-label="Danh sách bài hát"
        className={cn("w-full", className)}
      >
        <Table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed", minWidth: "100%" }}
        >
          {/* Column width constraints — single source of truth */}
          <colgroup>
            {/* Index */}
            <col style={{ width: "3rem" }} />
            {/* Track (flex) */}
            <col />
            {/* Album — hidden < md, 200px otherwise */}
            <col style={{ width: "0" }} className="hidden md:table-column" />
            {/* Actions + duration */}
            <col style={{ width: "140px" }} />
          </colgroup>

          {/* ── Header ── */}
          {showHeader && <ColumnHeaders />}

          {/* ── Body ── */}
          <TableBody>
            {isLoading ? (
              // Skeleton rows
              skeletons.map((i) => <TrackSkeleton key={`sk-${i}`} index={i} />)
            ) : isEmpty ? (
              // Empty state
              <EmptyState />
            ) : (
              // Track rows
              tracks.map((track, index) => (
                <TrackRow
                  key={track._id}
                  track={track}
                  index={index}
                  isActive={activeId === track._id}
                  isPlaying={isPlaying}
                  onPlay={() => handlePlayTrack(track, index)}
                  animationDelay={staggerAnimation ? index * 28 : 0}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  },
);

TrackList.displayName = "TrackList";
export default TrackList;
