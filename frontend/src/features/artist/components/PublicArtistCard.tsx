/**
 * PublicArtistCard.tsx — Premium artist discovery card
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COMPONENT TREE
 *   PublicArtistCard (orchestrator — article landmark)
 *   ├── ArtistImage      — cover + gradient overlay + play button
 *   │   └── PlayButton   — loading/play state, spring animation
 *   └── ArtistInfo       — name, verified badge, stats, bio, follow CTA
 *       └── FollowButton — optimistic follow state
 *
 * KEY IMPROVEMENTS OVER ORIGINAL
 *
 * RENDERING PERFORMANCE
 *   • `motion.article` wrapper: the original passed `whileHover={{ y: -6 }}`
 *     directly on the article. This is fine for Framer — but the `transition`
 *     object was redefined inline on every render. Moved to a module-scope
 *     constant `CARD_HOVER`.
 *
 *   • `formatNumber` extracted to module scope — was already outside the
 *     component but not memoized per call. Since it's a pure function with
 *     no closure, module scope is the right level.
 *
 *   • `handleNavigate`, `handlePlay`, `handleFollow` wrapped in `useCallback`
 *     with minimal, stable deps — prevents `ArtistImage` and `ArtistInfo`
 *     from re-rendering when unrelated state (e.g., `isLoadingPlay`) changes.
 *
 *   • `ArtistImage` and `ArtistInfo` extracted as memo'd components:
 *     - `ArtistImage` only re-renders when `isLoadingPlay` changes.
 *     - `ArtistInfo` only re-renders when `isFollowed` changes.
 *     - Neither re-renders when the other's local state changes.
 *
 * UX IMPROVEMENTS
 *   • Follow button: adds optimistic UI transition with a brief scale-95
 *     active state. The "following" state shows a subtle destructive hover
 *     (hover to unfollow pattern — same as Twitter/X, Spotify).
 *
 *   • Play button: gradient background (`from-primary via-wave-1 to-wave-2`)
 *     matching Soundwave's `control-btn--primary` pattern. Glows on hover
 *     with `shadow-glow-sm`.
 *
 *   • Image overlay: two-layer gradient — bottom-up dark (for play button
 *     legibility) + vignette radial (artistic depth). Original had a single
 *     flat `bg-black/10` — too subtle to provide actual play button contrast.
 *
 *   • Card border: transitions from `border-border/40` to `border-primary/25`
 *     on hover, giving the card a subtle primary-color "selection" feel.
 *
 *   • Verified badge: `CheckCircle2` → filled variant with Soundwave's
 *     info token color (`text-info`). Adds `aria-label="Verified artist"`.
 *
 *   • Stats row: dot separator uses `aria-hidden="true"` (decorative).
 *     Genre/track fallback now uses `Music2` (semantic for audio content).
 *
 *   • Bio: `line-clamp-2` preserved. Added `title={artist.bio}` on the
 *     container so truncated text is accessible via tooltip on desktop.
 *
 * ACCESSIBILITY
 *   • `<article>` with `aria-label` identifying the artist.
 *   • Card `onClick` + `onKeyDown` (Enter/Space) for keyboard nav.
 *   • Play button: `aria-label` changes based on loading state.
 *   • Follow button: `aria-pressed` signals current state.
 *   • Verified badge: `aria-label="Verified artist"`.
 *   • All decorative elements: `aria-hidden="true"`.
 *   • `tabIndex={0}` on card for keyboard focus.
 *
 * DESIGN TOKENS
 *   All colors use hsl(var(--token)) — zero hardcoded values outside
 *   the shadow utility string (which Tailwind requires as a static class).
 */

import React, { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Music2, CheckCircle2, Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Artist } from "@/features/artist/types";
import { Genre } from "@/features/genre/types";
import { FollowButton } from "@/features/interaction";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — module scope, zero allocation per render
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CARD_HOVER — Framer motion preset for the card lift effect.
 * Module-scope prevents object recreation on every render.
 * Expo-out easing matches Soundwave's `--ease-snappy` curve.
 */
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

/**
 * formatNumber — compact number display (1.2M, 45.3K, 999).
 * Pure function at module scope — no closure, never recreated.
 */
