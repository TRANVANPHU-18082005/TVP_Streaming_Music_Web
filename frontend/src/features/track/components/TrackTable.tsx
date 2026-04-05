/**
 * TrackTable — Production-grade table with glassmorphism design
 * Design: SOUNDWAVE Obsidian Luxury system
 * Features: Spotify-style play logic, full a11y, responsive columns, smooth states
 */

import React, { useCallback, useMemo, memo } from "react";
import { TrackTableRow } from "./TrackTableRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Music2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { setQueue, setIsPlaying } from "@/features/player";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ITrack } from "@/features/track/types";
import MusicResult from "@/components/ui/Result";
import TableSkeleton from "@/components/ui/TableSkeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackTableProps {
  tracks: ITrack[];
  isLoading: boolean;
  selectedIds: string[];
  startIndex?: number;
  onSelectOne: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (track: ITrack) => void;
  onDelete: (track: ITrack) => void;
  onRetry: (track: ITrack) => Promise<void>;
}

// ─── Column header config — single source of truth ───────────────────────────

// const COLUMNS = [
//   { key: "check", label: "", className: "w-10 pl-3 pr-1" },
//   { key: "index", label: "#", className: "w-10 text-center px-0" },
//   { key: "track", label: "Track", className: "pl-2" },
//   { key: "artist", label: "Artist", className: "hidden sm:table-cell" },
//   { key: "album", label: "Album", className: "hidden md:table-cell" },
//   { key: "status", label: "Status", className: "w-[160px]" },
//   {
//     key: "duration",
//     label: "duration-icon",
//     className: "hidden lg:table-cell w-16 text-center",
//   },
//   { key: "actions", label: "", className: "w-12 pr-3" },
// ] as const;

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <TableRow className="hover:bg-transparent border-none">
    <TableCell colSpan={8} className="h-[400px] p-0">
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-up">
        <div className="size-16 rounded-2xl bg-muted/50 border border-border/30 flex items-center justify-center">
          <Music2 className="size-7 text-muted-foreground/40" />
        </div>
        <MusicResult
          status="empty"
          title="Your library is empty"
          description="No tracks match your current selection or filters."
        />
      </div>
    </TableCell>
  </TableRow>
));
EmptyState.displayName = "EmptyState";

// ─── Table Header ─────────────────────────────────────────────────────────────

interface TrackTableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
}

const TrackTableHeader = memo(
  ({ isAllSelected, isIndeterminate, onSelectAll }: TrackTableHeaderProps) => (
    <TableHeader>
      <TableRow className="hover:bg-transparent border-b border-border/40">
        {/* Checkbox */}
        <TableHead className="w-10 pl-3 pr-1">
          <Checkbox
            checked={isAllSelected}
            data-state={isIndeterminate ? "indeterminate" : undefined}
            onCheckedChange={(val) => onSelectAll(val as boolean)}
            aria-label="Select all tracks"
            className="transition-transform active:scale-90"
          />
        </TableHead>

        {/* Index */}
        <TableHead className="w-10 text-center px-0">
          <Hash className="size-3 mx-auto text-muted-foreground/50" />
        </TableHead>

        {/* Track */}
        <TableHead className="pl-2">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">
            Track
          </span>
        </TableHead>

        {/* Artist */}
        <TableHead className="hidden sm:table-cell">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">
            Artist
          </span>
        </TableHead>

        {/* Album */}
        <TableHead className="hidden md:table-cell">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">
            Album
          </span>
        </TableHead>

        {/* Status */}
        <TableHead className="w-[160px]">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60">
            Status
          </span>
        </TableHead>

        {/* Duration */}
        <TableHead className="hidden lg:table-cell w-16 text-center">
          <Clock className="size-3 mx-auto text-muted-foreground/50" />
        </TableHead>

        {/* Actions spacer */}
        <TableHead className="w-12 pr-3" />
      </TableRow>
    </TableHeader>
  ),
);
TrackTableHeader.displayName = "TrackTableHeader";

// ─── Main Component ───────────────────────────────────────────────────────────

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  isLoading,
  selectedIds,
  startIndex = 0,
  onSelectOne,
  onSelectAll,
  onEdit,
  onDelete,
  onRetry,
}) => {
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying } = useAppSelector((s) => s.player);

  // ── Selection state ──────────────────────────────────────────────────────
  const { isAllSelected, isIndeterminate } = useMemo(() => {
    const count = selectedIds.length;
    return {
      isAllSelected: tracks.length > 0 && count === tracks.length,
      isIndeterminate: count > 0 && count < tracks.length,
    };
  }, [tracks.length, selectedIds.length]);

  // ── Spotify-style play: toggle if active, else start queue at index ───────
  const handlePlayTrack = useCallback(
    (track: ITrack, index: number) => {
      if (currentTrack?._id === track._id) {
        dispatch(setIsPlaying(!isPlaying));
        return;
      }
      dispatch(setQueue({ tracks, startIndex: index }));
    },
    [currentTrack?._id, isPlaying, tracks, dispatch],
  );

  return (
    <div
      className={cn(
        // Container: glass card with layered shadows
        "relative w-full overflow-hidden rounded-2xl",
        "border border-border/40",
        "bg-card/40 backdrop-blur-md",
        "shadow-elevated",
        // Subtle top highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent",
        "before:pointer-events-none before:z-10",
      )}
    >
      <Table>
        <TrackTableHeader
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onSelectAll={onSelectAll}
        />

        <TableBody>
          {isLoading ? (
            <TableSkeleton rows={8} cols={8} hasAvatar />
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
                onEdit={onEdit}
                onDelete={onDelete}
                onRetry={onRetry}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </TableBody>
      </Table>
    </div>
  );
};

TrackTable.displayName = "TrackTable";
export default TrackTable;
