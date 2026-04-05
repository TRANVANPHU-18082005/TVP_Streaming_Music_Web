"use client";

/**
 * @file GenreDetailSkeleton.tsx — Full-page + embedded skeleton for GenreDetailPage
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 *
 * ARCHITECTURE
 *   GenreDetailSkeleton             — smart wrapper, accepts variant prop
 *   ├── PageVariantSkeleton         — full-page layout (<main>)
 *   │   ├── BackdropSkeleton        — gradient backdrop + grain overlay (68vh)
 *   │   ├── BackNavSkeleton         — chevron + "Quay lại" label
 *   │   ├── HeroSkeleton            — cover + type badge + title + desc + meta
 *   │   │   ├── CoverSkeletonLg     — 180–260px square, rounded-2xl + glow ring
 *   │   │   └── HeroInfoSkeleton    — badge + h1 + desc + stats + parent genre
 *   │   ├── StickyActionBarSkeleton — play btn + shuffle + more + mini-info chip
 *   │   ├── SubGenreSectionSkeleton — section header + SubGenreGrid placeholder
 *   │   └── TrackListSkeleton       — N track rows
 *   └── EmbeddedVariantSkeleton     — compact scrollable panel
 *       ├── GradientHeaderSkeleton  — 160px sticky gradient backdrop
 *       ├── CloseNavSkeleton        — close button placeholder
 *       ├── CompactHeaderSkeleton   — small cover (size-16/20) + info
 *       ├── ActionBarSkeleton       — reused (compact=true)
 *       ├── DescriptionSkeleton     — 3-line text placeholder
 *       ├── SubGenreEmbeddedSkeleton— sub-genre section (compact)
 *       └── TrackListSkeleton       — reused, fewer rows
 *
 * DIMENSIONS — mirror GenreDetailPage rendered sizes exactly → zero CLS.
 *
 * index.css TOKENS USED (all from provided stylesheet)
 *   .skeleton            §15  shimmer animation (bg gradient + bg-size 300% + animate-shimmer)
 *   .skeleton-text       §15  h-3.25 / pill radius
 *   .skeleton-cover      §15  radius-xl / aspect-ratio 1
 *   .skeleton-btn        §15  h-9 / radius-lg
 *   .shadow-elevated     § 7  standard mid elevation
 *   .scrollbar-thin      § 5  thin system scrollbar
 *   .glass-frosted       § 6  T2 glassmorphism (used on sticky bar)
 *
 * SIZING CONSTANTS (from GenreDetailPage):
 *   Cover lg:  size-[180px] sm:size-[220px] md:size-[260px]  rounded-2xl
 *   Cover sm:  size-16 sm:size-20                             rounded-xl
 *   Play btn:  size-14 sm:size-16 (page) / size-11 (embedded)
 *   Icon btns: size-10 sm:size-11
 *   Track row: size-9 cover + gap-3 + py-2
 */

