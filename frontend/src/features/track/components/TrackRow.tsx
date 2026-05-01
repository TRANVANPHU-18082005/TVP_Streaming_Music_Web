import React, { memo, useCallback, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

import { cn } from "@/lib/utils";
import { formatDuration, toCDN } from "@/utils/track-helper";
import { Link } from "react-router-dom";
import { ITrack } from "@/features/track/types";
import { useAppSelector } from "@/store/hooks";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { TrackTitleMarquee } from "@/features/player/components/TrackTitleMarquee";
import { WaveformBars } from "@/components/MusicVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  animationDelay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayCell
// ─────────────────────────────────────────────────────────────────────────────

interface PlayCellProps {
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

const PlayCell = memo(
  ({ index, isActive, isPlaying, onPlay }: PlayCellProps) => {
    const showBars = isActive && isPlaying;

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onPlay();
        }
      },
      [onPlay],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay();
      },
      [onPlay],
    );

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={
          showBars ? `Tạm dừng bài ${index + 1}` : `Phát bài ${index + 1}`
        }
        className="relative flex size-full items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Layer 1: Track number */}
        <span
          className={cn(
            "absolute text-[13px] font-medium tabular-nums leading-none",
            "transition-[opacity,transform] duration-200 ease-out",
            isActive
              ? "text-[hsl(var(--primary))]"
              : "text-[hsl(var(--muted-foreground))]",
            showBars
              ? "opacity-0 scale-75"
              : "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75",
          )}
        >
          {index + 1}
        </span>

        {/* Layer 2: EQ bars */}
        <span
          className={cn(
            "absolute flex items-center justify-center",
            "transition-[opacity,transform] duration-200 ease-out",
            showBars
              ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75"
              : "opacity-0 scale-75 pointer-events-none",
          )}
        >
          <WaveformBars active={showBars} />
        </span>

        {/* Layer 3: Play/Pause icon on hover */}
        <span
          className={cn(
            "absolute flex items-center justify-center",
            "transition-[opacity,transform] duration-200 ease-out",
            "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
          )}
        >
          {isActive && isPlaying ? (
            <Pause
              className="size-[15px]"
              style={{ color: "hsl(var(--foreground))" }}
              strokeWidth={2.5}
            />
          ) : (
            <Play
              className="size-[15px] translate-x-px"
              style={{ color: "hsl(var(--foreground))" }}
              strokeWidth={2.5}
            />
          )}
        </span>
      </div>
    );
  },
);
PlayCell.displayName = "PlayCell";

// ─────────────────────────────────────────────────────────────────────────────
// CoverArt
// ─────────────────────────────────────────────────────────────────────────────

interface CoverArtProps {
  src: string;
  alt: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

const CoverArt = memo(({ src, alt, isActive, onPlay }: CoverArtProps) => (
  <div
    role="button"
    tabIndex={-1}
    aria-hidden="true"
    className="relative size-10 shrink-0 overflow-hidden rounded cursor-pointer select-none"
    style={{
      transition: "box-shadow 0.2s ease",
      boxShadow: isActive
        ? "0 0 0 1.5px hsl(var(--primary)/0.8), 0 0 16px hsl(var(--primary)/0.2)"
        : "none",
    }}
    onClick={onPlay}
  >
    <img
      src={src}
      alt={alt}
      className="size-full object-cover transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.08]"
      loading="lazy"
      decoding="async"
    />
  </div>
));
CoverArt.displayName = "CoverArt";

// ─────────────────────────────────────────────────────────────────────────────
// TrackRow — main export
// ─────────────────────────────────────────────────────────────────────────────

export const TrackRow = memo(
  ({
    track,
    index,
    isActive,
    isPlaying,
    onPlay,
    animationDelay = 0,
  }: TrackRowProps) => {
    const rowRef = useRef<HTMLTableRowElement>(null);
    const isLiked = useAppSelector(
      (state) => !!state.interaction.likedTracks[track._id],
    );
    // FIX 2: console.log removed

    const handleRowClick = useCallback(
      (e: React.MouseEvent<HTMLTableRowElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, [role='button'], [data-no-row-click]"))
          return;
        onPlay();
      },
      [onPlay],
    );

    const handlePlayClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay();
      },
      [onPlay],
    );

