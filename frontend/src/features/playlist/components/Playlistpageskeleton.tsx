import React, { memo } from "react";
import { ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — mirrored from PlaylistPage
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_CARD_COUNT = 18;

/**
 * Deterministic per-card width seeds.
 * Playlist titles tend to be short → mid-range widths (45–80%).
 */
const CARD_TITLE_WIDTHS = [
  "68%",
  "52%",
  "78%",
  "60%",
  "72%",
  "48%",
  "65%",
  "80%",
  "56%",
  "70%",
  "46%",
  "74%",
  "62%",
  "76%",
  "54%",
  "82%",
  "58%",
  "68%",
] as const;

const CARD_META_WIDTHS = [
  "55%",
  "42%",
  "62%",
  "48%",
  "58%",
  "38%",
  "52%",
  "60%",
  "44%",
  "56%",
  "36%",
  "50%",
  "46%",
  "64%",
  "40%",
  "54%",
  "44%",
  "55%",
] as const;

/** 45ms/item, capped at 700ms — identical to PlaylistPage */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

/** Identical to PlaylistPage — gap-y-8/10 (not gap-y-12 like ArtistPage) */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

const HeroSkeleton = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow — size-7 icon + "Playlists" overline */}
    <div className="flex items-center gap-2 mb-3">
      <div
        className={cn(
          "flex items-center justify-center size-7 rounded-lg shrink-0",
          "bg-primary/10 text-primary/25",
        )}
        aria-hidden="true"
      >
        <ListMusic className="size-4" />
      </div>
      <div className="skeleton skeleton-text w-16 h-3.5" />
    </div>

    {/* h1 — text-display-xl */}
    <div className="skeleton h-10 sm:h-12 w-56 sm:w-72 rounded-lg mb-2" />

    {/* Subtitle */}
    <div className="skeleton skeleton-text w-80 sm:w-[32rem] h-4 mb-5" />

    {/* divider-glow — structural */}
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
// FILTER BAR SKELETON
// Mirrors PlaylistFilter header row (card-base wrapper):
//   [search flex-1 max-w-xl] | [sort w-[156px]] | [sep] | [filter w-[108px]]
// ─────────────────────────────────────────────────────────────────────────────

const FilterBarSkeleton = memo(() => (
  <div className="card-base" aria-hidden="true">
    <div className="p-4 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
      {/* Search input */}
      <div className="w-full md:flex-1 md:max-w-xl">
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto md:justify-end shrink-0">
        {/* Sort select */}
        <div className="skeleton h-10 w-full md:w-[156px] rounded-lg" />

        {/* Vertical separator */}
        <div className="hidden md:block w-px h-6 bg-border/50 shrink-0" />

        {/* Filters toggle */}
        <div className="skeleton h-10 w-full md:w-[108px] rounded-lg" />
      </div>
    </div>
  </div>
));
FilterBarSkeleton.displayName = "FilterBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST CARD SKELETON
// Mirrors PublicPlaylistCard structure:
//
//   <article class="group flex flex-col gap-3 album-card">
//     ── artwork div (aspect-square rounded-[18px])
//        ├── cover image  / fallback icon
//        ├── gradient overlays (2 layers)
//        ├── badges TOP-LEFT  (system/community h-5 w-varies)
//        ├── like btn TOP-RIGHT (hidden md:block, size-8)
//        └── play btn BOTTOM-RIGHT (size-12 sm:size-14)
//     ── info div (flex items-start justify-between px-0.5 pl-2 pr-2 pb-2)
//        ├── left: title (h-4) + meta row (creator · tracks h-3)
//        └── right: kebab size-7 (hidden md:block)
//
// animationDelay: same staggerDelay as PlaylistPage card stagger.
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistCardSkeletonProps {
  index: number;
}

