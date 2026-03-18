import React, { useCallback, useMemo } from "react";
import { TrackTableRow } from "./TrackTableRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MusicResult from "@/components/ui/Result";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { setQueue, setIsPlaying } from "@/features/player";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";
import { Clock } from "lucide-react";

interface TrackTableProps {
  tracks: ITrack[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectOne: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (track: ITrack) => void;
  onRetry: (track: ITrack) => Promise<void>; // Chuyển thành Promise để đồng bộ với state nội bộ của Row
  onDelete: (track: ITrack) => void;
  startIndex: number;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  isLoading,
  selectedIds,
  onSelectOne,
  onSelectAll,
  onEdit,
  onDelete,
  onRetry,
  startIndex,
}) => {
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying } = useAppSelector((state) => state.player);

  // Memoize check all state
  const isAllSelected = useMemo(
    () => tracks.length > 0 && selectedIds.length === tracks.length,
    [tracks.length, selectedIds.length],
  );

  /**
   * ✅ PLAY LOGIC CHUẨN SPOTIFY (Sử dụng useCallback để tối ưu re-render)
   */
  const handlePlayTrack = useCallback(
    (track: ITrack, index: number) => {
      // 1. Nếu click vào bài đang phát -> Toggle Play/Pause
      if (currentTrack?._id === track._id) {
        dispatch(setIsPlaying(!isPlaying));
        return;
      }

      // 2. Nếu click bài khác -> Thay đổi toàn bộ danh sách phát bắt đầu từ vị trí bài đó
      dispatch(
        setQueue({
          tracks,
          startIndex: index,
        }),
      );
    },
    [currentTrack?._id, isPlaying, tracks, dispatch],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm shadow-xl transition-all">
      <Table>
        {/* ================= HEADER (Layout Spotify-Style) ================= */}
        <TableHeader className="bg-muted/40 border-b border-border/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 px-2 text-center">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(val) => onSelectAll(val as boolean)}
                className="transition-transform active:scale-90"
              />
            </TableHead>

            <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              #
            </TableHead>

            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Track Details
            </TableHead>

            <TableHead className="hidden sm:table-cell text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Artist
            </TableHead>

            <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Album / Release
            </TableHead>

            <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Process Status
            </TableHead>

            <TableHead className="hidden lg:table-cell w-20 text-center text-muted-foreground/70">
              <Clock className="size-3.5 mx-auto" />
            </TableHead>

            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        {/* ================= BODY ================= */}
        <TableBody>
          {isLoading ? (
            <TableSkeleton rows={8} cols={8} hasAvatar={true} />
          ) : tracks.length > 0 ? (
            tracks.map((track, i) => (
              <TrackTableRow
                key={track._id}
                track={track}
                index={startIndex + i}
                isActive={currentTrack?._id === track._id}
                isPlaying={isPlaying}
                isSelected={selectedIds.includes(track._id)}
                onSelect={onSelectOne}
                onPlay={() => handlePlayTrack(track, i)}
                onRetry={onRetry}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          ) : (
            <TableRow className="hover:bg-transparent border-none">
              <TableCell colSpan={8} className="h-[400px] text-center p-0">
                <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                  <MusicResult
                    status="empty"
                    title="Library empty"
                    description="No tracks match your current selection or filters."
                  />
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 💡 Overlay mỏng phía dưới nếu đang fetching dữ liệu mới */}
    </div>
  );
};
export default TrackTable;
TrackTable.displayName = "TrackTable";
