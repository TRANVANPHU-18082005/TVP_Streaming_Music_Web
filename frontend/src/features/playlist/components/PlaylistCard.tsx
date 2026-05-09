import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MoreVertical,
  Edit,
  Trash2,
  Globe,
  User,
  FolderKanban,
  Play,
  ListMusic,
  ArrowUpLeftSquare,
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
import { EditPlaylistTracksModal } from "@/features/playlist/components/EditPlaylistTracksModal";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback"; // Dùng chung component ảnh xịn
import { IPlaylist } from "../types";
import { cn } from "@/lib/utils";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

interface PlaylistCardProps {
  playlist: IPlaylist;
  isMutating: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  isMutating,
  onEdit,
  onDelete,
}) => {
  console.log(playlist);
  const navigate = useNavigate();
  const [editTrackPlaylist, setEditTrackPlaylist] = useState(false);
  const [deletePlaylist, setDeletePlaylist] = useState(false);
  const handleNavigate = () => {
    navigate(`/playlists/${playlist._id}`);
  };

  // Helper ngăn sự kiện click lan ra ngoài thẻ cha
  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={handleNavigate}
        className="group cursor-pointer bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
      >
        {/* ================= ARTWORK ================= */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          <ImageWithFallback
            src={playlist.coverImage}
            alt={playlist.title}
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {/* Gradient Overlay for Text/Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* Top Badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start z-10">
            {playlist.isSystem ? (
              <Badge className="text-[10px] uppercase tracking-widest bg-indigo-500/90 hover:bg-indigo-500 text-white backdrop-blur-md border-none flex items-center gap-1 shadow-md">
                <Globe className="size-3" /> System
              </Badge>
            ) : (
              <Badge className="text-[10px] uppercase tracking-widest bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border-none flex items-center gap-1">
                <User className="size-3" /> User
              </Badge>
            )}
          </div>

          {/* Center Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="icon"
              className="
                size-12 sm:size-14 rounded-full
                bg-primary text-primary-foreground
                shadow-[0_24px_80px_rgba(0,0,0,0.6)]
                opacity-0 scale-90
                transition-all duration-300
                group-hover:opacity-100 group-hover:scale-100
              "
            >
              <Play className="size-5 sm:size-6 ml-0.5 fill-current" />
            </Button>
          </div>
        </div>

        {/* ================= INFO AREA ================= */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className="font-bold text-[15px] leading-tight truncate text-foreground group-hover:text-primary transition-colors"
                title={playlist.title}
              >
                {playlist.title}
              </h3>
              <p
                className="text-sm text-muted-foreground truncate mt-0.5"
                title={playlist.description}
              >
                {playlist.description || (
                  <span className="italic opacity-60">No description</span>
                )}
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
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem
                  onClick={(e) =>
                    handleAction(e, () => setEditTrackPlaylist(true))
                  }
                  className="font-medium cursor-pointer"
                >
                  <FolderKanban className="mr-2 size-4 text-blue-500" /> Manage
                  Tracks
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => handleAction(e, onEdit)}
                  className="font-medium cursor-pointer"
                >
                  <Edit className="mr-2 size-4 text-primary" /> Edit Details
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={(e) =>
                    handleAction(e, () => setDeletePlaylist(true))
                  }
                  className={cn(
                    "font-medium  focus:text-destructive cursor-pointer focus:bg-destructive/10",
                    playlist.isDeleted ? "text-green-500" : "text-red-500",
                  )}
                  disabled={isMutating}
                >
                  {playlist.isDeleted ? " Khôi phục" : "Xóa"}
                  {playlist.isDeleted ? (
                    <ArrowUpLeftSquare className="mr-2 size-4" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Metadata Footer */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50 text-[11px] font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[60%]">
              <User className="size-3.5 opacity-70" />
              <span className="truncate">
                {playlist.user?.fullName || "Unknown"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-foreground/80 bg-secondary/50 px-2 py-0.5 rounded-md">
              <ListMusic className="size-3.5 opacity-70 text-primary" />
              <span>{playlist.totalTracks || 0}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modal Quản lý bài hát */}
      <EditPlaylistTracksModal
        isOpen={editTrackPlaylist}
        onClose={() => setEditTrackPlaylist(false)}
        playlistId={playlist._id}
      />
      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deletePlaylist}
        onCancel={() => setDeletePlaylist(false)}
        onConfirm={onDelete}
        title={playlist.isDeleted ? "Khôi phục playlist" : "Xóa playlist?"}
        variant={playlist.isDeleted ? "info" : "destructive"}
        isLoading={isMutating}
        countdownSeconds={3}
        description={
          <div className="space-y-4">
            <p className="text-sm text-foreground/80">
              Bạn có chắc chắn muốn {playlist.isDeleted ? "Khôi phục" : "xóa"}{" "}
              {
                <strong className="text-foreground text-base">
                  {playlist.title}
                </strong>
              }
              ?
            </p>
          </div>
        }
        confirmLabel={playlist.isDeleted ? "Khôi phục" : "Xóa"}
        isDestructive
      />
    </>
  );
};

export default PlaylistCard;
