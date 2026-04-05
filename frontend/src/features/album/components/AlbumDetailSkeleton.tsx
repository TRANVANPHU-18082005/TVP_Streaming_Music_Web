"use client";

/**
 * @file AlbumDetailSkeleton.tsx — Full-page + embedded skeleton for AlbumDetailPage
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 *
 * ARCHITECTURE
 *   AlbumDetailSkeleton          — smart wrapper, accepts variant prop
 *   ├── PageVariantSkeleton      — full-page layout with fixed gradient backdrop
 *   │   ├── BackNavSkeleton      — chevron + "Quay lại"
 *   │   ├── HeroSkeleton         — cover + info column (type badge + title + artist + genres)
 *   │   │   ├── CoverSkeletonLg  — 200–320px square, rounded-2xl
 *   │   │   └── HeroInfoSkeleton — badge + title lines + artist row + stats + genre chips
 *   │   ├── ActionBarSkeleton    — play + shuffle + heart + [spacer] + more
 *   │   ├── TrackListSkeleton    — N rows: index + cover + title/artist + album + duration + more
 *   │   └── FooterSkeleton       — date line + copyright lines
 *   └── EmbeddedVariantSkeleton  — compact panel with sticky gradient header
 *       ├── EmbeddedHeaderSkeleton — small cover + compact info inline
 *       ├── ActionBarSkeleton    — reused, compact density
 *       ├── AlbumStatsSkeleton   — "X bài · Y phút" line
 *       └── TrackListSkeleton    — reused, fewer rows
 *
 * EXACT DIMENSION MATCH → zero CLS on data arrival:
 *   Cover lg: size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px]
 *   Cover sm: size-20 (80px)
 *   Track row: py-2.5 → ≈ 44–48px per row
 *   Action bar: play size-14/16, controls size-10/11
 *   Genre chips: h-6, w varies
 *
 * index.css TOKENS USED
 *   .skeleton            §15  shimmer animation
 *   .skeleton-text       §15  h-3.5 + radius-pill
 *   .skeleton-cover      §15  radius-xl
 *   .scrollbar-thin      § 5  thin scrollbar
 *   .glass-frosted       § 6  T2 glassmorphism
 */

import React, { memo } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_ROWS_PAGE = 10;
const TRACK_ROWS_EMBEDDED = 6;

/**
 * Deterministic width seeds — avoids uniform "shimmer wall".
 * Indexes rotate: titleW[i % N], artistW[i % M]
 */
const TITLE_WIDTHS = [
  "64%",
  "80%",
  "56%",
  "72%",
  "50%",
  "84%",
  "60%",
  "68%",
  "76%",
  "52%",
] as const;
const ARTIST_WIDTHS = [
  "46%",
  "58%",
  "38%",
  "52%",
  "44%",
  "62%",
  "36%",
  "50%",
  "54%",
  "42%",
] as const;
const ALBUM_WIDTHS = [
  "55%",
  "70%",
  "48%",
  "62%",
  "44%",
  "72%",
  "50%",
  "60%",
  "66%",
  "46%",
] as const;

const stagger = (i: number) => Math.min(i * 38, 380);

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR SKELETON
// Mirrors ActionBar: [play size-14/16] [shuffle size-10/11] [heart size-10/11]
//                    [flex-1 spacer] [more size-10/11]
// ─────────────────────────────────────────────────────────────────────────────