    return (
      <TableRow
        ref={rowRef}
        data-active={isActive || undefined}
        onClick={handleRowClick}
        className={cn(
          "group relative h-14 cursor-pointer select-none",
          "border-b border-[hsl(var(--border)/0.06)] last:border-b-0",
          "transition-[background-color,box-shadow] duration-150 ease-out",
          "hover:bg-[hsl(var(--muted)/0.4)]",
          isActive
            ? "bg-[hsl(var(--primary)/0.07)] hover:bg-[hsl(var(--primary)/0.1)]"
            : "",
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
        aria-current={isActive ? "true" : undefined}
      >
        {/* COL 1 — Play toggle */}
        <TableCell className="w-12 p-0">
          <div className="flex h-14 items-center justify-center">
            <PlayCell
              index={index}
              isActive={isActive}
              isPlaying={isPlaying}
              onPlay={onPlay}
            />
          </div>
        </TableCell>

        {/* COL 2 — Cover + Title + Artist */}
        <TableCell className="py-0 pl-1 pr-4">
          <div className="flex items-center gap-3 min-w-0">
            <CoverArt
              src={toCDN(track.coverImage) || track.coverImage}
              alt={track.title}
              isActive={isActive}
              isPlaying={isPlaying}
              onPlay={handlePlayClick}
            />
            <div className="min-w-0 flex-1">
              {isActive ? (
                <TrackTitleMarquee
                  title={track.title}
                  mainArtist={track.artist}
                  featuringArtists={track.featuringArtists}
                  className="text-sm"
                  artistClassName="text-xs"
                />
              ) : (
                <p
                  title={track.title}
                  className="truncate text-track-title text-sm font-medium leading-snug mb-0.5 transition-colors duration-150 text-[hsl(var(--foreground))]"
                >
                  {track.title}
                </p>
              )}
              <div className="min-w-0 truncate text-xs">
                {!isActive && (
                  <ArtistDisplay
                    mainArtist={track.artist}
                    featuringArtists={track.featuringArtists}
                    className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
                  />
                )}
              </div>
            </div>
          </div>
        </TableCell>

        {/* COL 3 — Album (hidden < md) */}
        <TableCell className="hidden md:table-cell py-0 pr-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">
            {track.album?.slug ? (
              <Link
                to={`/albums/${track.album.slug}`}
                title={track.album.title}
                className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
                onClick={(e) => e.stopPropagation()}
              >
                {track.album.title}
              </Link>
            ) : (
              <span className="italic opacity-50">Single</span>
            )}
          </p>
        </TableCell>
        <TableCell className="table-cell py-0 pr-4">
          <span
            className={cn(
              // Layout: fixed size prevents cell width changes during Framer scale
              "relative flex items-center justify-center",
              "w-8 h-8 shrink-0",
              // Containment: clips all Framer animations to this box
              "overflow-hidden isolate",
              // Visibility
              "transition-[opacity] duration-150",
              isLiked
                ? "opacity-100 pointer-events-auto"
                : "pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
            )}
            // FIX: contain layout+paint via inline style (not a Tailwind class)
            // `contain: paint` is the critical property — clips filter:blur() overflow
            style={{ contain: "layout paint" }}
          >
            <TrackLikeButton id={track._id} />
          </span>
        </TableCell>

        {/* COL 4 — Actions + Duration */}
        <TableCell className="py-0 pr-3" data-no-row-click="">
          <div className="flex items-center justify-center gap-0.5">
            {/* Duration */}
            <span className="min-w-[38px] text-duration text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))] px-2">
              {formatDuration(track.duration)}
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

TrackRow.displayName = "TrackRow";
export default TrackRow;