const PlaylistCardSkeleton = memo(({ index }: PlaylistCardSkeletonProps) => {
  const titleWidth = CARD_TITLE_WIDTHS[index % CARD_TITLE_WIDTHS.length];
  const metaWidth = CARD_META_WIDTHS[index % CARD_META_WIDTHS.length];

  return (
    <div
      className="flex flex-col gap-3"
      style={{ animationDelay: `${staggerDelay(index)}ms` }}
      aria-hidden="true"
    >
      {/* ── Artwork — aspect-square rounded-[18px] ── */}
      <div
        className={cn(
          "relative aspect-square overflow-hidden",
          "rounded-[18px]",
          "shadow-raised",
        )}
      >
        {/* Cover shimmer — full fill */}
        <div className="skeleton absolute inset-0 rounded-[inherit]" />

        {/*
         * TOP-LEFT: badge slot.
         * ~half cards show "system" badge, rest show "community" badge.
         * Deterministic: index % 2. Width varies to simulate text length.
         */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <div
            className={cn(
              "skeleton h-5 rounded-full opacity-40",
              index % 2 === 0 ? "w-16" : "w-20",
            )}
          />
        </div>

        {/*
         * TOP-RIGHT: like button — desktop only (hidden on mobile).
         * size-8 rounded-full matching real button.
         */}
        <div className="hidden md:block absolute top-2.5 right-2.5 z-10">
          <div className="skeleton size-8 rounded-full opacity-35" />
        </div>

        {/*
         * BOTTOM-RIGHT: play button — size-12 sm:size-14.
         * Always present structurally; opacity lower than real button.
         */}
        <div className="absolute right-3 bottom-3 z-10">
          <div className="skeleton size-12 sm:size-14 rounded-full opacity-40" />
        </div>

        {/* Bottom gradient — matches real card gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            background:
              "linear-gradient(to top, hsl(0 0% 0% / 0.45) 0%, transparent 55%)",
          }}
          aria-hidden="true"
        />
      </div>

      {/* ── Info row — flex items-start justify-between ── */}
      <div className="flex items-start justify-between gap-2 px-0.5 pl-2 pr-2 pb-2">
        {/* Left: title + meta */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {/* Title — text-track-title ≈ 0.875rem font-medium → h-4 */}
          <div
            className="skeleton h-4 rounded-full"
            style={{ width: titleWidth }}
          />
          {/* Meta — creator · track count → h-3 */}
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: metaWidth }}
          />
        </div>

        {/* Right: kebab menu — hidden md:block, size-7 rounded-lg */}
        <div className="hidden md:block skeleton size-7 rounded-lg shrink-0 opacity-50" />
      </div>
    </div>
  );
});
PlaylistCardSkeleton.displayName = "PlaylistCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST GRID SKELETON — identical GRID_LAYOUT from PlaylistPage
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistGridSkeleton = memo(({ count }: { count: number }) => (
  <div className={GRID_LAYOUT}>
    {Array.from({ length: count }, (_, i) => (
      <PlaylistCardSkeleton key={i} index={i} />
    ))}
  </div>
));
PlaylistGridSkeleton.displayName = "PlaylistGridSkeleton";

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

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST PAGE SKELETON — MAIN EXPORT
//
// Drop-in replacement during PlaylistPage's isLoading && playlists.length === 0.
// Identical DOM structure → seamless transition, zero CLS.
//
// Usage:
//   if (isLoading && playlists.length === 0) {
//     return <PlaylistPageSkeleton cardCount={meta.pageSize} />;
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistPageSkeletonProps {
  cardCount?: number;
}

const PlaylistPageSkeleton: React.FC<PlaylistPageSkeletonProps> = memo(
  ({ cardCount = SKELETON_CARD_COUNT }) => (
    <div
      className="relative min-h-screen pb-28"
      role="status"
      aria-busy="true"
      aria-label="Loading playlist catalog"
    >
      <HeroSkeleton />

      <main className="section-container space-y-6 sm:space-y-8">
        {/* Filter bar — glass-frosted p-0.5 wrapper matching PlaylistPage */}
        <div
          className={cn(
            " rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand p-0.5",
          )}
        >
          <FilterBarSkeleton />
        </div>

        {/* Playlist grid */}
        <section className="min-h-[50vh]" aria-label="Loading playlists">
          <PlaylistGridSkeleton count={cardCount} />
        </section>

        {/* Pagination strip */}
        <PaginationSkeleton />
      </main>

      <span className="sr-only">Loading playlist catalog, please wait…</span>
    </div>
  ),
);

PlaylistPageSkeleton.displayName = "PlaylistPageSkeleton";
export default PlaylistPageSkeleton;
