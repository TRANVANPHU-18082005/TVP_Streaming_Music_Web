/**
 * TrackList.tsx — v2.0 Soundwave
 *
 * UPGRADES vs original:
 * ─ Skeleton rows: use .skeleton token (shimmer gradient + animation)
 *   instead of inline style pulse. Properly themed light/dark.
 * ─ ColumnHeaders: .glass-heavy token for sticky backdrop,
 *   .text-label token for ALL CAPS column labels
 * ─ EmptyState: Soundwave ambient system — .orb-float, .animate-glow-pulse,
 *   .animate-vinyl, .text-track-title, .text-track-meta tokens
 * ─ Row entry: .animate-fade-up stagger — animationDelay prop forwarded
 * ─ Container: aria-label region preserved, no layout changes
 * ─ skeletonCount prop still configurable (default 8)
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
  onTrackPlay?: (track: ITrack, index: number) => void;
  className?: string;
  showHeader?: boolean;
  skeletonCount?: number;
  staggerAnimation?: boolean;
}

// ─────────────────────────────────────────────────────────────
// TrackSkeleton — Soundwave .skeleton token
//
// Uses the token's shimmer gradient instead of inline pulse keyframes.
// Stagger: opacity fades progressively (rows further down = more transparent).
// Width modulo pattern unchanged — deterministic, no hydration risk.
// ─────────────────────────────────────────────────────────────

const TrackSkeleton = memo(({ index }: { index: number }) => {
  const titleW = 52 + (index % 4) * 11; // 52–85%
  const artistW = 32 + (index % 3) * 9; // 32–59%
  const albumW = 38 + (index % 5) * 7; // 38–66%
  // Progressively fade deeper rows
  const rowOpacity = Math.max(0.15, 1 - index * 0.1);

  return (
    <TableRow
      aria-hidden="true"
      className="h-14 border-b border-border/[0.06] hover:bg-transparent last:border-b-0"
      style={{ opacity: rowOpacity }}
    >
      {/* # placeholder */}
      <TableCell className="w-12 p-0">
        <div className="flex h-14 items-center justify-center">
          {/*
           * .skeleton token: provides shimmer gradient + animation.
           * Delay via CSS animation-delay so each cell shimmers offset.
           */}
          <div
            className="skeleton size-3.5 rounded-sm"
            style={{ animationDelay: `${index * 60}ms` }}
          />
        </div>
      </TableCell>

      {/* Cover + text */}
      <TableCell className="py-0 pl-1 pr-4">
        <div className="flex items-center gap-3">
          {/* Cover */}
          <div
            className="skeleton size-10 shrink-0 rounded"
            style={{ animationDelay: `${index * 60}ms` }}
          />
          {/* Text lines */}
          <div className="flex flex-col gap-2 flex-1">
            <div
              className="skeleton skeleton-text"
              style={{
                width: `${titleW}%`,
                animationDelay: `${index * 60 + 80}ms`,
              }}
            />
            <div
              className="skeleton skeleton-text"
              style={{
                width: `${artistW}%`,
                height: "0.625rem",
                opacity: 0.7,
                animationDelay: `${index * 60 + 160}ms`,
              }}
            />
          </div>
        </div>
      </TableCell>

      {/* Album (md+) */}
      <TableCell className="hidden md:table-cell py-0 pr-4">
        <div
          className="skeleton skeleton-text"
          style={{
            width: `${albumW}%`,
            height: "0.625rem",
            opacity: 0.65,
            animationDelay: `${index * 60 + 240}ms`,
          }}
        />
      </TableCell>

      {/* Duration */}
      <TableCell className="py-0 pr-3">
        <div className="flex justify-end">
          <div
            className="skeleton skeleton-bar w-10"
            style={{
              opacity: 0.6,
              animationDelay: `${index * 60 + 320}ms`,
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
});
TrackSkeleton.displayName = "TrackSkeleton";

