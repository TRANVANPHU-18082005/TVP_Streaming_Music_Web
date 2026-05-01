import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Artist } from "@/features/artist/types";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Music,
  Users,
  Mic2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

// Helper lấy cờ
const getFlagEmoji = (countryCode: string) => {
  if (!countryCode) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

interface ArtistCardProps {
  artist: Artist;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

const ArtistCard: React.FC<ArtistCardProps> = ({
  artist,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const navigate = useNavigate();
  return (
    <TooltipProvider>
      <div
        className={cn(
          // Mobile: Viền đậm hơn (border-input) để tách nền rõ ràng
          "group relative flex flex-col bg-card border border-input rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300",
          "hover:shadow-xl hover:border-primary/50 hover:-translate-y-1",
          !artist.isActive && "opacity-70 grayscale-[0.8]",
        )}
      >
        {/* --- 1. COVER IMAGE AREA --- */}
        {/* Mobile: Giảm chiều cao ảnh cover xuống h-24 */}
        <div className="relative h-24 sm:h-32 w-full overflow-hidden bg-muted/20">
          {artist.coverImage ? (
            <ImageWithFallback
              src={artist.coverImage}
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-secondary/20 flex items-center justify-center">
              <Music className="size-8 text-muted-foreground/30" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

          {/* Top Actions: Giữ nguyên nhưng chỉnh size nhỏ hơn chút */}
          <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex justify-between items-center z-20">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 sm:h-8 sm:w-8 rounded-full backdrop-blur-md border border-white/20 shadow-sm",
                artist.isActive
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-black/40 text-white/70",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {artist.isActive ? (
                <Eye className="size-3.5 sm:size-4" />
              ) : (
                <EyeOff className="size-3.5 sm:size-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 bg-black/30 backdrop-blur-md border border-white/20 text-white rounded-full shadow-sm"
                >
                  <MoreHorizontal className="size-3.5 sm:size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                <DropdownMenuItem
                  onClick={onEdit}
                  className="py-2 px-3 font-medium"
                >
                  <Edit className="w-4 h-4 mr-2 text-primary" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="py-2 px-3 font-medium">
                  <ExternalLink className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                  View
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive font-bold py-2 px-3 focus:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* --- 2. INFORMATION AREA --- */}
        {/* Mobile: Giảm padding bottom (pb-3) */}
        <div className="flex flex-col items-center px-2 sm:px-4 pb-3 sm:pb-5 -mt-8 sm:-mt-10 relative z-10 flex-1 bg-card rounded-t-[1.5rem] sm:rounded-t-[2rem] border-t border-white/10 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)]">
          {/* Avatar: Mobile size-16, Desktop size-20 */}
          <div className="relative mb-2 sm:mb-3">
            <div
              className="rounded-full p-1 bg-card shadow-md border border-border/40 cursor-pointer active:scale-95 transition-transform"
              onClick={() => navigate(`/artists/${artist.slug}`)}
            >
              <Avatar className="size-16 sm:size-20 ring-4 ring-background shadow-inner">
                <AvatarImage src={artist.avatar} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-black text-lg sm:text-xl tracking-tighter">
                  {getInitialsTextAvartar(artist.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Verified Icon: Luôn hiện */}
            {artist.isVerified && (
              <div className="absolute bottom-0 right-0 bg-blue-500 p-1 rounded-full border-[3px] border-card shadow-sm z-20">
                <ShieldCheck className="size-2.5 sm:size-3 text-white fill-current" />
              </div>
            )}
          </div>

          {/* Name & Info */}
          <div className="text-center w-full space-y-1 sm:space-y-1 mb-1 sm:mb-4">
            {/* Tên: Mobile text-sm font-black, Desktop text-lg */}
            <h3 className="font-black text-sm sm:text-lg text-foreground tracking-tight line-clamp-1 flex items-center justify-center gap-1.5 px-1">
              {artist.name}
              {artist.nationality && (
                <span
                  className="text-sm sm:text-lg select-none grayscale-[0.2]"
                  title={artist.nationality}
                >
                  {getFlagEmoji(artist.nationality)}
                </span>
              )}
            </h3>

            {/* Badge Account: ẨN TRÊN MOBILE để đỡ rối, chỉ hiện Desktop */}
            <div className="hidden sm:flex items-center justify-center">
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 text-[10px] px-2 font-bold uppercase tracking-wider border",
                  artist.user
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400"
                    : "bg-muted text-muted-foreground border-border",
                )}
              >
                {artist.user ? "Verified Account" : "Internal Profile"}
              </Badge>
            </div>
          </div>

          {/* Genres: ẨN TRÊN MOBILE, Chỉ hiện Desktop */}
          <div className="hidden sm:flex flex-wrap justify-center gap-1.5 min-h-[1.5rem]">
            {artist.genres?.length > 0 ? (
              artist.genres.slice(0, 2).map((g) => (
                <Badge
                  key={g._id}
                  variant="outline"
                  className="text-[10px] px-2 h-6 font-bold uppercase bg-secondary/50 border-border/50"
                >
                  {g.name}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground font-medium italic opacity-70">
                Uncategorized
              </span>
            )}
          </div>

          {/* --- 3. STATS FOOTER --- */}
          {/* ẨN TRÊN MOBILE (hidden), Hiện trên Desktop (sm:grid) */}
          <div className="hidden sm:grid grid-cols-2 w-full mt-5 pt-4 border-t border-dashed border-border/60">
            <div className="flex flex-col items-center border-r border-dashed border-border/60">
              <div className="flex items-center gap-1.5 text-foreground/90">
                <Users className="size-3.5 text-primary" />
                <span className="text-sm font-bold tabular-nums">
                  {artist.totalFollowers?.toLocaleString() || 0}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-widest mt-0.5">
                Followers
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-foreground/90">
                <Mic2 className="size-3.5 text-primary" />
                <span className="text-sm font-bold tabular-nums">
                  {artist.totalTracks || 0}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-widest mt-0.5">
                Tracks
              </span>
            </div>
          </div>

          {/* Mobile Only: Simple Stats (Nếu muốn hiện số liệu gọn) */}
          <div className="flex sm:hidden items-center gap-3 text-[10px] font-bold text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {artist.totalFollowers || 0}
            </span>
            <span className="w-px h-3 bg-border"></span>
            <span className="flex items-center gap-1">
              <Mic2 className="size-3" /> {artist.totalTracks || 0}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ArtistCard;