const ActionBarSkeleton = memo(({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-3" aria-hidden="true">
    {/* Play — size-14 sm:size-16 (full) | size-12 (compact) */}
    <div
      className={cn(
        "skeleton rounded-full shrink-0",
        compact ? "size-12" : "size-14 sm:size-16",
      )}
    />
    {/* Shuffle */}
    <div
      className={cn(
        "skeleton rounded-full",
        compact ? "size-10" : "size-10 sm:size-11",
      )}
    />
    {/* Heart */}
    <div
      className={cn(
        "skeleton rounded-full",
        compact ? "size-10" : "size-10 sm:size-11",
      )}
    />
    {/* Spacer */}
    <div className="flex-1" />
    {/* More / context menu */}
    <div
      className={cn(
        "skeleton rounded-full",
        compact ? "size-9" : "size-10 sm:size-11",
      )}
    />
  </div>
));
ActionBarSkeleton.displayName = "ActionBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW SKELETON
// Mirrors TrackList row:
//   [index w-5] [cover 44-48px] [title+artist flex-1] [album hidden-lg] [duration] [more]
// ─────────────────────────────────────────────────────────────────────────────

const TrackRowSkeleton = memo(({ index }: { index: number }) => (
  <div
    className="flex items-center gap-3 px-4 py-2.5"
    style={{ animationDelay: `${stagger(index)}ms` }}
    aria-hidden="true"
  >
    {/* Track number */}
    <div className="skeleton w-5 h-3 rounded-sm shrink-0 opacity-50" />

    {/* Cover — 44px / 48px */}
    <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

    {/* Title + artist */}
    <div className="flex-1 space-y-2 min-w-0">
      <div
        className="skeleton h-3.5 rounded-full"
        style={{ width: TITLE_WIDTHS[index % TITLE_WIDTHS.length] }}
      />
      <div
        className="skeleton h-3 rounded-full"
        style={{ width: ARTIST_WIDTHS[index % ARTIST_WIDTHS.length] }}
      />
    </div>

    {/* Album col — lg+ */}
    <div
      className="skeleton h-3 rounded-full hidden lg:block"
      style={{ width: ALBUM_WIDTHS[index % ALBUM_WIDTHS.length] }}
    />

    {/* Duration — sm+ */}
    <div className="skeleton h-3 w-9 rounded-full hidden sm:block" />

    {/* More icon */}
    <div className="skeleton size-7 rounded-lg opacity-40" />
  </div>
));
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SKELETON — divider between rows
// ─────────────────────────────────────────────────────────────────────────────

const TrackListSkeleton = memo(({ count }: { count: number }) => (
  <div
    className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm"
    aria-hidden="true"
  >
    {Array.from({ length: count }, (_, i) => (
      <React.Fragment key={i}>
        <TrackRowSkeleton index={i} />
        {i < count - 1 && <div className="mx-4 h-px bg-border/20" />}
      </React.Fragment>
    ))}
  </div>
));
TrackListSkeleton.displayName = "TrackListSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// COVER SKELETON — lg (page variant)
// Mirrors HeroCover size="lg":
//   size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px], rounded-2xl
// Includes ambient glow orb behind the cover.
// ─────────────────────────────────────────────────────────────────────────────

const CoverSkeletonLg = memo(() => (
  <div
    className="relative shrink-0 self-center md:self-auto"
    aria-hidden="true"
  >
    {/* Ambient glow blob */}
    <div className="absolute -inset-3 rounded-2xl bg-primary/15 blur-3xl opacity-20 pointer-events-none" />
    <div
      className={cn(
        "relative skeleton skeleton-cover",
        "size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px]",
        "rounded-2xl",
        "shadow-[0_24px_60px_rgba(0,0,0,0.38)]",
      )}
    />
  </div>
));
CoverSkeletonLg.displayName = "CoverSkeletonLg";

// ─────────────────────────────────────────────────────────────────────────────
// HERO INFO SKELETON (page variant)
// Mirrors the right column of the hero section:
//   type badge | h1 title (2 lines) | artist row | stats row | genre chips
// ─────────────────────────────────────────────────────────────────────────────

const HeroInfoSkeleton = memo(() => (
  <div
    className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
    aria-hidden="true"
  >
    {/* Type badge — rounded-full, h-6, w-16 */}
    <div className="skeleton h-6 w-16 rounded-full" />

    {/* h1 — 2 lines, large text */}
    <div className="w-full space-y-2.5">
      <div className="skeleton h-10 sm:h-12 md:h-14 w-[80%] rounded-lg" />
      <div className="skeleton h-10 sm:h-12 md:h-14 w-[55%] rounded-lg" />
    </div>

    {/* Artist row + stats: avatar + name + separator + "X bài · Y phút" */}
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1.5 mt-1">
      <div className="flex items-center gap-2">
        <div className="skeleton size-6 rounded-full" />
        <div className="skeleton h-4 w-28 rounded-full" />
      </div>
      <div className="hidden sm:block skeleton size-1 rounded-full opacity-30" />
      <div className="skeleton h-4 w-32 rounded-full" />
    </div>

    {/* Genre chips — 3 chips of varying width */}
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-1">
      {["w-14", "w-20", "w-16"].map((w, i) => (
        <div key={i} className={cn("skeleton h-6 rounded-full", w)} />
      ))}
    </div>
  </div>
));
HeroInfoSkeleton.displayName = "HeroInfoSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE VARIANT SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const PageVariantSkeleton = memo(() => (
  <main
    className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32"
    role="status"
    aria-busy="true"
    aria-label="Loading album"
  >
    {/* Backdrop gradient — primary tint (matches AlbumDetailPage's dynamic gradient) */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[70vh] pointer-events-none"
      style={{
        background: `linear-gradient(180deg,
          hsl(var(--primary)/0.38) 0%,
          hsl(var(--primary)/0.12) 45%,
          transparent 100%)`,
      }}
    />
    {/* Grain texture */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[70vh] pointer-events-none opacity-[0.03]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "180px",
      }}
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
    />

    <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
      {/* Back nav */}
      <div className="pt-5 pb-2">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/35"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-14 rounded-full" />
        </div>
      </div>

      {/* Hero — flex-col md:flex-row, items-center md:items-end */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10">
        <CoverSkeletonLg />
        <HeroInfoSkeleton />
      </div>

      {/* Sticky action bar placeholder */}
      <div className="py-3 mb-8 flex items-center justify-between gap-4">
        <ActionBarSkeleton />
        {/* Mini cover + title chip (right side) */}
        <div
          className="hidden sm:flex items-center gap-2.5 opacity-35"
          aria-hidden="true"
        >
          <div className="skeleton h-4 w-36 rounded-full" />
          <div className="skeleton size-9 sm:size-10 rounded-lg" />
        </div>
      </div>

      {/* Track list */}
      <TrackListSkeleton count={TRACK_ROWS_PAGE} />

      {/* Footer skeleton */}
      <div
        className="mt-16 pt-7 border-t border-border/20 space-y-2.5 pb-8"
        aria-hidden="true"
      >
        <div className="skeleton h-3 w-48 rounded-full" />
        <div className="skeleton h-3 w-64 rounded-full opacity-60" />
        <div className="skeleton h-3 w-56 rounded-full opacity-50" />
      </div>
    </div>

    <span className="sr-only">Loading album, please wait…</span>
  </main>
));
PageVariantSkeleton.displayName = "PageVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED VARIANT SKELETON
// Mirrors embedded variant:
//   sticky gradient 200px | close nav | header row (cover-sm + info) |
//   action bar (compact) | stats line | track list
// ─────────────────────────────────────────────────────────────────────────────