// ─────────────────────────────────────────────────────────────
// EmptyState — Soundwave ambient + token typography
// ─────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <TableRow className="hover:bg-transparent border-0">
    <TableCell colSpan={4} className="p-0 border-0">
      <div className="flex flex-col items-center justify-center gap-8 py-20 sm:py-28 animate-fade-up">
        {/* Disc with ambient glow system */}
        <div className="relative flex items-center justify-center">
          {/*
           * .orb-float--brand: radial glow orb that floats with keyframes.
           * Sized explicitly here since we want a compact ambient effect.
           */}
          <div
            className="absolute size-32 rounded-full orb-float--brand animate-glow-pulse pointer-events-none"
            style={{ filter: "blur(36px)", opacity: 0.18 }}
            aria-hidden="true"
          />

          {/* Spinning conic ring — from vinyl-spin keyframe */}
          <div
            className="absolute size-[76px] rounded-full animate-vinyl-slow pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 72%, hsl(var(--primary)/0.32) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Icon disc */}
          <div
            className={cn(
              "relative flex size-16 items-center justify-center rounded-full",
              "bg-muted border border-border/60",
              "shadow-inset-top",
            )}
          >
            <Disc3
              className="size-7 text-muted-foreground/50 animate-vinyl-slow"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Copy — Soundwave typography tokens */}
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
// ColumnHeaders — Soundwave .glass-heavy sticky backdrop
//                + .text-label ALL-CAPS token
// ─────────────────────────────────────────────────────────────

const ColumnHeaders = memo(() => (
  <TableHeader className="sticky top-0 z-10">
    <TableRow
      className="hover:bg-transparent border-border/25"
      style={{
        background: "transparent", // fallback for browsers that don't support backdrop-filter
        WebkitBackdropFilter: "var(--glass-blur-heavy)",
        borderBottom: "1px solid hsl(var(--border) / 0.25)",
      }}
    >
      {/* # */}
      <TableHead className="w-12 p-0 h-10">
        <div className="flex h-10 items-center justify-center">
          {/* Soundwave .text-label token: uppercase + tracking */}
          <span className="text-label text-muted-foreground">#</span>
        </div>
      </TableHead>
      {/* Bài hát */}
      <TableHead className="pl-1 pr-4 h-10">
        <span className="text-label text-muted-foreground">Bài hát</span>
      </TableHead>
      {/* Album (md+) */}
      <TableHead className="hidden md:table-cell pr-4 h-10">
        <span className="text-label text-muted-foreground">Album</span>
      </TableHead>
      {/*Like button column */}
      <TableHead className="table-cell pr-1 h-10">
        <span className="text-label text-muted-foreground">Like</span>
      </TableHead>
      {/* Duration */}
      <TableHead className="pr-3 h-10 text-right">
        <div className="flex items-center justify-center">
          <Clock
            className="size-3.5 text-muted-foreground"
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

    const isEmpty = !isLoading && tracks.length === 0;
    const activeId = currentTrack?._id ?? null;

    const handlePlayTrack = useCallback(
      (track: ITrack, index: number) => {
        onTrackPlay?.(track, index);

        if (activeId === track._id) {
          dispatch(setIsPlaying(!isPlaying));
          return;
        }

        dispatch(setQueue({ tracks, startIndex: index }));
      },
      [dispatch, tracks, activeId, isPlaying, onTrackPlay],
    );

    const skeletons = useMemo(
      () => Array.from({ length: skeletonCount }, (_, i) => i),
      [skeletonCount],
    );

    return (
      <div
        className={cn(
          "rounded-2xl",
          "border border-border/50 dark:border-primary/15",
          "shadow-brand p-4",
          "animate-fade-up animation-fill-both",
        )}
        style={{ animationDelay: "80ms" }}
      >
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
            {/* Single source of truth for column widths */}
            <colgroup>
              <col style={{ width: "3rem" }} />
              <col />
              <col
                style={{ width: "200px" }}
                className="hidden md:table-column"
              />
              <col style={{ width: "3rem" }} />
              <col className="w-20 md:w-30" />
            </colgroup>

            {showHeader && <ColumnHeaders />}

            <TableBody>
              {isLoading ? (
                skeletons.map((i) => (
                  <TrackSkeleton key={`sk-${i}`} index={i} />
                ))
              ) : isEmpty ? (
                <EmptyState />
              ) : (
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
      </div>
    );
  },
);

TrackList.displayName = "TrackList";
export default TrackList;
