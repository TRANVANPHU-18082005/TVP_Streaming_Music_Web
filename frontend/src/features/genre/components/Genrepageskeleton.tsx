import React, { memo } from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_CARD_COUNT = 18;

/** Deterministic width seeds — genre cards only have name + track count */
const CARD_NAME_WIDTHS = [
  "68%",
  "52%",
  "76%",
  "60%",
  "72%",
  "48%",
  "64%",
  "78%",
  "55%",
  "70%",
  "50%",
  "66%",
  "62%",
  "74%",
  "54%",
  "80%",
  "58%",
  "68%",
] as const;
const CARD_META_WIDTHS = [
  "44%",
  "34%",
  "50%",
  "38%",
  "46%",
  "30%",
  "42%",
  "48%",
  "36%",
  "44%",
  "32%",
  "40%",
  "38%",
  "50%",
  "34%",
  "46%",
  "38%",
  "44%",
] as const;

/** 40ms × N, capped at 600ms — matches GenrePage */
const staggerDelay = (i: number) => Math.min(i * 40, 600);

/** Pixel-identical to GenrePage */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
);

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON — mirrors PageHero
// Tag eyebrow icon | h1 (text-display-xl) | subtitle | divider-glow | badges
// ─────────────────────────────────────────────────────────────────────────────

const HeroSkeleton = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow — size-7 icon badge (structural, not shimmer) + label */}
    <div className="flex items-center gap-2 mb-3">
      <div
        className="flex items-center justify-center size-7 rounded-lg shrink-0 bg-primary/10 text-primary/25"
        aria-hidden="true"
      >
        <Tag className="size-4" />
      </div>
      <div className="skeleton skeleton-text w-14 h-3.5" />
    </div>

    {/* h1 — text-display-xl clamp(2rem → 3.5rem), line-height 1.08 */}
    <div className="skeleton h-10 sm:h-12 w-56 sm:w-[22rem] rounded-lg mb-2" />

    {/* Subtitle */}
    <div className="skeleton skeleton-text w-72 sm:w-[26rem] h-4 mb-5" />

    {/* divider-glow — structural, low opacity */}
    <div
      className="divider-glow mb-5 opacity-25"
      style={{ maxWidth: "32rem" }}
      aria-hidden="true"
    />

    {/* Stat badges */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="skeleton h-7 w-28 rounded-full" />
      <div className="skeleton h-7 w-36 rounded-full" />
    </div>
  </header>
));
HeroSkeleton.displayName = "HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR SKELETON — mirrors GenreFilters header row
// search input + sort select + filter toggle, all h-10
// ─────────────────────────────────────────────────────────────────────────────

const FilterBarSkeleton = memo(() => (
  <div className="card-base" aria-hidden="true">
    <div className="p-4 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
      <div className="w-full md:flex-1 md:max-w-xl">
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto md:justify-end shrink-0">
        <div className="skeleton h-10 w-full md:w-[156px] rounded-lg" />
        <div className="hidden md:block w-px h-6 bg-border/50 shrink-0" />
        <div className="skeleton h-10 w-full md:w-[108px] rounded-lg" />
      </div>
    </div>
  </div>
));
FilterBarSkeleton.displayName = "FilterBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE CARD SKELETON
//
// KEY DIFFERENCE vs Album/Artist: the entire card IS the shimmer surface.
// No separate info block below — content is overlaid absolutely at z-10.
//
// Structure:
//   <div skeleton aspect-[4/3] sm:aspect-square rounded-[18px]>  ← shimmer base
//     <div gradient-overlay bottom />                              ← text contrast
//     <div z-10 justify-between p-3 sm:p-4>
//       <div h-6 sm:h-8>                                           ← badge slot TOP
//         [optional pill skeleton]
//       </div>
//       <div gap-1.5>                                              ← content BOTTOM
//         <div name skeleton />
//         <div meta skeleton />
//       </div>
//     </div>
//   </div>
// ─────────────────────────────────────────────────────────────────────────────

