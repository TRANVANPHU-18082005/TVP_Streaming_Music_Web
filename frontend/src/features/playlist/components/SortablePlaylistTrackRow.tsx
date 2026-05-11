import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Disc, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ITrack } from "@/features/track/types";
import { memo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SortablePlaylistTrackRowProps {
  track: ITrack;
  index: number;
  onRemove?: (id: string) => void;
  /** true khi đang xử lý xóa track này */
  isRemoving?: boolean;
  /** Hiện số thứ tự hay không */
  showIndex?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SortablePlaylistTrackRow = memo(
  ({
    track,
    index,
    onRemove,
    isRemoving = false,
    showIndex = true,
  }: SortablePlaylistTrackRowProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: track._id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition ?? "transform 200ms ease",
      zIndex: isDragging ? 999 : undefined,
      position: "relative" as const,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl border transition-all duration-200 select-none",
          isDragging
            ? [
                "bg-background border-primary/60",
                "shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)] ring-1 ring-primary/20",
                "scale-[1.025] opacity-95 cursor-grabbing",
              ]
            : [
                "bg-card border-border/40",
                "hover:border-border/70 hover:shadow-sm",
                onRemove && "hover:border-destructive/20",
              ],
        )}
        aria-label={`${track.title} — vị trí ${index + 1}`}
      >
        {/* ── Drag handle ── */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            "flex items-center justify-center size-8 rounded-xl flex-shrink-0",
            "touch-none outline-none cursor-grab active:cursor-grabbing",
            "transition-colors duration-150",
            isDragging
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/60",
          )}
          aria-label="Kéo để thay đổi vị trí"
          title="Kéo để sắp xếp"
        >
          <GripVertical className="size-4" />
        </button>

        {/* ── Index badge ── */}
        {showIndex && (
          <div
            className={cn(
              "hidden sm:flex items-center justify-center size-7 rounded-lg flex-shrink-0",
              "text-[10px] font-mono font-bold tabular-nums",
              "bg-muted/60 text-muted-foreground/60 transition-colors",
              isDragging && "bg-primary/10 text-primary/70",
            )}
          >
            {(index + 1).toString().padStart(2, "0")}
          </div>
        )}

        {/* ── Avatar ── */}
        <Avatar
          className={cn(
            "size-10 rounded-xl flex-shrink-0 border border-border/50 transition-all duration-200",
            isDragging ? "shadow-md" : "shadow-sm group-hover:shadow-md",
          )}
        >
          <AvatarImage
            src={track.coverImage}
            alt={track.title}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted text-muted-foreground/50 rounded-xl">
            <Disc className="size-4 opacity-40" />
          </AvatarFallback>
        </Avatar>

        {/* ── Track info ── */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[13px] font-semibold truncate leading-snug transition-colors",
              isDragging ? "text-primary" : "text-foreground",
            )}
          >
            {track.title}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {track.artist?.name ?? "Unknown Artist"}
          </p>
        </div>

        {/* ── Remove button (optional) ── */}
        {onRemove && (
          <button
            type="button"
            onClick={() => !isRemoving && onRemove(track._id)}
            disabled={isRemoving}
            aria-label={`Xóa "${track.title}" khỏi playlist`}
            className={cn(
              "flex items-center justify-center size-8 rounded-full flex-shrink-0",
              "transition-all duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-destructive/50",
              isRemoving
                ? "cursor-wait text-muted-foreground/30"
                : "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 active:scale-90",
            )}
          >
            {isRemoving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        )}
      </div>
    );
  },
);

SortablePlaylistTrackRow.displayName = "SortablePlaylistTrackRow";
export default SortablePlaylistTrackRow;
