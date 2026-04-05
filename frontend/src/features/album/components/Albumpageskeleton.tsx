import React, { memo } from "react";
import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — mirrored from AlbumPage module scope
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_CARD_COUNT = 18; // visible above fold on 2xl, matches pageSize

/**
 * Stable per-card widths — deterministic seeds prevent shimmer pattern
 * looking like a uniform wall. These mirror the real card text widths.
 */
const CARD_TITLE_WIDTHS = [
  "70%",
  "55%",
  "80%",
  "65%",
  "75%",
  "58%",
  "72%",
  "62%",
  "78%",
  "54%",
  "68%",
  "60%",
  "74%",
  "52%",
  "66%",
  "82%",
  "56%",
  "70%",
] as const;
const CARD_ARTIST_WIDTHS = [
  "50%",
  "42%",
  "58%",
  "45%",
  "52%",
  "38%",
  "48%",
  "44%",
  "55%",
  "40%",
  "50%",
  "36%",
  "46%",
  "42%",
  "54%",
  "38%",
  "48%",
  "50%",
] as const;

/** Module-scoped — zero allocation per render */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

/** Card stagger — 45ms/item capped at 700ms, same as AlbumPage */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON
// Mirrors PageHero: eyebrow icon + label | h1 title | subtitle | divider | badges
// Heights mirror exact rendered sizes to prevent CLS.
// ─────────────────────────────────────────────────────────────────────────────

const HeroSkeleton = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* ── Eyebrow row: icon badge + label chip ── */}
    <div className="flex items-center gap-2 mb-3">
      {/*
       * Icon badge — exact size-7 rounded-lg box matching PageHero.
       * Using `bg-primary/10` (not skeleton) because it's a structural
       * element, not text — the Disc3 icon itself doesn't shimmer.
       */}
      <div
        className={cn(
          "flex items-center justify-center size-7 rounded-lg shrink-0",
          "bg-primary/10 text-primary/30",
        )}
        aria-hidden="true"
      >
        <Disc3 className="size-4" />
      </div>
      {/* "Collection" overline label */}
      <div className="skeleton skeleton-text w-20 h-3.5" />
    </div>

    {/* ── h1 title skeleton — text-display-xl ≈ clamp(2rem,4vw,3.5rem) ── */}
    <div className="skeleton h-10 sm:h-12 w-64 sm:w-80 rounded-lg mb-2" />

    {/* ── Subtitle line ── */}
    <div className="skeleton skeleton-text w-72 sm:w-96 h-4 mb-5" />

    {/* ── Divider glow — renders as low-opacity rule, not shimmer ── */}
    <div
      className="divider-glow mb-5 opacity-30"
      style={{ maxWidth: "32rem" }}
      aria-hidden="true"
    />

    {/* ── Stat badges row ── */}
    <div className="flex flex-wrap items-center gap-2">
      {/* "X Albums" badge */}
      <div className="skeleton h-7 w-28 rounded-full" />
      {/* "Cập nhật liên tục" badge */}
      <div className="skeleton h-7 w-36 rounded-full" />
    </div>
  </header>
));
HeroSkeleton.displayName = "HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR SKELETON
// Mirrors AlbumFilter header row exactly:
//   [search input flex-1] | [sort select w-[156px]] | [sep] | [filter btn w-[100px]]
// Heights all h-10 — matches Input, SelectTrigger, button.
// Inner panel (expandable) is not shown — skeleton represents the collapsed state.
// ─────────────────────────────────────────────────────────────────────────────

const FilterBarSkeleton = memo(() => (
  <div
    className={cn(
      "card-base",
      // Exact same wrapper as AlbumFilter — prevents layout jump
    )}
    aria-hidden="true"
  >
    <div className="p-4 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
      {/* Search input — flex-1, max-w-xl */}
      <div className="relative w-full md:flex-1 md:max-w-xl">
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto md:justify-end shrink-0">
        {/* Sort select — w-[156px] on md+ */}
        <div className="skeleton h-10 w-full md:w-[156px] rounded-lg" />

        {/* Separator — hidden on mobile */}
        <div className="hidden md:block w-px h-6 bg-border/60 shrink-0" />

        {/* Filters toggle button — min-w-[100px] */}
        <div className="skeleton h-10 w-full md:min-w-[100px] md:w-[108px] rounded-lg" />
      </div>
    </div>
  </div>
));
FilterBarSkeleton.displayName = "FilterBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CARD SKELETON
// Mirrors PublicAlbumCard structure:
//   - Cover: aspect-square rounded-xl (skeleton-cover)
//   - Title: 1 line, variable width
//   - Artist: 1 line, narrower
//   - Play count: sm+ only
// `animationDelay` stagger prevents the shimmer wall effect.
// ─────────────────────────────────────────────────────────────────────────────

