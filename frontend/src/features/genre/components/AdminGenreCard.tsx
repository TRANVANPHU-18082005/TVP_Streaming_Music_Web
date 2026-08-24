import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  MoreVertical,
  Edit,
  Trash2,
  TrendingUp,
  RotateCcw,
  PowerOff,
  Power,
  Hash
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { IGenre } from "../types";
import { Link } from "react-router-dom";

interface AdminGenreCardProps {
  genre: IGenre;
  onEdit: (genre: IGenre) => void;
  onDelete: (genre: IGenre) => void;
  onRestore: (genre: IGenre) => void;
  onToggleStatus: (genre: IGenre) => void;
  isMutating: boolean;
}

const AdminGenreCard: React.FC<AdminGenreCardProps> = ({
  genre,
  onEdit,
  onDelete,
  onRestore,
  onToggleStatus,
  isMutating,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="group bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
      >
        {/* ================= ARTWORK ================= */}
        <div
          className="relative aspect-square overflow-hidden bg-muted cursor-pointer"
          style={{ background: genre.gradient || genre.color || "var(--muted)" }}
        >
          {genre.image ? (
            <ImageWithFallback
              src={genre.image}
              alt={genre.name}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105 mix-blend-overlay opacity-80 group-hover:opacity-100"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-white/30 font-bold text-4xl uppercase tracking-wider mix-blend-overlay">
              {genre.name.substring(0, 2)}
            </div>
          )}

          {/* Gradient Overlay for Text/Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* Top Badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start z-10 gap-1 flex-wrap">
            <Badge
              style={{ backgroundColor: genre.color || "#121212" }}
              className="text-[10px] uppercase tracking-widest text-white backdrop-blur-md border border-white/20 shadow-sm shadow-black/50"
            >
              Genre
            </Badge>

            {genre.isTrending && (
              <Badge
                className="text-[10px] uppercase tracking-widest shadow-md flex items-center gap-1 bg-amber-500/90 text-white border-none hover:bg-amber-500"
              >
                <TrendingUp className="size-3" /> Trending
              </Badge>
            )}

            {!genre.isActive && (
              <Badge
                variant="destructive"
                className="text-[10px] uppercase tracking-widest shadow-md flex items-center gap-1 bg-red-500/90 hover:bg-red-500"
              >
                Inactive
              </Badge>
            )}
          </div>
        </div>

        {/* ================= INFO AREA ================= */}
        <div className="p-2 md:p-4 flex flex-col gap-2 flex-1">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <Link
                to={`/genres/${genre.slug}`}
                className="font-bold text-sm md:text-base leading-tight truncate text-foreground group-hover:text-primary transition-colors"
                title={genre.name}
              >
                {genre.name}
              </Link>
              <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5" title={genre.description}>
                {genre.description || <span className="italic opacity-60">No description</span>}
              </p>
            </div>

            {/* Action Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 -mr-2 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl">
                <DropdownMenuItem
                  onClick={(e) => handleAction(e, () => onEdit(genre))}
                  className="font-medium cursor-pointer"
                >
                  <Edit className="mr-2 size-4 text-primary" /> Edit details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => handleAction(e, () => onToggleStatus(genre))}
                  className="font-medium cursor-pointer"
                >
                  {genre.isActive ? (
                    <>
                      <PowerOff className="mr-2 size-4 text-warning" /> Hide genre
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 size-4 text-success" /> Show genre
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                {genre.isDeleted ? (
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, () => onRestore(genre))}
                    className="font-medium cursor-pointer text-success"
                  >
                    <RotateCcw className="mr-2 size-4" /> Restore genre
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, () => setShowDeleteConfirm(true))}
                    className="font-medium text-destructive focus:text-destructive cursor-pointer focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 size-4" /> Delete genre
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Metadata Footer */}
          <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/50 text-[7px] md:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-1.5" title="Priority">
              <Hash className="size-3.5 opacity-70" />
              <span>Priority: {genre.priority || 0}</span>
            </div>
            <div className="size-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5" title="Tracks">
              <span>{genre.trackCount || 0} tracks</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDelete(genre);
          setShowDeleteConfirm(false);
        }}
        title="Xóa thể loại?"
        variant="destructive"
        isLoading={isMutating}
        countdownSeconds={3}
        description={
          <div className="space-y-4">
            <p className="text-sm text-foreground/80">
              Bạn có chắc chắn muốn xóa thể loại{" "}
              <strong className="text-foreground text-base">
                {genre.name}
              </strong>
              ?
            </p>
            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl text-xs text-destructive leading-relaxed font-medium">
              Thao tác này không thể hoàn tác. Các bài hát liên quan sẽ mất liên kết với thể loại này.
            </div>
          </div>
        }
        confirmLabel="Xóa"
        isDestructive
      />
    </>
  );
};

export default AdminGenreCard;
