import React, { memo, useCallback } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/track-helper";
import { ITrack } from "@/features/track/types";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { TrackTitleMarquee } from "@/features/player/components/TrackTitleMarquee";
import { useSelector } from "react-redux";
import { selectPlayer } from "@/features/player";

import TrackRowShell from "./TrackRowShell";
import PlayCell from "./PlayCell";
import LazyImage from "./LazyImage";
import { prefersReducedMotion } from "@/utils/playerLayout";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  isSelected?: boolean;
  onPlay: (e?: React.MouseEvent) => void;
  onSelect?: (id: string, mode: "single" | "range" | "toggle") => void;
  onContextMenu?: (track: ITrack, anchorEl: HTMLElement) => void;
  onNavigate?: (direction: "up" | "down") => void;
  animationDelay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom areEqual — prevents re-renders from unrelated parent state
// ─────────────────────────────────────────────────────────────────────────────

function trackRowAreEqual(prev: TrackRowProps, next: TrackRowProps): boolean {
  return (
    prev.track._id === next.track._id &&
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying &&
    prev.isSelected === next.isSelected &&
    prev.onPlay === next.onPlay &&
    prev.onSelect === next.onSelect &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onNavigate === next.onNavigate &&
    prev.animationDelay === next.animationDelay
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackRow — main export
//
// Key decisions:
// - Row is the primary tab stop (tabIndex=0), not individual cells
// - Long-press triggers context menu on mobile (same path as right-click)
// - Ctrl/Cmd+click → toggle selection, Shift+click → range selection
// - Hover actions use hasFocused lazy mount to avoid 1000x hidden DOM nodes
// ─────────────────────────────────────────────────────────────────────────────

export const TrackRow = memo(
  ({
    track,
    index,
    isActive,
    isPlaying,
    isSelected = false,
    onPlay,
    onSelect,
    onContextMenu,
    onNavigate,
    animationDelay = 0,
  }: TrackRowProps) => {
    const { loadingState } = useSelector(selectPlayer);
    const isGlobalLoading =
      loadingState === "loading" || loadingState === "buffering";

    const handlePlayClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay?.(e);
      },
      [onPlay],
    );

    const center = (
      <>
        <LazyImage
          src={track.coverImage}
          alt={track.title}
          isActive={isActive}
          isLoading={isGlobalLoading}
          isCurrentPlaying={isPlaying && isActive}
          onClick={handlePlayClick}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          {isActive ? (
            <TrackTitleMarquee
              id={track._id}
              title={track.title}
              mainArtist={track.artist}
              featuringArtists={track.featuringArtists}
              className="text-sm"
              artistClassName="text-xs"
            />
          ) : (
            <>
              <Link
                to={`/tracks/${track._id}`}
                title={track.title}
                className={cn(
                  "block max-w-full truncate",
                  "text-sm font-medium leading-snug mb-0.5",
                  "text-foreground/90",
                  "group-hover:text-foreground",
                  prefersReducedMotion ? "" : "transition-colors duration-100",
                )}
              >
                {track.title}
              </Link>

              <div className="min-w-0 overflow-hidden">
                <ArtistDisplay
                  mainArtist={track.artist}
                  featuringArtists={track.featuringArtists}
                  className={cn(
                    "block truncate",
                    "text-xs text-muted-foreground/55",
                    "hover:text-foreground/70 hover:underline underline-offset-2",
                    prefersReducedMotion
                      ? ""
                      : "transition-colors duration-100",
                  )}
                />
              </div>
            </>
          )}
        </div>
      </>
    );

    const albumNode = track.album?.slug ? (
      <Link
        to={`/albums/${track.album.slug}`}
        title={track.album.title}
        tabIndex={-1}
        className={cn(
          "block truncate max-w-[180px]",
          "text-xs text-muted-foreground/50",
          "hover:text-foreground/70 hover:underline underline-offset-2",
          prefersReducedMotion ? "" : "transition-colors duration-100",
        )}
        onClick={(e) => e.stopPropagation()}
        data-no-row-click=""
      >
        {track.album.title}
      </Link>
    ) : (
      <span className="text-xs text-muted-foreground/30 italic">Single</span>
    );

    const actionsNode = onContextMenu ? (
      <button
        tabIndex={-1}
        aria-label={`Tùy chọn cho ${track.title}`}
        data-no-row-click=""
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          "text-muted-foreground/40 hover:text-foreground/70",
          "hover:bg-muted/50",
          prefersReducedMotion
            ? ""
            : "transition-[opacity,colors] duration-150",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(track, e.currentTarget);
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="7" cy="2" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="7" cy="12" r="1.2" />
        </svg>
      </button>
    ) : null;

    const durationNode = (
      <span className="text-xs tabular-nums text-muted-foreground/45 font-medium px-1">
        {formatDuration(track.duration)}
      </span>
    );

    return (
      <TrackRowShell
        id={track._id}
        ariaLabel={`${track.title} by ${
          typeof track.artist === "string" ? track.artist : track.artist?.name
        }, ${formatDuration(track.duration)}`}
        index={index}
        isActive={isActive}
        isPlaying={isPlaying}
        isSelected={isSelected}
        onPlay={onPlay}
        onSelect={onSelect}
        onContextMenu={
          onContextMenu ? (anchor) => onContextMenu(track, anchor) : undefined
        }
        onNavigate={(dir) => onNavigate?.(dir)}
        animationDelay={animationDelay}
        left={
          <PlayCell
            index={index}
            isActive={isActive}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        }
        center={center}
        album={albumNode}
        actions={actionsNode}
        duration={durationNode}
      />
    );
  },
  trackRowAreEqual,
);

TrackRow.displayName = "TrackRow";
export default TrackRow;