interface AlbumCardSkeletonProps {
  index: number;
}

const AlbumCardSkeleton = memo(({ index }: AlbumCardSkeletonProps) => {
  const titleWidth = CARD_TITLE_WIDTHS[index % CARD_TITLE_WIDTHS.length];
  const artistWidth = CARD_ARTIST_WIDTHS[index % CARD_ARTIST_WIDTHS.length];

  return (
    <div
      className="flex flex-col gap-3"
      style={{ animationDelay: `${staggerDelay(index)}ms` }}
      aria-hidden="true"
    >
      {/* Cover art — aspect-square, skeleton-cover (border-radius: var(--radius-xl)) */}
      <div className="skeleton skeleton-cover w-full aspect-square" />

      {/* Text meta block */}
      <div className="space-y-2 px-0.5">
        {/* Album title */}
        <div
          className="skeleton skeleton-text h-3.5 rounded-full"
          style={{ width: titleWidth }}
        />
        {/* Artist name — slightly narrower */}
        <div
          className="skeleton skeleton-text h-3 rounded-full"
          style={{ width: artistWidth }}
        />
        {/* Play count chip — visible sm+ */}
        <div className="skeleton h-5 w-16 rounded-full hidden sm:block" />
      </div>
    </div>
  );
});
AlbumCardSkeleton.displayName = "AlbumCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// GRID SKELETON — matches AlbumGrid GRID_LAYOUT exactly
// ─────────────────────────────────────────────────────────────────────────────

const GridSkeleton = memo(({ count }: { count: number }) => (
  <div className={GRID_LAYOUT}>
    {Array.from({ length: count }, (_, i) => (
      <AlbumCardSkeleton key={i} index={i} />
    ))}
  </div>
));
GridSkeleton.displayName = "GridSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION SKELETON — mirrors PaginationStrip glass-frosted panel
// ─────────────────────────────────────────────────────────────────────────────

const PaginationSkeleton = memo(() => (
  <div
    className={cn(
      "rounded-2xl",
      "border border-border/50 dark:border-primary/15",
      "shadow-brand p-4",
    )}
    aria-hidden="true"
  >
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left: "Showing X of Y" text */}
      <div className="skeleton skeleton-text w-32 h-3.5" />

      {/* Center: page buttons row */}
      <div className="flex items-center gap-1.5">
        {/* Prev */}
        <div className="skeleton w-9 h-9 rounded-lg" />
        {/* Page numbers */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton w-9 h-9 rounded-lg" />
        ))}
        {/* Next */}
        <div className="skeleton w-9 h-9 rounded-lg" />
      </div>

      {/* Right: "Page X of Y" */}
      <div className="skeleton skeleton-text w-24 h-3.5 hidden sm:block" />
    </div>
  </div>
));
PaginationSkeleton.displayName = "PaginationSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM PAGE SKELETON — MAIN EXPORT
// Drop-in replacement: renders while AlbumPage's `isLoading` is true.
// Exact same DOM structure as AlbumPage → seamless transition, zero CLS.
// ─────────────────────────────────────────────────────────────────────────────

const AlbumPageSkeleton: React.FC<{ cardCount?: number }> = memo(
  ({ cardCount = SKELETON_CARD_COUNT }) => (
    <div
      className="relative min-h-screen pb-28"
      role="status"
      aria-busy="true"
      aria-label="Loading album catalog"
    >
      {/* ── Hero header ── */}
      <HeroSkeleton />

      {/* ── Main content ── */}
      <main className="section-container space-y-6 sm:space-y-8">
        {/* Filter bar wrapper — glass-frosted matching AlbumPage */}
        <div
          className={cn(
            " rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand p-0.5",
          )}
        >
          <FilterBarSkeleton />
        </div>

        {/* Album grid */}
        <section className="min-h-[50vh]" aria-label="Loading albums">
          <GridSkeleton count={cardCount} />
        </section>

        {/* Pagination strip */}
        <PaginationSkeleton />
      </main>

      {/* Screen-reader only loading text */}
      <span className="sr-only">Loading album catalog, please wait…</span>
    </div>
  ),
);

AlbumPageSkeleton.displayName = "AlbumPageSkeleton";
export default AlbumPageSkeleton;
