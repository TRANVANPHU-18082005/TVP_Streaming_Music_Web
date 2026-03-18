import React, { memo, useState } from "react";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Pause,
  Loader2,
  Copy,
  Disc,
  RefreshCcw,
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
import { cn } from "@/lib/utils";
import { formatDuration, STATUS_CONFIG } from "@/utils/track-helper";
import { toast } from "sonner";
import { ITrack } from "@/features/track/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

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
  onRetry: (track: ITrack) => Promise<void>;
}

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
    onRetry,
  }: TrackTableRowProps) => {
    const [isRetrying, setIsRetrying] = useState(false);
    console.log("Rendering TrackTableRow:", track);
    const handleRetry = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRetrying) return;
      setIsRetrying(true);
      try {
        await onRetry(track);
        toast.success("Retry queued");
      } catch {
        toast.error("Retry failed");
        setIsRetrying(false);
      }
    };

    const handleCopyId = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(track._id);
      toast.success("Copied ID");
    };

    const statusKey = isRetrying ? "processing" : track.status;
    const statusConfig = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];

    return (
      <TableRow
        className={cn(
          "group transition-colors border-b hover:bg-muted/40",
          isActive && "bg-primary/5 hover:bg-primary/10",
          isSelected && "bg-secondary/40",
          track.status === "failed" &&
            "bg-destructive/5 hover:bg-destructive/10",
        )}
      >
        {/* Checkbox */}
        <TableCell
          className="w-10 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onSelect(track._id, checked as boolean)
            }
          />
        </TableCell>

        {/* Index / Playing */}
        <TableCell className="w-12 text-center">
          {isActive && isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-4">
              <span className="w-0.5 bg-primary animate-music-bar-1" />
              <span className="w-0.5 bg-primary animate-music-bar-2" />
              <span className="w-0.5 bg-primary animate-music-bar-3" />
              <span className="w-0.5 bg-primary animate-music-bar-4" />
              <span className="w-0.5 bg-primary animate-music-bar-5" />
            </div>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              {(index + 1).toString().padStart(2, "0")}
            </span>
          )}
        </TableCell>

        {/* Track Info */}
        <TableCell className="py-2">
          <div className="flex items-center gap-3">
            <div
              className="relative size-10 rounded-md overflow-hidden cursor-pointer"
              onClick={onPlay}
            >
              <img
                src={track.coverImage}
                className={cn(
                  "size-full object-cover transition",
                  isActive && "opacity-60",
                )}
              />
              {track.status === "ready" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  {isActive && isPlaying ? (
                    <Pause className="size-4 text-white fill-white" />
                  ) : (
                    <Play className="size-4 text-white fill-white" />
                  )}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p
                className={cn(
                  "font-bold truncate",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                {track.title}
              </p>
              <Link
                to={`/artist/${track.artist?.slug}`}
                className="text-xs text-muted-foreground sm:hidden"
              >
                {track.artist?.name}
              </Link>
            </div>
          </div>
        </TableCell>

        {/* Artist */}
        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
          <Link
            to={`/artist/${track.artist?.slug}`}
            className="hover:underline"
          >
            {track.artist?.name}
          </Link>
          {track.featuringArtists.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {" "}
              (ft.{" "}
              {track.featuringArtists
                .map((artist) => (
                  <Link
                    key={artist._id}
                    to={`/artist/${artist.slug}`}
                    className="hover:underline"
                  >
                    {artist.name}
                  </Link>
                ))
                .join(", ")}
              )
            </span>
          )}
        </TableCell>

        {/* Album */}
        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Disc className="size-3 opacity-50" />
            {track.album ? (
              <Link
                to={`/albums/${track.album.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {track.album.title}
              </Link>
            ) : (
              "Single"
            )}
          </div>
        </TableCell>

        {/* Status */}
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={cn("text-[10px]", statusConfig.className)}>
                  {(statusConfig.animate || isRetrying) && (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  )}
                  {statusConfig.label}
                </Badge>
              </TooltipTrigger>
              {track.status === "failed" && track.errorReason && (
                <TooltipContent className="max-w-xs text-xs">
                  {track.errorReason}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {(track.status === "failed" || track.status === "pending") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRetry}
              className="ml-1"
            >
              <RefreshCcw className="size-4" />
            </Button>
          )}
        </TableCell>

        {/* Duration */}
        <TableCell className="hidden lg:table-cell text-xs font-mono">
          {formatDuration(track.duration)}
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(track)}>
                <Edit className="size-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyId}>
                <Copy className="size-4 mr-2" /> Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(track)}
              >
                <Trash2 className="size-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  },
);
export default TrackTableRow;
TrackTableRow.displayName = "TrackTableRow";
