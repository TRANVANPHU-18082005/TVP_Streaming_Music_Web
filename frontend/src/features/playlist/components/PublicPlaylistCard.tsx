import { useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  MoreHorizontal,
  Heart,
  Share2,
  PlusCircle,
  ListMusic,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Playlist } from "@/features/playlist/types";
import { LikeButton } from "@/features/interaction";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PublicPlaylistCardProps {
  playlist: Playlist;
  className?: string;
  onPlay?: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PublicPlaylistCard = memo<PublicPlaylistCardProps>(
  function PublicPlaylistCard({ playlist, className, onPlay }) {
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(false);
    const [isLoadingPlay, setIsLoadingPlay] = useState(false);

    const handleNavigate = useCallback(() => {
      navigate(`/playlists/${playlist.slug || playlist._id}`);
    }, [navigate, playlist.slug, playlist._id]);

    const handlePlay = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onPlay) return handleNavigate();
        setIsLoadingPlay(true);
        try {
          await onPlay();
        } finally {
          setIsLoadingPlay(false);
        }
      },
      [onPlay, handleNavigate],
    );

    const handleLike = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLiked((p) => !p);
    }, []);

    const stopProp = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    const creatorName = playlist.isSystem
      ? "MusicHub"
      : playlist.user?.fullName || "Ẩn danh";

    return (
      <article
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
        aria-label={`Playlist: ${playlist.title}`}
        className={cn(
          "group cursor-pointer flex flex-col gap-3",
          "album-card !overflow-visible",
          className,
        )}
      >
        {/* ═══════════════════ ARTWORK ═══════════════════ */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden",
            "rounded-[18px]",
            "bg-muted border border-border/10",
            "shadow-raised group-hover:shadow-elevated",
            "transition-shadow duration-500",
          )}
        >
          {/* Cover image or empty state */}
          {playlist.coverImage ? (
            <ImageWithFallback
              src={playlist.coverImage}
              alt={playlist.title}
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover",
                "transition-transform duration-700 ease-out",
                "group-hover:scale-105",
                "[will-change:transform]",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex size-full items-center justify-center",
                "bg-gradient-to-br from-muted via-muted to-accent",
              )}
            >
              <ListMusic
                className="size-12 text-muted-foreground/25"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className={cn(
              "absolute inset-0",
              "bg-gradient-to-t from-black/70 via-black/10 to-transparent",
              "opacity-50 group-hover:opacity-100",
              "transition-opacity duration-300",
            )}
          />
          <div
            className={cn(
              "absolute inset-0 bg-black/15",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300",
            )}
          />

          {/* ── Play button — bottom-right, .control-btn--primary ── */}
          <div
            className={cn(
              "absolute right-3 bottom-3 z-20",
              "transition-all duration-300 ease-out",
              isLoadingPlay
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
            )}
          >
            <button
              type="button"
              onClick={handlePlay}
              disabled={isLoadingPlay}
              aria-label={isLoadingPlay ? "Loading…" : `Play ${playlist.title}`}
              className={cn(
                "control-btn control-btn--primary",
                "size-12 sm:size-14",
              )}
            >
              {isLoadingPlay ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Play
                  className="size-5 ml-0.5 fill-current"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* ── Like button — top-right (desktop) ── */}
          <div
            className={cn(
              "block md:hidden absolute top-2.5 right-2.5 z-20 rounded-full",
              "md:opacity-0 md:group-hover:opacity-100 md:group-hover:flex",
              "transition-opacity duration-300",
            )}
          >
            <span
              aria-label="Trending genre" // FIX 10
              className={cn(
                "inline-flex items-center gap-1 sm:gap-1.5 shrink-0 w-50px h-8",
                // .badge pattern from index.css §14 — adapted for dark overlay context
                "rounded-full",
                "bg-white/18 backdrop-blur-md border border-white/20 p-2",
                "text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white",
                "shadow-lg",
              )}
            >
              <LikeButton id={playlist._id} size="md" type="playlist" />
            </span>
          </div>

          {/* Playing glow ring */}
          {isLoadingPlay && (
            <div
              className="absolute inset-0 rounded-[18px] ring-2 ring-primary/60 shadow-glow-sm pointer-events-none"
              aria-hidden="true"
            />
          )}
        </div>

        {/* ═══════════════════ INFO ═══════════════════ */}
        <div className="flex items-start justify-between gap-2 px-0.5 pl-2 pr-2 pb-2">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h3
              className={cn(
                "text-track-title truncate",
                "text-foreground group-hover:text-primary",
                "transition-colors duration-200",
              )}
              title={playlist.title}
            >
              {playlist.title}
            </h3>

            <div className="flex items-center gap-1.5 text-track-meta">
              <span className="truncate max-w-[110px]" title={creatorName}>
                {creatorName}
              </span>
              <span
                className="size-1 rounded-full bg-muted-foreground/40 shrink-0"
                aria-hidden="true"
              />
              <span className="shrink-0 text-duration">
                {playlist.totalTracks || 0} bài
              </span>
            </div>
          </div>

          {/* Kebab menu — desktop only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={stopProp}
                aria-label="More options"
                className={cn(
                  "hidden md:flex shrink-0",
                  "size-7 rounded-lg",
                  "text-muted-foreground/60 hover:text-foreground",
                  "hover:bg-muted/60",
                  "transition-colors duration-150",
                )}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={stopProp}
              className={cn(
                "w-48 rounded-xl",
                "glass-frosted shadow-floating",
                "border-border/40",
              )}
            >
              <DropdownMenuItem
                onClick={handlePlay}
                disabled={isLoadingPlay}
                className="menu-item cursor-pointer font-medium"
              >
                <Play className="size-4 mr-2" aria-hidden="true" />
                Phát ngay
              </DropdownMenuItem>
              <DropdownMenuItem className="menu-item cursor-pointer font-medium">
                <PlusCircle className="size-4 mr-2" aria-hidden="true" />
                Thêm vào thư viện
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="menu-item cursor-pointer font-medium">
                <Share2 className="size-4 mr-2" aria-hidden="true" />
                Chia sẻ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>
    );
  },
  // Custom comparator — stable identity, prevents sibling-play re-renders
  (prev, next) =>
    prev.playlist._id === next.playlist._id &&
    prev.playlist.coverImage === next.playlist.coverImage &&
    prev.playlist.title === next.playlist.title &&
    prev.playlist.totalTracks === next.playlist.totalTracks &&
    prev.playlist.isSystem === next.playlist.isSystem &&
    prev.playlist.isPublic === next.playlist.isPublic &&
    prev.onPlay === next.onPlay &&
    prev.className === next.className,
);

export default PublicPlaylistCard;
