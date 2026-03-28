/**
 * @file PublicAlbumCard.tsx — Album browsing card (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs original:
 * ─ Full Soundwave token integration: .album-card, .control-btn--primary,
 *   .badge-playing, .shadow-glow-md, .text-track-title, .text-track-meta
 * ─ Removed console.log (debug artifact)
 * ─ Loading state: Loader2 spinner preserved, now inside control-btn--primary
 * ─ Like button uses .like-btn token with liked state glow
 * ─ Dropdown: glass-frosted panel, .menu-item tokens
 * ─ Artist link: stops propagation, hover underline preserved
 * ─ Type badge: badge-muted → badge system from index.css
 * ─ memo() + custom comparator — prevents re-render when unrelated parent
 *   state changes (e.g. other card's play state)
 * ─ useCallback on all handlers — stable refs, safe for memo children
 * ─ releaseYear derived outside render via useMemo
 */

import { useState, useCallback, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Play,
  MoreVertical,
  Heart,
  Share2,
  PlusCircle,
  Disc3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Album } from "@/features/album/types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PublicAlbumCardProps {
  album: Album;
  className?: string;
  artistName?: string;
  onPlay?: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PublicAlbumCard = memo<PublicAlbumCardProps>(
  function PublicAlbumCard({
    album,
    className,
    artistName = album.artist?.name,
    onPlay,
  }) {
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(false);
    const [isLoadingPlay, setIsLoadingPlay] = useState(false);

    /** Release year — derived once, not on every render */
    const releaseYear = useMemo(
      () => album.releaseYear || new Date().getFullYear(),
      [album.releaseYear],
    );

    const handleNavigate = useCallback(() => {
      navigate(`/albums/${album.slug || album._id}`);
    }, [navigate, album.slug, album._id]);

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

    return (
      <article
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
        aria-label={`Album: ${album.title}`}
        className={cn(
          "group cursor-pointer flex flex-col gap-3",
          // .album-card from index.css §11 — handles hover lift + overlay reveal
          "album-card",
          // Override album-card's built-in overflow:hidden for the outer wrapper
          // so dropdown isn't clipped; clip is on the artwork container instead
          "!overflow-visible",
          className,
        )}
      >
        {/* ═══════════════════ ARTWORK ═══════════════════ */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden",
            "rounded-[18px]",
            "bg-muted",
            "border border-border/10",
            "shadow-raised group-hover:shadow-elevated",
            "transition-shadow duration-500",
          )}
        >
          {/* Cover image */}
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            loading="lazy"
            decoding="async"
            className={cn(
              "size-full object-cover",
              "transition-transform duration-700 ease-out",
              "group-hover:scale-105",
              "[will-change:transform]",
            )}
          />

          {/* Gradient overlay — dark bottom for legibility, darkens on hover */}
          <div
            className={cn(
              "absolute inset-0",
              "bg-gradient-to-t from-black/70 via-black/10 to-transparent",
              "opacity-50 group-hover:opacity-100",
              "transition-opacity duration-300",
            )}
          />

          {/* Hover darken layer */}
          <div
            className={cn(
              "absolute inset-0 bg-black/15",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300",
            )}
          />

          {/* ── Album type badge — top-left ── */}
          {album.type && (
            <div
              className={cn(
                "absolute top-2.5 left-2.5 z-10",
                "badge badge-muted",
                "bg-black/40 backdrop-blur-md border-white/15 text-white",
                "uppercase tracking-[0.14em] text-[9px] font-bold",
              )}
            >
              {album.type}
            </div>
          )}

          {/* ── Center play button — .control-btn--primary token ── */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <button
              type="button"
              onClick={handlePlay}
              disabled={isLoadingPlay}
              aria-label={isLoadingPlay ? "Loading…" : `Play ${album.title}`}
              className={cn(
                "control-btn control-btn--primary",
                "size-14 sm:size-16",
                "transition-all duration-300 ease-out",
                isLoadingPlay
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-75 translate-y-3 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0",
              )}
            >
              {isLoadingPlay ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <Play
                  className="size-6 ml-0.5 fill-current"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* ── Top-right actions (desktop) ── */}
          <div
            className={cn(
              "absolute top-2.5 right-2.5 z-20",
              "hidden lg:flex flex-col gap-1.5",
              "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
              "transition-all duration-300",
            )}
          >
            {/* Like button — .like-btn token */}
            <button
              type="button"
              onClick={handleLike}
              aria-label={isLiked ? "Unlike" : "Like"}
              aria-pressed={isLiked}
              className={cn(
                "like-btn",
                "flex items-center justify-center size-9 rounded-full",
                "bg-black/40 hover:bg-black/60 backdrop-blur-md",
                "border border-white/20 text-white",
                "transition-all duration-200",
                isLiked && "liked text-rose-400",
              )}
            >
              <Heart
                className={cn("size-4", isLiked && "fill-current")}
                aria-hidden="true"
              />
            </button>

            {/* Kebab menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={stopProp}>
                <button
                  type="button"
                  aria-label="More options"
                  className={cn(
                    "flex items-center justify-center size-9 rounded-full",
                    "bg-black/40 hover:bg-black/60 backdrop-blur-md",
                    "border border-white/20 text-white",
                    "transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <MoreVertical className="size-4" aria-hidden="true" />
                </button>
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
                  className="menu-item font-medium cursor-pointer"
                >
                  <Play className="mr-2 size-4" aria-hidden="true" />
                  Phát ngay
                </DropdownMenuItem>
                <DropdownMenuItem className="menu-item font-medium cursor-pointer">
                  <PlusCircle className="mr-2 size-4" aria-hidden="true" />
                  Thêm vào thư viện
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="menu-item font-medium cursor-pointer">
                  <Share2 className="mr-2 size-4" aria-hidden="true" />
                  Chia sẻ
                </DropdownMenuItem>
                <DropdownMenuItem className="menu-item font-medium cursor-pointer">
                  <Disc3 className="mr-2 size-4" aria-hidden="true" />
                  Xem nghệ sĩ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ── Playing indicator glow — shown when loading/playing ── */}
          {isLoadingPlay && (
            <div
              className="absolute inset-0 rounded-[18px] ring-2 ring-primary/60 shadow-glow-sm pointer-events-none"
              aria-hidden="true"
            />
          )}
        </div>

        {/* ═══════════════════ INFO ═══════════════════ */}
        <div className="flex flex-col gap-0.5 px-0.5">
          <h3
            className={cn(
              "text-track-title truncate",
              "text-foreground group-hover:text-primary",
              "transition-colors duration-200",
            )}
            title={album.title}
          >
            {album.title}
          </h3>

          <div className="flex items-center gap-1.5 text-track-meta">
            <Link
              to={`/artists/${album.artist?.slug || album.artist?._id}`}
              onClick={stopProp}
              className="truncate hover:text-foreground hover:underline transition-colors duration-150"
              title={artistName}
            >
              {artistName || ""}
            </Link>
            <span
              className="size-1 rounded-full bg-muted-foreground/40 shrink-0"
              aria-hidden="true"
            />
            <span className="shrink-0 text-duration">{releaseYear}</span>
          </div>
        </div>
      </article>
    );
  },
  // Custom comparator — prevents re-render when parent play state changes
  // for a sibling card; only re-renders when this card's own data changes
  (prev, next) =>
    prev.album._id === next.album._id &&
    prev.album.coverImage === next.album.coverImage &&
    prev.album.title === next.album.title &&
    prev.artistName === next.artistName &&
    prev.onPlay === next.onPlay &&
    prev.className === next.className,
);

export default PublicAlbumCard;