const EmbeddedVariantSkeleton = memo(() => (
  <div
    className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
    role="status"
    aria-busy="true"
    aria-label="Loading album"
  >
    {/* Sticky gradient header */}
    <div
      aria-hidden="true"
      className="sticky top-0 h-[200px] pointer-events-none shrink-0 z-0"
      style={{
        background: `linear-gradient(180deg,
          hsl(var(--primary)/0.28) 0%,
          transparent 100%)`,
      }}
    />

    <div className="relative z-10 -mt-[200px] px-4 pb-10">
      {/* Close nav */}
      <div className="pt-4 pb-3">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/35"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-10 rounded-full" />
        </div>
      </div>

      {/* Compact header: small cover + info inline */}
      <div className="flex items-center gap-4 pt-2 pb-5" aria-hidden="true">
        {/* Cover sm — size-20 */}
        <div className="relative shrink-0">
          <div className="absolute -inset-2 rounded-2xl bg-primary/12 blur-2xl opacity-20 pointer-events-none" />
          <div className="relative skeleton skeleton-cover size-20 rounded-2xl" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Type badge */}
          <div className="skeleton h-5 w-14 rounded-full" />
          {/* Title */}
          <div className="skeleton h-6 w-[75%] rounded-md" />
          {/* Artist + year */}
          <div className="flex items-center gap-2 mt-1">
            <div className="skeleton size-[18px] rounded-full" />
            <div className="skeleton h-3.5 w-24 rounded-full" />
            <div className="hidden sm:block skeleton size-1 rounded-full opacity-30" />
            <div className="hidden sm:block skeleton h-3.5 w-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Action bar — compact density */}
      <div className="mb-5">
        <ActionBarSkeleton compact />
      </div>

      {/* Album stats line — "X bài hát · Y phút" */}
      <div className="flex items-center gap-1.5 mb-5" aria-hidden="true">
        <div className="skeleton size-3.5 rounded-sm opacity-50" />
        <div className="skeleton h-3.5 w-32 rounded-full" />
      </div>

      {/* Track list */}
      <div className="rounded-xl overflow-hidden border border-border/30 bg-card/40">
        {Array.from({ length: TRACK_ROWS_EMBEDDED }, (_, i) => (
          <React.Fragment key={i}>
            <TrackRowSkeleton index={i} />
            {i < TRACK_ROWS_EMBEDDED - 1 && (
              <div className="mx-4 h-px bg-border/20" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>

    <span className="sr-only">Loading album, please wait…</span>
  </div>
));
EmbeddedVariantSkeleton.displayName = "EmbeddedVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM DETAIL SKELETON — MAIN EXPORT
//
// Drop-in replacement:
//   if (isLoading) return <AlbumDetailSkeleton variant={variant} />;
// ─────────────────────────────────────────────────────────────────────────────

interface AlbumDetailSkeletonProps {
  variant?: "page" | "embedded";
}

const AlbumDetailSkeleton: React.FC<AlbumDetailSkeletonProps> = memo(
  ({ variant = "page" }) =>
    variant === "embedded" ? (
      <EmbeddedVariantSkeleton />
    ) : (
      <PageVariantSkeleton />
    ),
);

AlbumDetailSkeleton.displayName = "AlbumDetailSkeleton";
export default AlbumDetailSkeleton;
