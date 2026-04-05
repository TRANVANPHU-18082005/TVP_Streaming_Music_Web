import { memo, useMemo } from "react";
import { TrendingUp, Music4 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Genre } from "@/features/genre/types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface GenreCardProps {
  genre: Genre;
  className?: string;
  size?: "md" | "lg";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const GenreCard = memo<GenreCardProps>(
  function GenreCard({ genre, className, size = "md" }) {
    // FIX 2: memoised bgStyle — no new object reference per render
    const bgStyle = useMemo<React.CSSProperties>(() => {
      if (genre.gradient) return { background: genre.gradient };
      if (genre.color) return { backgroundColor: genre.color };
      return { backgroundColor: "hsl(var(--muted))" };
    }, [genre.gradient, genre.color]);

    const hasImage = Boolean(genre.image);
    const hasTrackCount = (genre.trackCount ?? 0) > 0;

    return (
      <Link
        to={`/genres/${genre.slug}`}
        aria-label={`${genre.name}${genre.isTrending ? " — Trending" : ""}`}
        className={cn(
          // Layout
          "group relative flex flex-col overflow-hidden",
          size === "lg" ? "aspect-[16/9]" : "aspect-[4/3] sm:aspect-square",
          // Shape
          "rounded-[18px] sm:rounded-2xl",
          // FIX 4: GPU layer promotion on mount
          "[will-change:transform] [transform:translateZ(0)]",
          // Hover lift — matches .album-card level
          "transition-[transform,box-shadow] duration-500 ease-out",
          "hover:-translate-y-[6px]",
          "hover:shadow-floating",
          // Focus ring — Soundwave ring token
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        style={bgStyle}
      >
        {/* ── 1. BACKGROUND IMAGE ── */}
        {hasImage ? (
          <ImageWithFallback
            src={genre.image}
            alt="" // decorative — aria-label on Link covers semantics
            loading="lazy" // FIX 8
            decoding="async"
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              // FIX 3: valid arbitrary will-change property
              "[will-change:transform]",
              "transition-[transform,opacity] duration-[800ms] ease-[cubic-bezier(0.21,1.11,0.81,0.99)]",
              "opacity-60 group-hover:opacity-85",
              "group-hover:scale-110",
            )}
          />
        ) : (
          // Fallback icon — scaled on hover for parallax feel
          <div
            className="absolute inset-0 flex items-center justify-center opacity-20 transition-transform duration-[800ms] group-hover:scale-110"
            aria-hidden="true"
          >
            {/* FIX 9: responsive icon size */}
            <Music4 className="size-12 sm:size-16 lg:size-20" />
          </div>
        )}

        {/* ── 2. DEPTH OVERLAYS ── */}
        {/*
         * FIX 6: lighter overlay without image to avoid crushing light-colored cards.
         * 4-stop gradient for better cinematic depth.
         */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500",
            "bg-gradient-to-t to-transparent",
            hasImage
              ? "from-black/90 via-black/35 opacity-75 group-hover:opacity-100"
              : "from-black/55 via-black/15 opacity-65 group-hover:opacity-80",
          )}
        />

        {/* FIX 7: ring-inset — visible in light mode */}
        <div
          className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/18 dark:ring-white/12 pointer-events-none"
          aria-hidden="true"
        />

        {/* ── 3. CONTENT ── */}
        <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
          {/* TOP: trending badge slot — fixed height so title never jumps */}
          <div className="flex items-start justify-end h-6 sm:h-8">
            {genre.isTrending && (
              <span
                aria-label="Trending genre" // FIX 10
                className={cn(
                  "inline-flex items-center gap-1 sm:gap-1.5 shrink-0",
                  // .badge pattern from index.css §14 — adapted for dark overlay context
                  "rounded-full px-2 py-1 sm:px-2.5 sm:py-1",
                  "bg-white/18 backdrop-blur-md border border-white/20",
                  "text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white",
                  "shadow-lg",
                )}
              >
                <TrendingUp
                  className="size-3 sm:size-3.5 text-rose-400"
                  aria-hidden="true"
                />
                Hot
              </span>
            )}
          </div>

          {/* BOTTOM: title + collapsible meta */}
          <div className="flex flex-col justify-end w-full">
            <h3
              className={cn(
                "text-lg sm:text-xl lg:text-2xl",
                "font-black tracking-tight",
                "text-white drop-shadow-xl",
                "line-clamp-2 break-words leading-[1.15]",
              )}
              title={genre.name}
            >
              {genre.name}
            </h3>

            {/*
             * FIX 5: max-height + opacity instead of grid-rows.
             * grid-template-rows triggers layout recalc per frame on Chrome.
             * max-height with a concrete ceiling avoids the jump-to-height
             * artifact on fast hovers and is compositing-layer friendly.
             *
             * Mobile: always visible (no hover on touch).
             * lg+: hidden at rest, revealed on hover.
             */}
            <div
              className={cn(
                "overflow-hidden",
                "transition-[max-height,opacity,margin-top] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                // Mobile: always visible
                "max-h-[60px] opacity-100 mt-1",
                // Desktop: collapsed at rest
                "lg:max-h-0 lg:opacity-0 lg:mt-0",
                "lg:group-hover:max-h-[60px] lg:group-hover:opacity-100 lg:group-hover:mt-1",
              )}
            >
              <div className="flex flex-col gap-0.5 sm:gap-1 w-full">
                {genre.description && (
                  <p className="text-[10px] sm:text-[11px] text-white/70 line-clamp-1 font-medium truncate w-full pr-2">
                    {genre.description}
                  </p>
                )}

                {hasTrackCount && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
                      {genre.trackCount!.toLocaleString()} Tracks
                    </span>
                    {/* Sub-genre count if available
                    {(genre. ?? 0) > 0 && (
                      <>
                        <span
                          className="size-0.5 rounded-full bg-white/30"
                          aria-hidden="true"
                        />
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                          {genre.childCount} Sub
                        </span>
                      </>
                    )} */}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  },
  // FIX 1: custom comparator — avoids deep Genre object comparison
  (prev, next) =>
    prev.genre._id === next.genre._id &&
    prev.genre.image === next.genre.image &&
    prev.genre.isTrending === next.genre.isTrending &&
    prev.genre.trackCount === next.genre.trackCount &&
    prev.genre.name === next.genre.name &&
    prev.size === next.size &&
    prev.className === next.className,
);

export default GenreCard;
