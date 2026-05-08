import React, { memo, useCallback, useRef } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDuration, toCDN } from "@/utils/track-helper";
import { Link } from "react-router-dom";
import { ITrack } from "@/features/track/types";
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
// Custom areEqual — only re-render when these props actually change
// Avoids re-renders from parent state that don't affect this row
// ─────────────────────────────────────────────────────────────────────────────

function trackRowAreEqual(prev: TrackRowProps, next: TrackRowProps): boolean {
  return (
    prev.track._id === next.track._id &&
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying &&
    prev.onPlay === next.onPlay &&
    prev.animationDelay === next.animationDelay
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayCell — number ↔ waveform toggle
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
        className="relative flex size-full items-center justify-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Track number */}
        <span
          className={cn(
            "absolute text-[12px] font-medium tabular-nums leading-none",
            "transition-[opacity,transform] duration-200 ease-out",
            isActive ? "text-primary" : "text-muted-foreground/60",
            showBars
              ? "opacity-0 scale-75"
              : "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75",
          )}
        >
          {index + 1}
        </span>

        {/* Waveform bars */}
        <span
          className={cn(
            "absolute flex items-center justify-center",
            "transition-[opacity,transform] duration-200 ease-out",
            showBars
              ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75"
              : "opacity-0 scale-75 pointer-events-none",
          )}
        >
          <WaveformBars active={showBars} color="primary" />
        </span>
      </div>
    );
  },
);
PlayCell.displayName = "PlayCell";

// ─────────────────────────────────────────────────────────────────────────────
// CoverArt — lazy loaded, ring on active
// ─────────────────────────────────────────────────────────────────────────────

interface CoverArtProps {
  src: string;
  alt: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const CoverArt = memo(({ src, alt, isActive, onClick }: CoverArtProps) => (
  <div
    role="button"
    tabIndex={-1}
    aria-hidden="true"
    className="relative size-10 shrink-0 overflow-hidden rounded-md cursor-pointer select-none"
    style={{
      transition: "box-shadow 0.2s ease",
      boxShadow: isActive
        ? "0 0 0 1.5px hsl(var(--primary) / 0.7), 0 0 12px hsl(var(--primary) / 0.15)"
        : "none",
    }}
    onClick={onClick}
  >
    <img
      src={src}
      alt={alt}
      className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.08]"
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
          "border-b border-border/[0.05] last:border-b-0",
          "transition-colors duration-100 ease-out",
          // Active state: subtle primary tint
          isActive
            ? "bg-primary/[0.06] hover:bg-primary/[0.09]"
            : "hover:bg-muted/30",
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
              onClick={handlePlayClick}
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
                <>
                  <p
                    title={track.title}
                    className={cn(
                      "truncate text-sm font-medium leading-snug mb-0.5",
                      "text-foreground/90 transition-colors duration-100",
                      "group-hover:text-foreground",
                    )}
                  >
                    {track.title}
                  </p>
                  <div className="min-w-0 truncate">
                    <ArtistDisplay
                      mainArtist={track.artist}
                      featuringArtists={track.featuringArtists}
                      className={cn(
                        "text-xs text-muted-foreground/55 truncate",
                        "hover:text-foreground/70 hover:underline underline-offset-2",
                        "transition-colors duration-100",
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </TableCell>

        {/* COL 3 — Album (hidden < md) */}
        <TableCell className="hidden md:table-cell py-0 pr-4">
          {track.album?.slug ? (
            <Link
              to={`/albums/${track.album.slug}`}
              title={track.album.title}
              className={cn(
                "block truncate max-w-[180px]",
                "text-xs text-muted-foreground/50 truncate",
                "hover:text-foreground/70 hover:underline underline-offset-2",
                "transition-colors duration-100",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {track.album.title}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground/30 italic">
              Single
            </span>
          )}
        </TableCell>

        {/* COL 4 — Like button */}
        {/* <TableCell className="py-0 pr-4">
          <span
            className={cn(
              "relative flex items-center justify-center w-8 h-8 shrink-0",
              "overflow-hidden isolate transition-opacity duration-150",
              isLiked
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto",
            )}
            style={{ contain: "layout paint" }}
          >
            <TrackLikeButton id={track._id} />
          </span>
        </TableCell> */}

        {/* COL 5 — Duration */}
        <TableCell className="py-0 pr-3" data-no-row-click="">
          <div className="flex items-center justify-end">
            <span className="text-xs tabular-nums text-muted-foreground/45 font-medium px-1">
              {formatDuration(track.duration)}
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  },
  trackRowAreEqual,
);

TrackRow.displayName = "TrackRow";
export default TrackRow;