import React, { memo } from "react";
import { ChevronLeft, Music4, Hash, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_ROW_COUNT_PAGE = 8;
const TRACK_ROW_COUNT_EMBEDDED = 5;
const SUBGENRE_COUNT_PAGE = 6;
const SUBGENRE_COUNT_EMBEDDED = 4;

/**
 * Deterministic width seeds — avoids uniform shimmer wall.
 * Mirrors real title/artist text width distribution in TrackList.
 */
const TRACK_TITLE_WIDTHS = [
  "65%",
  "80%",
  "52%",
  "72%",
  "48%",
  "85%",
  "60%",
  "68%",
] as const;

const TRACK_ARTIST_WIDTHS = [
  "42%",
  "55%",
  "36%",
  "50%",
  "44%",
  "58%",
  "38%",
  "48%",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR SKELETON
// Mirrors GenreActionBar:
//   [play size-14/16 or size-11] [shuffle size-10/11] [more size-10/11]
// ─────────────────────────────────────────────────────────────────────────────

const ActionBarSkeleton = memo(({ compact = false }: { compact?: boolean }) => (
  <div
    className="flex items-center gap-2.5 sm:gap-3"
    aria-hidden="true"
    role="presentation"
  >
    {/* Play button */}
    <div
      className={cn(
        "skeleton rounded-full shrink-0",
        compact ? "size-11" : "size-14 sm:size-16",
      )}
    />
    {/* Shuffle */}
    <div className="skeleton size-10 sm:size-11 rounded-full" />
    {/* More */}
    <div className="skeleton size-10 sm:size-11 rounded-full" />
  </div>
));
ActionBarSkeleton.displayName = "ActionBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW SKELETON
// Mirrors TrackList row inside GenreDetailPage:
//   [cover size-9 rounded-lg] [title+artist] [duration]
// ─────────────────────────────────────────────────────────────────────────────

interface TrackRowSkeletonProps {
  index: number;
}

const TrackRowSkeleton = memo(({ index }: TrackRowSkeletonProps) => {
  const titleW = TRACK_TITLE_WIDTHS[index % TRACK_TITLE_WIDTHS.length];
  const artistW = TRACK_ARTIST_WIDTHS[index % TRACK_ARTIST_WIDTHS.length];

  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
      aria-hidden="true"
    >
      {/* Cover — size-9 rounded-lg (matches TrackListSkeleton in GenreDetailPage) */}
      <div className="skeleton size-9 rounded-lg shrink-0" />

      {/* Title + artist */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="skeleton h-3 rounded-full" style={{ width: titleW }} />
        <div
          className="skeleton h-2.5 rounded-full opacity-70"
          style={{ width: artistW }}
        />
      </div>

      {/* Duration */}
      <div className="skeleton h-3 w-10 rounded-full shrink-0" />
    </div>
  );
});
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SKELETON — container with dividers
// Mirrors: rounded-2xl overflow-hidden border border-border/25
//          bg-background/35 backdrop-blur-sm
// ─────────────────────────────────────────────────────────────────────────────

const TrackListSkeleton = memo(({ count }: { count: number }) => (
  <div
    className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm"
    aria-hidden="true"
  >
    {Array.from({ length: count }, (_, i) => (
      <React.Fragment key={i}>
        <TrackRowSkeleton index={i} />
        {i < count - 1 && (
          <div className="mx-4 h-px bg-border/20" aria-hidden="true" />
        )}
      </React.Fragment>
    ))}
  </div>
));
TrackListSkeleton.displayName = "TrackListSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SUBGENRE GRID SKELETON
// Mirrors SubGenreGrid — grid of genre cards
// Page: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6
// Embedded: compact 2-col scroll
// ─────────────────────────────────────────────────────────────────────────────

const SubGenreGridSkeleton = memo(
  ({ count, compact = false }: { count: number; compact?: boolean }) => (
    <div
      className={cn(
        "grid gap-3",
        compact
          ? "grid-cols-2 gap-2"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton aspect-square rounded-xl"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  ),
);
SubGenreGridSkeleton.displayName = "SubGenreGridSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// COVER SKELETON — lg variant
// Mirrors GenreCover size="lg":
//   size-[180px] sm:size-[220px] md:size-[260px]  rounded-2xl
//   shadow-[0_16px_40px_rgba(0,0,0,0.35)]
//   + outer glow ring (absolute -inset-3 blur-3xl opacity-30)
// ─────────────────────────────────────────────────────────────────────────────

const CoverSkeletonLg = memo(() => (
  <div className="group relative shrink-0" aria-hidden="true">
    {/* Glow ring — mirrors GenreCover's ambient glow */}
    <div
      className="absolute -inset-3 rounded-3xl blur-3xl opacity-20 pointer-events-none"
      style={{ background: "hsl(var(--primary)/0.5)" }}
    />
    {/* Cover box */}
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "size-[180px] sm:size-[220px] md:size-[260px]",
        "shadow-[0_16px_40px_rgba(0,0,0,0.35)]",
        "border border-border/20",
      )}
    >
      <div className="skeleton absolute inset-0" />
      {/* Icon ghost — matches GenreCover fallback */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
        <Music4 className="size-16 text-foreground" />
      </div>
      {/* Ring overlay */}
      <div className="absolute inset-0 ring-1 ring-inset ring-black/15 pointer-events-none rounded-[inherit]" />
    </div>
  </div>
));
CoverSkeletonLg.displayName = "CoverSkeletonLg";

// ─────────────────────────────────────────────────────────────────────────────
// COVER SKELETON — sm variant (embedded)
// Mirrors GenreCover size="sm":
//   size-16 sm:size-20  rounded-xl
// ─────────────────────────────────────────────────────────────────────────────

const CoverSkeletonSm = memo(() => (
  <div className="relative shrink-0" aria-hidden="true">
    <div
      className={cn(
        "skeleton rounded-xl overflow-hidden border border-border/20",
        "size-16 sm:size-20",
        "shadow-[0_8px_20px_rgba(0,0,0,0.22)]",
      )}
    />
  </div>
));
CoverSkeletonSm.displayName = "CoverSkeletonSm";

// ─────────────────────────────────────────────────────────────────────────────
// HERO INFO SKELETON (page variant)
// Mirrors hero info column:
//   [Hash badge pill] [h1 2-lines] [description] [GenreStats] [parent genre link]
// ─────────────────────────────────────────────────────────────────────────────

const HeroInfoSkeleton = memo(() => (
  <div
    className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
    aria-hidden="true"
  >
    {/* Type badge — "Thể loại âm nhạc" pill with Hash icon */}
    <div className="inline-flex items-center gap-1.5">
      <Hash className="size-3 text-foreground/20 shrink-0" aria-hidden="true" />
      <div className="skeleton h-5 w-32 rounded-full" />
    </div>

    {/* h1 — large, 2 line maximum  */}
    <div className="w-full space-y-3">
      <div className="skeleton rounded-lg h-12 sm:h-14 md:h-16 lg:h-[5.5rem] w-[88%]" />
      <div className="skeleton rounded-lg h-12 sm:h-14 md:h-16 lg:h-[5.5rem] w-[62%]" />
    </div>

    {/* Description — 2 lines */}
    <div className="w-full space-y-2 mt-1">
      <div className="skeleton h-4 rounded-full w-[92%]" />
      <div className="skeleton h-4 rounded-full w-[68%]" />
    </div>

    {/* GenreStats — track count + separator dot + artist count */}
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
      <div className="skeleton h-3.5 w-24 rounded-full" />
      <div className="skeleton size-1 rounded-full opacity-30 hidden sm:block" />
      <div className="skeleton h-3.5 w-20 rounded-full" />
    </div>

    {/* Parent genre link — chevron + label */}
    <div className="flex items-center gap-1.5 mt-0.5">
      <ChevronLeft
        className="size-3 text-foreground/15 shrink-0"
        aria-hidden="true"
      />
      <div className="skeleton h-3 w-40 rounded-full" />
    </div>
  </div>
));
HeroInfoSkeleton.displayName = "HeroInfoSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// BACKDROP (page variant)
// Mirrors GenreDetailPage backdrop structure exactly:
//   1. themeColor gradient (0→50%→transparent, 68vh)
//   2. noise texture overlay (opacity 0.025)
//   3. via-background/55 fade-to-background gradient
// ─────────────────────────────────────────────────────────────────────────────

const BackdropSkeleton = memo(() => (
  <>
    {/* Color gradient */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
      style={{
        background: `linear-gradient(180deg,
          hsl(var(--primary)/0.38) 0%,
          hsl(var(--primary)/0.12) 50%,
          transparent 100%)`,
      }}
    />
    {/* Noise grain */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "180px",
      }}
    />
    {/* Fade to background */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
    />
  </>
));
BackdropSkeleton.displayName = "BackdropSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE VARIANT SKELETON
// Mirrors full GenreDetailPage (variant="page") structure.
// ─────────────────────────────────────────────────────────────────────────────

const PageVariantSkeleton = memo(() => (
  <main
    className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32"
    role="status"
    aria-busy="true"
    aria-label="Loading genre"
  >
    {/* Backdrop */}
    <BackdropSkeleton />

    <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
      {/* ── Back nav ── */}
      <div className="pt-5 pb-2">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/35"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-14 rounded-full" />
        </div>
      </div>

      {/* ── Hero section ── */}
      <section
        aria-hidden="true"
        className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10"
      >
        {/* Cover */}
        <CoverSkeletonLg />

        {/* Info */}
        <HeroInfoSkeleton />
      </section>

      {/* ── Sticky action bar area ── */}
      {/*
        Mirrors sticky bar: flex items-center justify-between gap-4
        Left: GenreActionBar  |  Right: mini-info chip (name + small cover)
      */}
      <div
        className="py-3 mb-10 flex items-center justify-between gap-4"
        aria-hidden="true"
      >
        {/* Action buttons */}
        <ActionBarSkeleton />

        {/* Mini info chip (right side) — hidden when not scrolled but keeps layout */}
        <div className="hidden sm:flex items-center gap-2.5 opacity-30">
          <div className="skeleton h-4 w-28 rounded-full hidden sm:block" />
          <div className="skeleton size-9 sm:size-10 rounded-xl" />
        </div>
      </div>

      {/* ── Content sections ── */}
      <div className="space-y-16">
        {/* Sub-genres section */}
        <section aria-hidden="true" className="animate-in fade-in duration-500">
          {/* Section header — mirrors PageSectionHeader + ChevronRight */}
          <div className="flex items-center gap-2 mb-6">
            <div className="skeleton h-6 sm:h-7 w-48 rounded-lg" />
            <ChevronRight
              className="size-5 text-foreground/15 shrink-0"
              aria-hidden="true"
            />
          </div>
          <SubGenreGridSkeleton count={SUBGENRE_COUNT_PAGE} />
        </section>

        {/* Popular tracks section */}
        <section
          aria-hidden="true"
          className="animate-in fade-in duration-500 delay-100"
        >
          <div className="flex items-center justify-between mb-5">
            {/* PageSectionHeader */}
            <div className="skeleton h-6 sm:h-7 w-40 rounded-lg" />
            {/* Track count badge */}
            <div className="skeleton h-3.5 w-16 rounded-full" />
          </div>
          <TrackListSkeleton count={TRACK_ROW_COUNT_PAGE} />
        </section>
      </div>
    </div>

    <span className="sr-only">Loading genre, please wait…</span>
  </main>
));
PageVariantSkeleton.displayName = "PageVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED VARIANT SKELETON
// Mirrors GenreDetailPage (variant="embedded") structure:
//   - sticky 160px gradient header
//   - -mt-[160px] content pull-up
//   - compact cover (size-16/20) + inline info
//   - ActionBar (compact)
//   - description lines
//   - sub-genres section
//   - track list (5 rows)
// ─────────────────────────────────────────────────────────────────────────────

const EmbeddedVariantSkeleton = memo(() => (
  <div
    className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
    role="status"
    aria-busy="true"
    aria-label="Loading genre"
  >
    {/* ── Sticky 160px gradient backdrop ── */}
    <div
      aria-hidden="true"
      className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--primary)/0.22) 0%, transparent 100%)",
      }}
    />

    <div className="relative z-10 -mt-[160px] px-4 pb-10">
      {/* ── Close nav ── */}
      <div className="flex items-center pt-4 pb-3">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/35"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-8 rounded-full" />
        </div>
      </div>

      {/* ── Compact header: cover sm + info ── */}
      <div className="flex items-center gap-4 pt-3 pb-5" aria-hidden="true">
        <CoverSkeletonSm />
        <div className="flex-1 min-w-0 space-y-2">
          {/* "Thể loại" label */}
          <div className="skeleton h-3 w-12 rounded-full opacity-70" />
          {/* Genre name */}
          <div className="skeleton h-5 w-[75%] rounded-md" />
          {/* GenreStats line */}
          <div className="flex items-center gap-2 mt-0.5">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton size-1 rounded-full opacity-30" />
            <div className="skeleton h-3 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <ActionBarSkeleton compact />

      {/* ── Description placeholder ── */}
      <div className="mt-5 space-y-2" aria-hidden="true">
        <div className="skeleton h-3.5 rounded-full w-[92%]" />
        <div className="skeleton h-3.5 rounded-full w-[78%]" />
        <div className="skeleton h-3.5 rounded-full w-[55%]" />
      </div>

      {/* ── Sub-genres section ── */}
      <div className="mt-7" aria-hidden="true">
        {/* EmbeddedSectionHeader: overline label with pip */}
        <div className="flex items-center gap-1.5 mb-3">
          <div
            className="inline-block w-3 h-0.5 rounded-full opacity-40"
            style={{ background: "hsl(var(--primary))" }}
          />
          <div className="skeleton h-2.5 w-16 rounded-full" />
        </div>
        <SubGenreGridSkeleton count={SUBGENRE_COUNT_EMBEDDED} compact />
      </div>

      {/* ── Track list ── */}
      <div className="mt-7" aria-hidden="true">
        {/* EmbeddedSectionHeader: "Bài hát nổi bật" */}
        <div className="flex items-center gap-1.5 mb-3">
          <div
            className="inline-block w-3 h-0.5 rounded-full opacity-40"
            style={{ background: "hsl(var(--primary))" }}
          />
          <div className="skeleton h-2.5 w-24 rounded-full" />
        </div>
        <div className="rounded-xl overflow-hidden border border-border/30 bg-card/40">
          <TrackListSkeleton count={TRACK_ROW_COUNT_EMBEDDED} />
        </div>
      </div>
    </div>

    <span className="sr-only">Loading genre, please wait…</span>
  </div>
));
EmbeddedVariantSkeleton.displayName = "EmbeddedVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE DETAIL SKELETON — MAIN EXPORT
//
// Usage (drop-in replacement inside GenreDetailPage):
//
//   if (loadingGenre) return <GenreDetailSkeleton variant={variant} />;
//
// The component is intentionally separate from GenreDetailPage's internal
// `GenreDetailSkeleton` const (which was not exported). This standalone
// export matches the PlaylistDetailSkeleton pattern for consistent usage.
// ─────────────────────────────────────────────────────────────────────────────

export interface GenreDetailSkeletonProps {
  variant?: "page" | "embedded";
}

const GenreDetailSkeleton: React.FC<GenreDetailSkeletonProps> = memo(
  ({ variant = "page" }) =>
    variant === "embedded" ? (
      <EmbeddedVariantSkeleton />
    ) : (
      <PageVariantSkeleton />
    ),
);

GenreDetailSkeleton.displayName = "GenreDetailSkeleton";
export default GenreDetailSkeleton;
