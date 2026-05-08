import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Disc,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  EyeOff,
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
import { IAlbum } from "@/features";

interface AlbumCardProps {
  album: IAlbum;
  onEdit: (album: IAlbum) => void;
  onDelete: (album: IAlbum) => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onEdit, onDelete }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/albums/${album.slug || album._id}`);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài làm chuyển trang
    action();
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      onClick={handleNavigate}
      className="group cursor-pointer bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 flex flex-col overflow-hidden"
    >
      {/* ================= ARTWORK ================= */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <ImageWithFallback
          src={album.coverImage}
          alt={album.title}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Gradient Overlay for Text/Badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start z-10">
          <Badge className="text-[10px] uppercase tracking-widest bg-black/60 text-white backdrop-blur-md border-none">
            {album.type || "Album"}
          </Badge>

          {!album.isPublic && (
            <Badge
              variant="destructive"
              className="text-[10px] uppercase tracking-widest shadow-md flex items-center gap-1 bg-red-500/90 hover:bg-red-500"
            >
              <EyeOff className="size-3" /> Private
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
              title={album.title}
            >
              {album.title}
            </h3>
            <p
              className="text-sm text-muted-foreground truncate mt-0.5"
              title={album.artist?.name}
            >
              {album.artist?.name || (
                <span className="italic opacity-60">Unknown Artist</span>
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
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem
                onClick={(e) => handleAction(e, () => onEdit(album))}
                className="font-medium cursor-pointer"
              >
                <Edit className="mr-2 size-4 text-primary" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => handleAction(e, () => onDelete(album))}
                className="font-medium text-destructive focus:text-destructive cursor-pointer focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 size-4" /> Delete album
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metadata Footer */}
        <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/50 text-[7px] md:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 opacity-70" />
            <span>{album.releaseYear || "N/A"}</span>
          </div>
          <div className="size-1 rounded-full bg-border" />
          <div className="flex items-center gap-1.5">
            <Disc className="size-3.5 opacity-70" />
            <span>{album.totalTracks || 0} tracks</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AlbumCard;
