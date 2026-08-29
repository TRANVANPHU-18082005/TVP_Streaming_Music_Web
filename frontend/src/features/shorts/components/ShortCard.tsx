import { ITrackShort } from "../types";
import { motion } from "framer-motion";
import { Edit2, Trash2, Eye, TvMinimalPlay, Sparkles, BadgeCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface ShortCardProps {
  short: ITrackShort;
  index: number;
  onEdit: (short: ITrackShort) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, isPublished: boolean) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

// Format số lớn
const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n || 0);
};

export const ShortCard = ({
  short,
  index,
  onEdit,
  onDelete,
  onTogglePublish,
  isSelected,
  onSelect,
}: ShortCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer ${isSelected
        ? "border-primary shadow-md shadow-primary/20 ring-1 ring-primary"
        : "border-border/50 hover:border-primary/50 hover:shadow-xl dark:hover:shadow-black/40 hover:-translate-y-1"
        } bg-card`}
    >
      {/* ── Thumbnail (9:16 ratio) ────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden bg-neutral-900"
        style={{ aspectRatio: "9/16" }}
      >
        <ImageWithFallback
          src={short.moodVideo?.thumbnailUrl || short.track?.coverImage}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Select checkbox */}
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(short._id); }}
            className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md border-2 transition-all duration-200 flex items-center justify-center shadow-sm ${isSelected
              ? "bg-primary border-primary"
              : "bg-black/40 border-white/60 opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:border-white"
              }`}
          >
            {isSelected && <BadgeCheck className="w-4 h-4 text-white" />}
          </button>
        )}

        {/* AI Badge */}
        {short.suggestedByAi && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1 bg-indigo-500/90 shadow-sm backdrop-blur-sm px-1.5 py-0.5 rounded-md">
              <Sparkles className="w-2.5 h-2.5 text-white" />
              <span className="text-white text-[9px] font-bold">AI</span>
            </div>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 z-10 bg-black/70 shadow-sm backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-white font-mono">
          {short.duration?.toFixed(0)}s
        </div>

        {/* Publish status */}
        <div className="absolute bottom-2 left-2 z-10">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm ${short.isPublished
            ? "bg-emerald-500/90 text-white"
            : "bg-black/70 backdrop-blur-sm text-white/80"
            }`}>
            {short.isPublished ? (
              <><TvMinimalPlay className="w-2.5 h-2.5" /> Live</>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-current inline-block" /> Draft</>
            )}
          </span>
        </div>

        {/* Hover action overlay */}
        <div className="absolute inset-0 z-10 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(short); }}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-primary/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 text-white"
            title="Chỉnh sửa"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(short._id); }}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-destructive/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 text-white"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Card Info ─────────────────────────────────────────────────────── */}
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Track title + artist */}
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-tight">
            {short.track?.title || "Unknown track"}
          </p>

        </div>

        {/* Time range */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
            {short.startTime?.toFixed(0)}s — {short.endTime?.toFixed(0)}s
          </Badge>
          {short.title && (
            <span className="text-[10px] text-muted-foreground truncate italic flex-1">
              "{short.title}"
            </span>
          )}
        </div>



        {/* Publish toggle */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {short.isPublished ? "Đang hiển thị" : "Ẩn"}
          </span>
          <Switch
            checked={short.isPublished}
            onCheckedChange={(checked) => onTogglePublish(short._id, checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </motion.div>
  );
};
