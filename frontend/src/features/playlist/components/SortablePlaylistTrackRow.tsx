import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Disc } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ITrack } from "@/features/track/types";

interface SortablePlaylistTrackRowProps {
  track: ITrack;
  index: number;
  onRemove?: (id: string) => void;
  isRemoving?: boolean;
}

export const SortablePlaylistTrackRow = ({
  track,
  index,
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
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Base styles: Cấu trúc hộp, transition mượt mà
        "group flex items-center p-2 sm:p-2.5 rounded-xl border mb-2.5 transition-all duration-200 select-none",
        // State: Đang được kéo (Dragging) -> Nổi khối lên, có viền primary, đổ bóng to
        isDragging
          ? "bg-background border-primary shadow-xl ring-1 ring-primary/20 scale-[1.02] opacity-95 z-50"
          : "bg-card border-border/50 hover:border-primary/40 hover:shadow-md hover:bg-muted/30",
      )}
    >
      {/* --- DRAG HANDLE (Điểm cầm nắm) --- */}
      {/* Hitbox lớn hơn, icon mờ khi bình thường, rõ lên khi hover/drag */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex items-center justify-center p-2.5 mr-1 sm:mr-2 rounded-lg transition-colors touch-none outline-none",
          isDragging
            ? "text-primary cursor-grabbing"
            : "text-muted-foreground/40 hover:text-foreground hover:bg-muted cursor-grab",
        )}
        title="Nhấn giữ và kéo để sắp xếp"
      >
        <GripVertical className="size-5" />
      </div>

      {/* --- THÔNG TIN BÀI HÁT --- */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pr-4">
        {/* Index: Căn giữa, font monospace để số 1 và số 0 thẳng hàng */}
        <div className="w-5 text-center hidden xs:block shrink-0">
          <span
            className={cn(
              "text-[13px] font-mono font-bold transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground/50",
            )}
          >
            {(index + 1).toString().padStart(2, "0")}
          </span>
        </div>

        {/* Cover Image */}
        <Avatar
          className={cn(
            "size-10 sm:size-12 rounded-lg shrink-0 border border-border/60 transition-transform",
            isDragging ? "shadow-md" : "shadow-sm group-hover:scale-105",
          )}
        >
          <AvatarImage src={track.coverImage} className="object-cover" />
          <AvatarFallback className="bg-muted">
            <Disc className="size-5 opacity-30 animate-pulse text-muted-foreground" />
          </AvatarFallback>
        </Avatar>

        {/* Text Info */}
        <div className="flex flex-col min-w-0 gap-0.5 flex-1">
          <h4
            className={cn(
              "text-[14px] font-bold truncate leading-tight transition-colors",
              isDragging
                ? "text-primary"
                : "text-foreground group-hover:text-primary",
            )}
          >
            {track.title}
          </h4>
          <p className="text-[12px] text-muted-foreground font-medium truncate">
            {track.artist?.name || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Lưu ý: Component này chuyên dùng cho Tab Sắp Xếp (Reorder), 
          việc loại bỏ Nút Thùng Rác (Trash) ở đây là CHUẨN UX để tránh 
          người dùng lỡ tay bấm nhầm xóa bài hát khi đang cố kéo thả. */}
    </div>
  );
};
export default SortablePlaylistTrackRow;