const GenreCardSkeleton = memo(({ index }: { index: number }) => {
  const nameWidth = CARD_NAME_WIDTHS[index % CARD_NAME_WIDTHS.length];
  const metaWidth = CARD_META_WIDTHS[index % CARD_META_WIDTHS.length];
  const showBadge = index % 3 === 0; // ~1/3 of cards show trending badge

  return (
    <div
      className={cn(
        // Aspect ratio matches GenreCard exactly
        "relative overflow-hidden",
        "aspect-[4/3] sm:aspect-square",
        // rounded-[18px] sm:rounded-2xl matches GenreCard
        "rounded-[18px] sm:rounded-2xl",
        // The WHOLE card is the shimmer (not a wrapper around shimmer)
        "skeleton",
        // GPU layer — matches GenreCard's [transform:translateZ(0)]
        "[transform:translateZ(0)]",
        "shadow-raised",
      )}
      style={{ animationDelay: `${staggerDelay(index)}ms` }}
      aria-hidden="true"
    >
      {/*
       * Bottom gradient overlay — simulates GenreCard's from-black/90 gradient.
       * Ensures bottom skeleton elements are readable against the shimmer bg
       * in both light and dark modes.
       */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--surface-2)/0.75) 0%, hsl(var(--surface-2)/0.25) 45%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Content layer — z-10, flex column justify-between, matches GenreCard */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        {/* TOP: trending badge slot — h-6 sm:h-8 fixed height prevents layout jump */}
        <div className="flex items-start justify-end h-6 sm:h-8">
          {showBadge && (
            <div
              className="skeleton h-5 sm:h-[22px] w-12 sm:w-14 rounded-full"
              style={{ opacity: 0.55 }}
            />
          )}
        </div>

        {/* BOTTOM: genre name + track count meta */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {/*
           * Genre name — h3 text-lg sm:text-xl font-black leading-[1.15].
           * text-lg = 1.125rem → line-height 1.15 ≈ 1.3rem ≈ ~20-24px
           */}
          <div
            className="skeleton h-5 sm:h-6 rounded-md"
            style={{ width: nameWidth, opacity: 0.72 }}
          />

          {/* Track count / description — text-[9px] sm:text-[10px] */}
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: metaWidth, opacity: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
});
GenreCardSkeleton.displayName = "GenreCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE GRID SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const GenreGridSkeleton = memo(({ count }: { count: number }) => (
  <div className={GRID_LAYOUT}>
    {Array.from({ length: count }, (_, i) => (
      <GenreCardSkeleton key={i} index={i} />
    ))}
  </div>
));
GenreGridSkeleton.displayName = "GenreGridSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION SKELETON — mirrors PaginationStrip glass-frosted panel
// ─────────────────────────────────────────────────────────────────────────────

const PaginationSkeleton = memo(() => (
  <div
    className={cn(
      " rounded-2xl",
      "border border-border/50 dark:border-primary/15",
      "shadow-brand p-4",
    )}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="skeleton skeleton-text w-32 h-3.5" />

      <div className="flex items-center gap-1.5">
        <div className="skeleton w-9 h-9 rounded-lg" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton w-9 h-9 rounded-lg" />
        ))}
        <div className="skeleton w-9 h-9 rounded-lg" />
      </div>

      <div className="hidden sm:block skeleton skeleton-text w-24 h-3.5" />
    </div>
  </div>
));
PaginationSkeleton.displayName = "PaginationSkeleton";

const GenrePageSkeleton: React.FC<{ cardCount?: number }> = memo(
  ({ cardCount = SKELETON_CARD_COUNT }) => (
    <div
      className="relative min-h-screen pb-28"
      role="status"
      aria-busy="true"
      aria-label="Loading genre catalog"
    >
      <HeroSkeleton />

      <main className="section-container space-y-6 sm:space-y-8">
        {/* Filter bar wrapper — glass-frosted matches GenrePage */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand p-0.5",
          )}
        >
          <FilterBarSkeleton />
        </div>

        <section className="min-h-[50vh]" aria-label="Loading genres">
          <GenreGridSkeleton count={cardCount} />
        </section>

        <PaginationSkeleton />
      </main>

      <span className="sr-only">Loading genre catalog, please wait…</span>
    </div>
  ),
);

GenrePageSkeleton.displayName = "GenrePageSkeleton";
export default GenrePageSkeleton;
