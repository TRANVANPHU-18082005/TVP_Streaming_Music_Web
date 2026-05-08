/**
 * TrackTableRow — Production-grade row component
 * Design: Obsidian Luxury / Glassmorphism (matches SOUNDWAVE design system)
 * Optimized: React.memo + stable callbacks, zero unnecessary re-renders
 */

import React, { memo, useState, useCallback } from "react";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Pause,
  Loader2,
  Copy,
  Disc3,
  RefreshCcw,
  Music2,
  AlertCircle,
  FileText,
  Video,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDuration, STATUS_CONFIG, toCDN } from "@/utils/track-helper";
import { toast } from "sonner";
import { ITrack } from "@/features/track/types";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackTableRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPlay: () => void;
  onEdit: (track: ITrack) => void;
  onDelete: (track: ITrack) => void;
  retryFull: (trackId: string) => void;
  retryTranscode: (trackId: string) => void;
  retryLyrics: (trackId: string) => void;
  retryKaraoke: (trackId: string) => void;
  retryMood: (trackId: string) => void;
}

// ─── Equalizer animation (CSS-in-JS for isolation) ───────────────────────────

const EqBars = memo(() => (
  <div className="eq-bars eq-bars--gradient" aria-label="Now playing">
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className="eq-bar" />
    ))}
  </div>
));
EqBars.displayName = "EqBars";

// ─── Cover image with play overlay ───────────────────────────────────────────

interface CoverProps {
  src: string;
  title: string;
  isActive: boolean;
  isPlaying: boolean;
  canPlay: boolean;
  onClick: () => void;
}

const TrackCover = memo(
  ({ src, title, isActive, isPlaying, canPlay, onClick }: CoverProps) => (
    <div
      role={canPlay ? "button" : undefined}
      aria-label={
        canPlay
          ? isActive && isPlaying
            ? `Pause ${title}`
            : `Play ${title}`
          : undefined
      }
      tabIndex={canPlay ? 0 : -1}
      onKeyDown={(e) => e.key === "Enter" && canPlay && onClick()}
      onClick={canPlay ? onClick : undefined}
      className={cn(
        "relative size-10 rounded-lg overflow-hidden flex-shrink-0 group/cover",
        "ring-1 ring-white/5 shadow-md",
        canPlay && "cursor-pointer",
      )}
    >
      {/* Fallback background */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        <Music2 className="size-4 text-muted-foreground/40" />
      </div>

      {/* Cover */}
      {src && (
        <ImageWithFallback
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          className={cn(
            "size-full object-cover transition-all duration-300",
            isActive ? "brightness-50 scale-105" : "brightness-100",
            canPlay &&
              "group-hover/cover:brightness-50 group-hover/cover:scale-105",
          )}
        />
      )}

      {/* Play overlay */}
      {canPlay && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200">
          {isActive && isPlaying ? (
            <Pause className="size-3.5 text-white fill-white drop-shadow-md" />
          ) : (
            <Play className="size-3.5 text-white fill-white drop-shadow-md translate-x-0.5" />
          )}
        </div>
      )}

      {/* Active indicator ring */}
      {isActive && (
        <div className="absolute inset-0 ring-2 ring-primary/70 rounded-lg pointer-events-none" />
      )}
    </div>
  ),
);
TrackCover.displayName = "TrackCover";

// ─── Status badge with retry ──────────────────────────────────────────────────

interface StatusCellProps {
  track: ITrack;
  isRetrying: boolean;
  onRetry: (e: React.MouseEvent) => void;
}

