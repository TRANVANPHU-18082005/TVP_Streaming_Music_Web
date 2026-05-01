import React, { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Music2,
  CheckCircle2,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

import { FollowButton } from "@/features/interaction";
import { IArtist } from "../types";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import {
  PremiumMusicVisualizer,
  WaveformBars,
} from "@/components/MusicVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CARD_HOVER = {
  whileHover: { y: -5, scale: 1.005 },
  transition: {
    type: "spring" as const,
    stiffness: 320,
    damping: 22,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(n = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PublicArtistCardProps {
  artist: IArtist;
  variant?: "default" | "compact";
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST IMAGE — mirrors PublicAlbumCard artwork section
// Active state: visualizer overlay + blur/opacity effect on image
// Playing state: Play/Pause toggle with AnimatePresence
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistImageProps {
  src: string | undefined;
  alt: string;
  isActive: boolean;
  isPlaying: boolean;
  isFetching: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

const ArtistImage = memo(
  ({ src, alt, isActive, isPlaying, isFetching, onPlay }: ArtistImageProps) => (
    <div className="relative aspect-square overflow-hidden bg-muted shrink-0">
      {/* Cover image — mirrors PublicAlbumCard: blur when active+playing */}
      <ImageWithFallback
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.06]",
          isPlaying && "blur-[2px] opacity-70 scale-105",
        )}
      />

      {/* Gradient overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-25 group-hover:opacity-100 transition-opacity duration-400"
      />

      {/* ── PremiumMusicVisualizer — mirrors PublicAlbumCard exactly ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 h-full flex items-center justify-center z-20 pointer-events-none bg-black/20 backdrop-blur-[2px]"
          >
            <PremiumMusicVisualizer
              active={isPlaying}
              size="md"
              barCount={10}
              className="drop-shadow-brand-glow"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Play / Pause button — mirrors PublicAlbumCard ── */}
      <div
        className={cn(
          "absolute right-3 bottom-3 z-20 transition-all duration-300 ease-out",
          isActive || isFetching
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
        )}
      >
        <button
          type="button"
          onClick={onPlay}
          disabled={isFetching}
          aria-label={isPlaying ? `Pause ${alt}` : `Play ${alt}`}
          className={cn(
            "control-btn control-btn--primary size-12 sm:size-14 shadow-glow-sm",
            isActive && "bg-primary text-white",
          )}
        >
          <AnimatePresence mode="wait">
            {isFetching ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              </motion.div>
            ) : isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Pause className="size-5 fill-current" aria-hidden="true" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Play
                  className="size-5 ml-0.5 fill-current"
                  aria-hidden="true"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Active Glow Ring khi đang tải — mirrors PublicAlbumCard */}
      {isFetching && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary animate-glow-pulse pointer-events-none" />
      )}
    </div>
  ),
);
ArtistImage.displayName = "ArtistImage";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST INFO — WaveformBars khi active, giống PublicAlbumCard title area
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistInfoProps {
  artist: IArtist;
  variant: "default" | "compact";
  isActive: boolean;
  isPlaying: boolean;
}

const ArtistInfo = memo(
  ({ artist, variant, isActive, isPlaying }: ArtistInfoProps) => {
    return (
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5 sm:gap-3">
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          {/* Name + verified badge + WaveformBars */}
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={cn(
                "font-black text-base sm:text-[18px] truncate leading-tight flex-1",
                "transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-foreground/92 group-hover:text-primary",
              )}
            >
              {artist.name}
            </h3>
            {artist.isVerified && (
              <CheckCircle2
                className="size-3.5 sm:size-[18px] text-info shrink-0"
                aria-label="Verified artist"
                role="img"
              />
            )}
            {/* WaveformBars — mirrors PublicAlbumCard title area */}
            {isActive && <WaveformBars active={isPlaying} bars={3} />}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 text-[11px] sm:text-[12.5px] font-medium text-muted-foreground/70 min-w-0">
            <span className="flex items-center gap-1 shrink-0">
              <Users className="size-3 sm:size-3.5" aria-hidden="true" />
              <span>{formatNumber(artist.totalFollowers)}</span>
            </span>
            <span
              className="hidden sm:block size-[3px] rounded-full bg-muted-foreground/35 shrink-0"
              aria-hidden="true"
            />
            <span className="hidden sm:block truncate">
              <span className="flex items-center gap-1">
                <Music2 className="size-3 sm:size-3.5" aria-hidden="true" />
                {formatNumber(artist.totalTracks || 0)} tracks
              </span>
            </span>
          </div>

          {/* Bio — default variant */}
          {variant === "default" && artist.bio && (
            <p
              title={artist.bio}
              className="hidden md:block text-[12.5px] text-muted-foreground/65 line-clamp-2 leading-relaxed mt-1"
            >
              {artist.bio}
            </p>
          )}
        </div>

        {/* Follow CTA */}
        <div className="mt-auto">
          <FollowButton artistId={artist._id} />
        </div>
      </div>
    );
  },
);
ArtistInfo.displayName = "ArtistInfo";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ARTIST CARD — MAIN COMPONENT
// Active/playing logic mirrors PublicAlbumCard exactly
// ─────────────────────────────────────────────────────────────────────────────

const PublicArtistCard: React.FC<PublicArtistCardProps> = ({
  artist,
  variant = "default",
  className,
}) => {
  const navigate = useNavigate();

  const {
    togglePlayArtist,
    isThisArtistActive,
    isThisArtistPlaying,
    isFetching,
  } = useArtistPlayback(artist);

  const handleNavigate = useCallback(() => {
    navigate(`/artists/${artist.slug || artist._id}`);
  }, [navigate, artist.slug, artist._id]);

  // Play button: stopPropagation để không trigger navigate — mirrors PublicAlbumCard
  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      togglePlayArtist(e);
    },
    [togglePlayArtist],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate],
  );

  return (
    <motion.article
      {...CARD_HOVER}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="article"
      aria-label={`Artist: ${artist.name}`}
      className={cn(
        "group relative flex flex-col bg-card rounded-2xl overflow-hidden",
        "h-full cursor-pointer",
        "border border-border/40 hover:border-primary/22",
        "shadow-raised hover:shadow-[0_18px_44px_-8px_hsl(228_32%_4%/0.28)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "transition-[border-color,box-shadow] duration-400",
        // Active card highlight — mirrors PublicAlbumCard
        isThisArtistActive && "bg-primary/5 shadow-brand-soft",
        className,
      )}
    >
      <ArtistImage
        src={artist.avatar || artist.coverImage}
        alt={artist.name}
        isActive={isThisArtistActive}
        isPlaying={isThisArtistPlaying}
        isFetching={isFetching}
        onPlay={handlePlay}
      />
      <ArtistInfo
        artist={artist}
        variant={variant}
        isActive={isThisArtistActive}
        isPlaying={isThisArtistPlaying}
      />
    </motion.article>
  );
};

export default PublicArtistCard;
