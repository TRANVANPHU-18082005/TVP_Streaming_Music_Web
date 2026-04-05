import React, { memo } from "react";
import { Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — mirrored from ArtistPage module scope
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_CARD_COUNT = 18;

/**
 * Stable per-card width seeds — deterministic, never random per render.
 * Prevents shimmer "uniform wall" and avoids React hydration mismatches.
 */
const CARD_NAME_WIDTHS = [
  "72%",
  "58%",
  "82%",
  "64%",
  "76%",
  "54%",
  "68%",
  "80%",
  "60%",
  "74%",
  "52%",
  "70%",
  "66%",
  "78%",
  "56%",
  "84%",
  "62%",
  "72%",
] as const;
const CARD_STAT_WIDTHS = [
  "48%",
  "38%",
  "55%",
  "42%",
  "50%",
  "36%",
  "45%",
  "52%",
  "40%",
  "48%",
  "34%",
  "46%",
  "44%",
  "54%",
  "38%",
  "50%",
  "42%",
  "48%",
] as const;
const CARD_BIO_WIDTHS_1 = [
  "90%",
  "85%",
  "95%",
  "88%",
  "92%",
  "80%",
  "87%",
  "93%",
  "82%",
  "90%",
  "78%",
  "86%",
  "89%",
  "94%",
  "83%",
  "91%",
  "84%",
  "90%",
] as const;
const CARD_BIO_WIDTHS_2 = [
  "65%",
  "55%",
  "72%",
  "60%",
  "68%",
  "52%",
  "62%",
  "70%",
  "57%",
  "65%",
  "50%",
  "60%",
  "63%",
  "71%",
  "58%",
  "67%",
  "61%",
  "65%",
] as const;

/** Identical to ArtistPage */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
);

const staggerDelay = (i: number) => Math.min(i * 45, 700);

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON
// Mirrors PageHero exactly:
//   eyebrow (icon-7 + label) | h1 (text-display-xl) | subtitle | divider | badges
// ─────────────────────────────────────────────────────────────────────────────

const HeroSkeleton = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow row — size-7 icon badge + "Artists" label chip */}
    <div className="flex items-center gap-2 mb-3">
      {/*
       * Icon badge — structural element, not shimmer.
       * Same `bg-primary/10 text-primary/30` as real PageHero icon badge.
       */}
      <div
        className={cn(
          "flex items-center justify-center size-7 rounded-lg shrink-0",
          "bg-primary/10 text-primary/25",
        )}
        aria-hidden="true"
      >
        <Mic2 className="size-4" />
      </div>
      {/* "Artists" overline label */}
      <div className="skeleton skeleton-text w-14 h-3.5" />
    </div>

    {/* h1 — text-display-xl ≈ clamp(2rem, 4vw, 3.5rem) line-height 1.08 */}
    <div className="skeleton h-10 sm:h-12 w-56 sm:w-72 rounded-lg mb-2" />

    {/* Subtitle paragraph */}
    <div className="skeleton skeleton-text w-80 sm:w-[28rem] h-4 mb-5" />

    {/* divider-glow — low-opacity structural rule, not a shimmer */}
    <div
      className="divider-glow mb-5 opacity-25"
      style={{ maxWidth: "32rem" }}
      aria-hidden="true"
    />

    {/* Stat badges — "X Nghệ sĩ" + "Cập nhật liên tục" */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="skeleton h-7 w-28 rounded-full" />
      <div className="skeleton h-7 w-36 rounded-full" />
    </div>
  </header>
));
HeroSkeleton.displayName = "HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR SKELETON
// Mirrors ArtistFilters header row:
//   [search input flex-1 max-w-xl] | [sort select w-[156px]] | [sep] | [filter btn]
// Heights h-10 throughout — matches Input + SelectTrigger + button.
// ─────────────────────────────────────────────────────────────────────────────

const FilterBarSkeleton = memo(() => (
  <div className="card-base" aria-hidden="true">
    <div className="p-4 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
      {/* Search input — flex-1 max-w-xl */}
      <div className="w-full md:flex-1 md:max-w-xl">
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto md:justify-end shrink-0">
        {/* Sort select — w-[156px] on md+ */}
        <div className="skeleton h-10 w-full md:w-[156px] rounded-lg" />

        {/* Vertical separator — hidden on mobile */}
        <div className="hidden md:block w-px h-6 bg-border/50 shrink-0" />

        {/* Filters toggle — min-w-[100px] */}
        <div className="skeleton h-10 w-full md:w-[108px] rounded-lg" />
      </div>
    </div>
  </div>
));
FilterBarSkeleton.displayName = "FilterBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST CARD SKELETON
// Mirrors PublicArtistCard structure exactly:
//   ┌─────────────────────┐
//   │  aspect-square      │  ← skeleton-cover (rounded-2xl at top)
//   │  image area         │
//   └─────────────────────┘
//   p-3 sm:p-4
//   ├── name row: h-5 + verified-dot slot
//   ├── stats row: h-3.5 (followers + dot + genre) sm+ only for dot+genre
//   ├── bio lines: h-3 × 2  hidden on mobile, visible md+
//   └── follow button: skeleton-btn h-9 w-full mt-auto
//
// `animationDelay` stagger matches ArtistPage's card entry stagger exactly.
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistCardSkeletonProps {
  index: number;
}