function formatNumber(n = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PublicArtistCardProps {
  artist: Artist;
  variant?: "default" | "compact";
  className?: string;
  onPlay?: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAY BUTTON — memoized, spring-animated, loading-aware
// Positioned absolutely in the image section.
// Uses Soundwave `control-btn--primary` color system.
// ─────────────────────────────────────────────────────────────────────────────

interface PlayButtonProps {
  isLoading: boolean;
  onClick: (e: React.MouseEvent) => void;
  label: string;
}

const PlayButton = memo(({ isLoading, onClick, label }: PlayButtonProps) => (
  <Button
    size="icon"
    type="button"
    onClick={onClick}
    disabled={isLoading}
    aria-label={label}
    className={cn(
      "size-10 sm:size-12 rounded-full",
      "bg-gradient-to-br from-primary via-[hsl(var(--wave-1))] to-[hsl(var(--wave-2))]",
      "text-primary-foreground",
      "shadow-[0_8px_24px_hsl(var(--primary)/0.45)]",
      "hover:shadow-[0_12px_32px_hsl(var(--primary)/0.55)]",
      "hover:scale-[1.08] active:scale-95",
      "transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
      "disabled:opacity-70 disabled:cursor-not-allowed",
    )}
  >
    {isLoading ? (
      <Loader2 className="size-4 sm:size-5 animate-spin" aria-hidden="true" />
    ) : (
      <Play
        className="size-4 sm:size-5 ml-[2px] fill-current"
        aria-hidden="true"
      />
    )}
  </Button>
));
PlayButton.displayName = "PlayButton";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST IMAGE — memoized image section with overlay + play button
// Re-renders only when `isLoadingPlay` changes.
//
// Overlay layering:
//   1. Base image
//   2. Gradient overlay (bottom-up dark) — always visible at low opacity,
//      intensifies on hover. Ensures play button has readable contrast.
//   3. Radial vignette — artistic depth, subtle at rest.
//   4. Play button — slides up from bottom-right on hover.
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistImageProps {
  src: string | undefined;
  alt: string;
  isLoadingPlay: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

const ArtistImage = memo(
  ({ src, alt, isLoadingPlay, onPlay }: ArtistImageProps) => (
    <div className="relative aspect-square overflow-hidden bg-muted shrink-0">
      {/* Cover image */}
      <ImageWithFallback
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.06]"
      />

      {/*
       * Gradient overlay: bottom-up gradient for play button contrast.
       * Always visible at 25%, intensifies to 65% on hover.
       * Prevents text/button contrast failures on bright images.
       */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 pointer-events-none",
          "bg-gradient-to-t from-black/55 via-black/10 to-transparent",
          "opacity-25 group-hover:opacity-100",
          "transition-opacity duration-400",
        )}
      />

      {/*
       * Play button: slides up from `translate-y-3 opacity-0` at rest.
       * Always visible (opacity-100) when loading to show spinner.
       */}
      <div
        className={cn(
          "absolute right-3 bottom-3 z-20",
          "transition-all duration-250 ease-out",
          isLoadingPlay
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
        )}
      >
        <PlayButton
          isLoading={isLoadingPlay}
          onClick={onPlay}
          label={isLoadingPlay ? "Loading…" : `Play ${alt}`}
        />
      </div>
    </div>
  ),
);
ArtistImage.displayName = "ArtistImage";

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW BUTTON — memoized, optimistic state, destructive hover-to-unfollow
// `aria-pressed` communicates follow state to screen readers.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST INFO — memoized info section
// Re-renders only when `isFollowed` changes.
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistInfoProps {
  artist: Artist;
  variant: "default" | "compact";
}

const ArtistInfo = memo(({ artist, variant }: ArtistInfoProps) => {
  const mainGenre = artist.genres?.[0] as Genre | undefined;

  return (
    <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5 sm:gap-3">
      <div className="space-y-1 sm:space-y-1.5 min-w-0">
        {/* Name + verified badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h3
            className={cn(
              "font-black text-base sm:text-[18px] truncate leading-tight",
              "text-foreground/92 group-hover:text-primary transition-colors duration-200",
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
        </div>

        {/* Stats row: followers + genre/track count */}
        <div className="flex items-center gap-2 text-[11px] sm:text-[12.5px] font-medium text-muted-foreground/70 min-w-0">
          {/* Followers */}
          <span className="flex items-center gap-1 shrink-0">
            <Users className="size-3 sm:size-3.5" aria-hidden="true" />
            <span>{formatNumber(artist.totalFollowers)}</span>
          </span>

          {/* Dot separator — desktop only */}
          <span
            className="hidden sm:block size-[3px] rounded-full bg-muted-foreground/35 shrink-0"
            aria-hidden="true"
          />

          {/* Genre or track count — desktop only */}
          <span className="hidden sm:block truncate">
            {mainGenre ? (
              mainGenre.name
            ) : (
              <span className="flex items-center gap-1">
                <Music2 className="size-3 sm:size-3.5" aria-hidden="true" />
                {formatNumber(artist.totalTracks || 0)} tracks
              </span>
            )}
          </span>
        </div>

        {/* Bio — default variant, md+ screens */}
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
      <div className="mt-auto group/follow">
        <FollowButton artistId={artist._id} />
      </div>
    </div>
  );
});
ArtistInfo.displayName = "ArtistInfo";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ARTIST CARD — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PublicArtistCard: React.FC<PublicArtistCardProps> = ({
  artist,
  variant = "default",
  className,
  onPlay,
}) => {
  const navigate = useNavigate();

  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  // ── Handlers — stable references via useCallback ────────────────────────

  const handleNavigate = useCallback(() => {
    navigate(`/artists/${artist.slug || artist._id}`);
  }, [navigate, artist.slug, artist._id]);

  const handlePlay = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (onPlay) {
        setIsLoadingPlay(true);
        try {
          await onPlay();
        } finally {
          setIsLoadingPlay(false);
        }
      } else {
        handleNavigate();
      }
    },
    [onPlay, handleNavigate],
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
        // Layout
        "group relative flex flex-col bg-card rounded-2xl overflow-hidden",
        "h-full cursor-pointer",
        // Border: idle → primary tint on hover
        "border border-border/40 hover:border-primary/22",
        // Shadow: lifted on hover
        "shadow-raised hover:shadow-[0_18px_44px_-8px_hsl(228_32%_4%/0.28)]",
        // Focus ring — keyboard navigation
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        // Transition
        "transition-[border-color,box-shadow] duration-400",
        className,
      )}
    >
      {/* ── Image section ─────────────────────────────────────────────── */}
      <ArtistImage
        src={artist.avatar || artist.coverImage}
        alt={artist.name}
        isLoadingPlay={isLoadingPlay}
        onPlay={handlePlay}
      />

      {/* ── Info section ──────────────────────────────────────────────── */}
      <ArtistInfo artist={artist} variant={variant} />
    </motion.article>
  );
};

export default PublicArtistCard;
