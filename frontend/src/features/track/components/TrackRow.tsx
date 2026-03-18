// src/features/track/components/TrackRow.tsx
import React, { memo } from "react";
import { Play, Pause, MoreHorizontal } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/track-helper";
import { Link } from "react-router-dom";
import { ITrack } from "@/features/track/types";
import { LikeButton } from "@/features";

interface TrackRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export const TrackRow = memo(
  ({ track, index, isActive, isPlaying, onPlay }: TrackRowProps) => {
    const showBars = isActive && isPlaying;

    return (
      <TableRow
        className={cn(
          "group h-14 transition-colors",
          "hover:bg-white/5",
          isActive && "bg-white/10",
        )}
      >
        {/* ===== PLAY ZONE ===== */}
        <TableCell className="w-12 px-0 text-center">
          <div
            className="relative flex items-center justify-center h-5 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            {showBars ? (
              <div className="flex items-end justify-center gap-0.5 h-4">
                <span className="w-0.5 bg-primary animate-music-bar-1" />
                <span className="w-0.5 bg-primary animate-music-bar-2" />
                <span className="w-0.5 bg-primary animate-music-bar-3" />
                <span className="w-0.5 bg-primary animate-music-bar-4" />
                <span className="w-0.5 bg-primary animate-music-bar-5" />
              </div>
            ) : (
              <>
                <span className="group-hover:hidden text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hidden group-hover:flex h-8 w-8 absolute"
                >
                  {isActive && isPlaying ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </TableCell>

        {/* ===== TRACK INFO ===== */}
        <TableCell className="pl-2">
          <div className="flex items-center gap-3">
            {/* COVER PLAY */}
            <div
              className="relative size-10 rounded overflow-hidden cursor-pointer"
              onClick={onPlay}
            >
              <img src={track.coverImage} className="size-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition">
                {isActive && isPlaying ? (
                  <Pause className="size-4 text-white" />
                ) : (
                  <Play className="size-4 text-white" />
                )}
              </div>
            </div>

            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                {track.title}
              </p>

              {/* LINKS — NO PLAY */}
              <p className="truncate text-xs text-muted-foreground">
                <Link
                  to={`/artists/${track.artist?.slug}`}
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {track.artist?.name}
                </Link>
              </p>
            </div>
          </div>
        </TableCell>

        {/* ===== ALBUM ===== */}
        <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate">
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
        </TableCell>

        {/* ===== DURATION + ACTION ===== */}
        <TableCell className="w-28 pr-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <LikeButton
              trackId={track._id}
              isLiked={track.isLiked || false}
              size="sm"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(track.duration)}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Thêm vào danh sách chờ</DropdownMenuItem>
                <DropdownMenuItem>Thêm vào Playlist</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  },
);
export default TrackRow;
TrackRow.displayName = "TrackRow";