const ArtistCardSkeleton = memo(({ index }: ArtistCardSkeletonProps) => {
  const nameWidth = CARD_NAME_WIDTHS[index % CARD_NAME_WIDTHS.length];
  const statWidth = CARD_STAT_WIDTHS[index % CARD_STAT_WIDTHS.length];
  const bio1Width = CARD_BIO_WIDTHS_1[index % CARD_BIO_WIDTHS_1.length];
  const bio2Width = CARD_BIO_WIDTHS_2[index % CARD_BIO_WIDTHS_2.length];

  return (
    <div
      className="flex flex-col bg-card rounded-2xl overflow-hidden border border-border/40 shadow-raised"
      style={{ animationDelay: `${staggerDelay(index)}ms` }}
      aria-hidden="true"
    >
      {/* ── Cover art — aspect-square, skeleton-cover (radius-xl) ── */}
      <div className="skeleton skeleton-cover w-full aspect-square rounded-none" />

      {/* ── Info section — p-3 sm:p-4 ── */}
      <div className="p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 flex-1">
        {/* Name row — h-5 (font-black text-base sm:text-[18px]) */}
        {/* Verified badge slot is hidden in skeleton — prevents layout jump */}
        <div
          className="skeleton h-5 rounded-full"
          style={{ width: nameWidth }}
        />

        {/* Stats row — followers chip + dot + genre (sm+) */}
        <div className="flex items-center gap-2">
          {/* Followers: icon + count — always visible */}
          <div className="skeleton h-3.5 w-16 rounded-full" />

          {/* Dot separator — sm+ */}
          <div className="hidden sm:block skeleton size-[5px] rounded-full" />

          {/* Genre / track count — sm+ */}
          <div
            className="hidden sm:block skeleton h-3.5 rounded-full"
            style={{ width: statWidth }}
          />
        </div>

        {/* Bio lines — hidden on mobile, md+ only (2 lines, line-clamp-2) */}
        <div className="hidden md:flex flex-col gap-1.5">
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: bio1Width }}
          />
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: bio2Width }}
          />
        </div>

        {/* Follow button — skeleton-btn (h-2.25rem radius-lg), pushed to bottom */}
        <div className="skeleton skeleton-btn w-full mt-auto" />
      </div>
    </div>
  );
});
ArtistCardSkeleton.displayName = "ArtistCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST GRID SKELETON — exact GRID_LAYOUT from ArtistPage
// ─────────────────────────────────────────────────────────────────────────────

const ArtistGridSkeleton = memo(({ count }: { count: number }) => (
  <div className={GRID_LAYOUT}>
    {Array.from({ length: count }, (_, i) => (
      <ArtistCardSkeleton key={i} index={i} />
    ))}
  </div>
));
ArtistGridSkeleton.displayName = "ArtistGridSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION SKELETON — mirrors PaginationStrip glass-frosted panel exactly
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
      {/* Left: "Showing X of Y results" */}
      <div className="skeleton skeleton-text w-32 h-3.5" />

      {/* Center: prev + page numbers + next */}
      <div className="flex items-center gap-1.5">
        {/* Prev button */}
        <div className="skeleton w-9 h-9 rounded-lg" />
        {/* Page number buttons × 5 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton w-9 h-9 rounded-lg" />
        ))}
        {/* Next button */}
        <div className="skeleton w-9 h-9 rounded-lg" />
      </div>

      {/* Right: "Page X of Y" — hidden on mobile */}
      <div className="hidden sm:block skeleton skeleton-text w-24 h-3.5" />
    </div>
  </div>
));
PaginationSkeleton.displayName = "PaginationSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST PAGE SKELETON — MAIN EXPORT
//
// Drop-in replacement during ArtistPage's `isLoading && artists.length === 0`.
// Identical DOM structure → seamless transition, zero CLS.
//
// Usage:
//   if (isLoading && artists.length === 0) return <ArtistPageSkeleton />;
//   // or with React.Suspense:
//   <Suspense fallback={<ArtistPageSkeleton cardCount={pageSize} />}>
//     <ArtistPage />
//   </Suspense>
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistPageSkeletonProps {
  /** Number of card skeletons to render. Defaults to 18 (above-fold on 2xl). */
  cardCount?: number;
}

const ArtistPageSkeleton: React.FC<ArtistPageSkeletonProps> = memo(
  ({ cardCount = SKELETON_CARD_COUNT }) => (
    <div
      className="relative min-h-screen pb-28"
      role="status"
      aria-busy="true"
      aria-label="Loading artist catalog"
    >
      {/* Hero header */}
      <HeroSkeleton />

      {/* Main content */}
      <main className="section-container space-y-6 sm:space-y-8">
        {/* Filter bar — glass-frosted wrapper matching ArtistPage */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand p-0.5",
          )}
        >
          <FilterBarSkeleton />
        </div>

        {/* Artist grid */}
        <section className="min-h-[50vh]" aria-label="Loading artists">
          <ArtistGridSkeleton count={cardCount} />
        </section>

        {/* Pagination strip */}
        <PaginationSkeleton />
      </main>

      {/* Screen-reader announcement */}
      <span className="sr-only">Loading artist catalog, please wait…</span>
    </div>
  ),
);

ArtistPageSkeleton.displayName = "ArtistPageSkeleton";
export default ArtistPageSkeleton;
