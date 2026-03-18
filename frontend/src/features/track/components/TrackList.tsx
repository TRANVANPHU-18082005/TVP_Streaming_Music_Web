import React, { memo, useCallback } from "react";
import { Clock, Music2 } from "lucide-react";

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

interface TrackListProps {
  tracks: ITrack[];
  isLoading: boolean;
  className?: string;
}

// 🦴 1. Component Skeleton Row (Hiệu ứng Thác nước)
const TrackSkeleton = ({ index }: { index: number }) => (
  <TableRow
    className="border-b border-border/10 hover:bg-transparent"
    // 🔥 UX: Hiệu ứng delay tăng dần tạo cảm giác data đang chảy vào
    style={{ animationDelay: `${index * 80}ms` }}
  >
    <TableCell className="w-12 text-center py-3">
      <div className="mx-auto h-4 w-4 animate-pulse rounded bg-muted/60" />
    </TableCell>
    <TableCell className="py-3">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Ảnh bìa */}
        <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 animate-pulse rounded-md bg-muted/80 shadow-sm" />
        <div className="flex flex-col gap-2 flex-1 max-w-[200px] sm:max-w-[300px]">
          {/* Tên bài hát */}
          <div className="h-4 w-full animate-pulse rounded-md bg-muted/80" />
          {/* Nghệ sĩ */}
          <div className="h-3 w-2/3 animate-pulse rounded-md bg-muted/40" />
        </div>
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell py-3">
      <div className="h-4 w-32 animate-pulse rounded-md bg-muted/40" />
    </TableCell>
    <TableCell className="w-20 sm:w-28 text-right py-3">
      <div className="ml-auto h-4 w-10 animate-pulse rounded-md bg-muted/40" />
    </TableCell>
  </TableRow>
);

// 📭 2. Component Empty State (Premium UI)
const EmptyState = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell
      colSpan={4}
      className="h-[300px] sm:h-[400px] text-center border-b-0"
    >
      <div className="flex flex-col items-center justify-center gap-5 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative group">
          {/* Bóng sáng phía sau Icon (Glow Effect) */}
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 transition-all duration-1000 group-hover:scale-[1.7] group-hover:bg-primary/30" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-secondary/50 border border-border/40 shadow-xl backdrop-blur-sm transition-transform duration-500 group-hover:-translate-y-1">
            <Music2 className="h-8 w-8 text-muted-foreground opacity-70" />
          </div>
        </div>
        <div className="space-y-1.5 max-w-[250px] mx-auto">
          <p className="text-lg font-black tracking-tight text-foreground uppercase">
            Danh sách trống
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            Hiện tại chưa có bài hát nào ở đây. Hãy thử lại sau nhé!
          </p>
        </div>
      </div>
    </TableCell>
  </TableRow>
);

// 🎵 3. Main Component
export const TrackList = memo(
  ({ tracks, isLoading, className }: TrackListProps) => {
    const dispatch = useAppDispatch();
    const { currentTrack, isPlaying } = useAppSelector((s) => s.player);

    const handlePlayTrack = useCallback(
      (track: ITrack, index: number) => {
        // Case 1: Click lại track đang active -> Toggle Play/Pause
        if (currentTrack?._id === track._id) {
          dispatch(setIsPlaying(!isPlaying));
          return;
        }

        // Case 2: Track khác -> Set queue mới & Play
        dispatch(
          setQueue({
            tracks,
            startIndex: index,
          }),
        );
      },
      [dispatch, tracks, currentTrack, isPlaying],
    );

    return (
      <div className={cn("w-full relative", className)}>
        <Table className="w-full border-collapse">
          {/* ===== HEADER (Sticky & Glassmorphism) ===== */}
          <TableHeader className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <TableRow className="border-b border-border/20 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent">
              <TableHead className="w-10 sm:w-14 text-center h-10">#</TableHead>
              <TableHead className="h-10">Bài hát</TableHead>
              <TableHead className="hidden md:table-cell h-10">Album</TableHead>
              <TableHead className="w-20 sm:w-28 pr-4 text-right h-10">
                <Clock className="ml-auto size-4" />
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* ===== BODY ===== */}
          <TableBody>
            {/* Case 1: Đang tải dữ liệu */}
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TrackSkeleton key={`skeleton-${i}`} index={i} />
              ))
            ) : tracks.length > 0 ? (
              /* Case 2: Có dữ liệu */
              tracks.map((track, index) => (
                <TrackRow
                  key={track._id}
                  track={track}
                  index={index}
                  isActive={currentTrack?._id === track._id}
                  isPlaying={isPlaying}
                  onPlay={() => handlePlayTrack(track, index)}
                />
              ))
            ) : (
              /* Case 3: Không có dữ liệu (Empty) */
              <EmptyState />
            )}
          </TableBody>
        </Table>
      </div>
    );
  },
);

TrackList.displayName = "TrackList";
export default TrackList;
