"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Album } from "@/features/album/types";
import { LikeButton } from "@/features/interaction";

interface PublicAlbumCardProps {
  album: Album;
  className?: string;
  artistName?: string;
  onPlay?: () => Promise<void>;
}

const PublicAlbumCard = memo<PublicAlbumCardProps>(
  function PublicAlbumCard({
    album,
    className,
    artistName = album.artist?.name,
    onPlay,
  }) {
    const navigate = useNavigate();
    const [isLoadingPlay, setIsLoadingPlay] = useState(false);

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

    const stopProp = useCallback(
      (e: React.MouseEvent) => e.stopPropagation(),
      [],
    );

    return (
      <article
        onClick={handleNavigate}
        className={cn(
          "group flex flex-col gap-3 p-2 rounded-2xl transition-all duration-300",
          "hover:bg-muted/10", // Tạo một vùng hover nhẹ quanh card
          className,
        )}
      >
        {/* ── ARTWORK CONTAINER ── */}
        <div className="album-card aspect-square relative isolate">
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            className="img-cover transition-transform duration-700 group-hover:scale-110"
          />

          {/* Overlay gradient theo token index.css */}

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
              <LikeButton id={album._id} size="md" type="album" />
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          {/* Play Button - Center Control */}

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
              aria-label={isLoadingPlay ? "Loading…" : `Play ${album.title}`}
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

          {/* Top Actions - Quick access */}
          {/* <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <LikeButton id={album._id} type="album" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={stopProp}>
                <button className="control-btn glass-dark size-9 border-white/10 hover:bg-white/20">
                  <MoreVertical className="size-4 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass-frosted shadow-floating border-border/40 w-48"
              >
                <DropdownMenuItem onClick={handlePlay} className="menu-item">
                  <Play className="size-4 mr-2" /> Phát ngay
                </DropdownMenuItem>
                <DropdownMenuItem className="menu-item">
                  <PlusCircle className="size-4 mr-2" /> Thêm vào thư viện
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem className="menu-item">
                  <Share2 className="size-4 mr-2" /> Chia sẻ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div> */}

          {/* Active Glow Ring */}
          {isLoadingPlay && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary animate-glow-pulse" />
          )}
        </div>

        {/* ── INFO SECTION ── */}
        <div className="px-1 flex flex-col gap-1">
          <h3 className="text-track-title text-foreground truncate group-hover:text-primary transition-colors cursor-pointer">
            {album.title}
          </h3>
          <div className="flex items-center gap-2 text-track-meta truncate">
            <Link
              to={`/artists/${album.artist?.slug || album.artist?._id}`}
              onClick={stopProp}
              className="hover:text-primary hover:underline transition-colors"
            >
              {artistName}
            </Link>
            <span className="text-[10px] opacity-30">•</span>
            <span className="text-duration">{releaseYear}</span>
          </div>
        </div>
      </article>
    );
  },
  (prev, next) =>
    prev.album._id === next.album._id &&
    prev.album.coverImage === next.album.coverImage &&
    prev.album.title === next.album.title,
);

export default PublicAlbumCard;