const StatusCell = memo(({ track, isRetrying, onRetry }: StatusCellProps) => {
  const statusKey = isRetrying ? "processing" : track.status;
  const statusConfig = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
  const showRetry = track.status === "failed" || track.status === "pending";

  return (
    <div className="flex items-center gap-1.5">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={cn(
                "text-[10px] font-semibold tracking-wide h-5 px-2 gap-1 select-none",
                "transition-all duration-200",
                statusConfig.className,
              )}
            >
              {(statusConfig.animate || isRetrying) && (
                <Loader2 className="size-2.5 animate-spin" />
              )}
              {statusConfig.label}
            </Badge>
          </TooltipTrigger>
          {track.status === "failed" && track.errorReason && (
            <TooltipContent
              side="bottom"
              className="max-w-[220px] text-xs flex items-start gap-1.5"
            >
              <AlertCircle className="size-3 text-destructive mt-0.5 flex-shrink-0" />
              {track.errorReason}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {showRetry && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRetry}
                disabled={isRetrying}
                aria-label="Retry processing"
                className={cn(
                  "size-6 rounded-md",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-muted/80 transition-colors",
                )}
              >
                <RefreshCcw
                  className={cn("size-3", isRetrying && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Retry processing
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});
StatusCell.displayName = "StatusCell";

// ─── Main Row Component ───────────────────────────────────────────────────────

export const TrackTableRow = memo(
  ({
    track,
    index,
    isActive,
    isPlaying,
    isSelected,
    onSelect,
    onPlay,
    onEdit,
    onDelete,
    retryFull,
    retryTranscode,
    retryLyrics,
    retryKaraoke,
    retryMood,
  }: TrackTableRowProps) => {
    const [isRetrying, setIsRetrying] = useState(false);

    const handleFullRetry = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        try {
          await retryFull(track._id);
          toast.success("Track queued for reprocessing");
        } catch {
          toast.error("Retry failed — please try again");
          setIsRetrying(false);
        }
      },
      [isRetrying, retryFull, track],
    );
    const handleTranscodeRetry = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        try {
          await retryTranscode(track._id);
          toast.success("Track queued for reprocessing");
        } catch {
          toast.error("Retry failed — please try again");
          setIsRetrying(false);
        }
      },
      [isRetrying, retryTranscode, track],
    );
    const handleLyricRetry = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        try {
          await retryLyrics(track._id);
          toast.success("Track queued for reprocessing");
        } catch {
          toast.error("Retry failed — please try again");
          setIsRetrying(false);
        }
      },
      [isRetrying, retryLyrics, track],
    );
    const handleMoodRetry = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        try {
          await retryMood(track._id);
          toast.success("Track queued for reprocessing");
        } catch {
          toast.error("Retry failed — please try again");
          setIsRetrying(false);
        }
      },
      [isRetrying, retryMood, track],
    );
    const handleKaraokeRetry = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRetrying) return;
        setIsRetrying(true);
        try {
          console.log(track);
          await retryKaraoke(track._id);
          toast.success("Track queued for reprocessing");
        } catch (err: any) {
          console.log(err);
          toast.error("Retry failed — please try again");
          setIsRetrying(false);
        }
      },
      [isRetrying, retryKaraoke, track],
    );

    const handleCopyId = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(track._id);
        toast.success("Track ID copied");
      },
      [track._id],
    );

    const handleSelect = useCallback(
      (checked: boolean) => onSelect(track._id, checked),
      [onSelect, track._id],
    );

    const handleEdit = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(track);
      },
      [onEdit, track],
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(track);
      },
      [onDelete, track],
    );

    const canPlay = track.status === "ready";
    const isFailed = track.status === "failed";

    return (
      <TableRow
        className={cn(
          // Base
          "group/row relative border-b border-border/30 transition-all duration-150",
          "hover:bg-muted/30",
          // States
          isActive &&
            !isFailed && [
              "bg-primary/[0.04] hover:bg-primary/[0.07]",
              "border-b-primary/10",
            ],
          isSelected && "bg-secondary/20 hover:bg-secondary/30",
          isFailed && "bg-destructive/[0.03] hover:bg-destructive/[0.06]",
          // Active left accent via pseudo — achieved via shadow trick
          isActive && "shadow-[inset_3px_0_0_hsl(var(--primary)/0.7)]",
        )}
        aria-selected={isSelected}
      >
        {/* ── Col 1: Checkbox ── */}
        <TableCell
          className="w-10 pl-3 pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleSelect}
            aria-label={`Select ${track.title}`}
            className="transition-transform active:scale-90"
          />
        </TableCell>

        {/* ── Col 2: Index / EQ ── */}
        <TableCell className="w-10 text-center px-0">
          {isActive && isPlaying ? (
            <EqBars />
          ) : (
            <span
              className={cn(
                "text-[11px] font-mono tabular-nums transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground/60",
                "group-hover/row:text-muted-foreground",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
        </TableCell>

        {/* ── Col 3: Cover + Title + Mobile Artist ── */}
        <TableCell className="py-2.5 pl-2">
          <div className="flex items-center gap-3 min-w-0">
            <TrackCover
              src={toCDN(track.coverImage) || track.coverImage}
              title={track.title}
              isActive={isActive}
              isPlaying={isPlaying}
              canPlay={canPlay}
              onClick={onPlay}
            />

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold truncate leading-tight transition-colors",
                  isActive ? "text-primary" : "text-foreground",
                )}
                title={track.title}
              >
                {track.title}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 items-center">
                {!track.isPublic && (
                  <Badge className="text-[10px] font-semibold px-2 py-1 rounded-full bg-muted/80 text-muted-foreground">
                    Private
                  </Badge>
                )}
                {track.isExplicit && (
                  <Badge className="text-[10px] font-semibold px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                    Explicit
                  </Badge>
                )}
                {track.lyricType && track.lyricType !== "none" && (
                  <Badge className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {track.lyricType}
                  </Badge>
                )}
              </div>

              {/* Artist — visible only on mobile (hidden sm+) */}
              <Link
                to={`/artist/${track.artist?.slug}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "text-[11px] text-muted-foreground truncate mt-0.5 block sm:hidden",
                  "hover:text-foreground hover:underline transition-colors",
                )}
              >
                {track.artist?.name}
                {track.featuringArtists?.length > 0 && (
                  <span className="opacity-70">
                    {" "}
                    ft. {track.featuringArtists.map((a) => a.name).join(", ")}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </TableCell>

        {/* ── Col 4: Artist (sm+) ── */}
        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground py-2.5">
          <ArtistDisplay
            mainArtist={track.artist}
            featuringArtists={track.featuringArtists}
            className="hover:text-[hsl(var(--foreground))] hover:underline underline-offset-2 transition-colors duration-150 text-track-meta"
          />
        </TableCell>

        {/* ── Col 5: Album (md+) ── */}
        <TableCell className="hidden md:table-cell text-sm text-muted-foreground py-2.5">
          <div className="flex items-center gap-1.5 min-w-0 max-w-[200px]">
            <Disc3 className="size-3 opacity-40 flex-shrink-0" />
            {track.album ? (
              <Link
                to={`/albums/${track.album.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:text-foreground hover:underline transition-colors"
                title={track.album.title}
              >
                {track.album.title}
              </Link>
            ) : (
              <span className="text-muted-foreground/50 italic text-xs">
                Single
              </span>
            )}
          </div>
        </TableCell>

        {/* ── Col 6: Status ── */}
        <TableCell className="py-2.5">
          <StatusCell
            track={track}
            isRetrying={isRetrying}
            onRetry={handleFullRetry}
          />
        </TableCell>

        {/* ── Col 7: Duration (lg+) ── */}
        <TableCell className="hidden lg:table-cell w-16 text-center py-2.5">
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70">
            {formatDuration(track.duration)}
          </span>
        </TableCell>

        {/* ── Col 8: Actions ── */}
        <TableCell className="pr-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleEdit}
                    aria-label="Edit track"
                    className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                  >
                    <Edit className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Edit track
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {(track.status === "failed" ||
              track.status === "pending" ||
              track.status === "processing") && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleFullRetry}
                      disabled={isRetrying}
                      aria-label="Retry processing"
                      className={cn(
                        "size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all",
                        isRetrying && "cursor-wait",
                      )}
                    >
                      <RefreshCcw
                        className={cn("size-3.5", isRetrying && "animate-spin")}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Retry processing
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Track options"
                  className={cn(
                    "size-7 rounded-md opacity-0 group-hover/row:opacity-100",
                    "focus-visible:opacity-100 transition-all duration-150",
                    "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={4}
                className="w-44 rounded-xl shadow-elevated border-border/50 bg-popover/95 backdrop-blur-md"
              >
                <DropdownMenuItem
                  onClick={handleEdit}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <Edit className="size-3.5 opacity-70" />
                  Edit track
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleFullRetry}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <RefreshCcw className="size-3.5 opacity-70" />
                  Retry Full
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleTranscodeRetry}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <RefreshCcw className="size-3.5 opacity-70" />
                  Retry Transcode
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLyricRetry}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <FileText className="size-3.5 opacity-70" />
                  Retry Lyrics
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleKaraokeRetry}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <Video className="size-3.5 opacity-70" />
                  Retry Karaoke
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleMoodRetry}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <Sparkles className="size-3.5 opacity-70" />
                  Retry Mood
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleCopyId}
                  className="gap-2 text-sm cursor-pointer rounded-lg focus:bg-muted"
                >
                  <Copy className="size-3.5 opacity-70" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className={cn(
                    "gap-2 text-sm cursor-pointer rounded-lg",
                    "text-destructive focus:text-destructive focus:bg-destructive/10",
                  )}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

TrackTableRow.displayName = "TrackTableRow";
export default TrackTableRow;
