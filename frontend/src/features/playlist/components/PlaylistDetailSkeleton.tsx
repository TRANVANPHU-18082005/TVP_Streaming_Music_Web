"use client";

/**
 * @file PlaylistDetailSkeleton.tsx — Full-page + embedded skeleton for PlaylistDetailPage
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 *
 * ARCHITECTURE
 *   PlaylistDetailSkeleton          — smart wrapper, accepts variant prop
 *   ├── PageVariantSkeleton         — full-page layout (position:fixed bg)
 *   │   ├── HeroBgSkeleton          — gradient backdrop + grain overlay
 *   │   ├── BackNavSkeleton         — chevron + "Quay lại" label
 *   │   ├── HeroSkeleton            — cover + title + meta + badges
 *   │   │   ├── CoverSkeleton       — 200–290px square, rounded-2xl
 *   │   │   └── HeroInfoSkeleton    — type badge + title + desc + meta row
 *   │   ├── ActionBarSkeleton       — play btn + shuffle + heart + more
 *   │   └── TrackListSkeleton       — N track rows (icon + title + meta + duration)
 *   └── EmbeddedVariantSkeleton     — compact layout, scrollable panel
 *       ├── EmbeddedHeaderSkeleton  — small cover + compact info
 *       ├── ActionBarSkeleton       — reused
 *       └── TrackListSkeleton       — reused, fewer rows
 *
 * DIMENSIONS — all mirror PlaylistDetailPage rendered sizes exactly → zero CLS.
 *
 * index.css TOKENS USED
 *   .skeleton            §15  shimmer animation
 *   .skeleton-text       §15  h-3.5 pill radius
 *   .skeleton-cover      §15  radius-xl
 *   .skeleton-btn        §15  h-9 radius-lg
 *   .glass-frosted       § 6  T2 glassmorphism
 *   .shadow-raised       § 7  standard elevation
 *   .card-base           §20  bg-card + border + rounded-xl
 *   .scrollbar-thin      § 5  thin scrollbar
 */

import React, { memo } from "react";
import { ChevronLeft, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_ROW_COUNT_PAGE = 10;
const TRACK_ROW_COUNT_EMBEDDED = 6;

/**
 * Deterministic width seeds per row — avoids uniform shimmer wall.
 * Pattern mirrors TrackList actual title/artist widths.
 */
const TRACK_TITLE_WIDTHS = [
  "62%",
  "78%",
  "54%",
  "70%",
  "48%",
  "82%",
  "58%",
  "66%",
  "74%",
  "50%",
] as const;
const TRACK_ARTIST_WIDTHS = [
  "45%",
  "55%",
  "38%",
  "50%",
  "42%",
  "60%",
  "35%",
  "48%",
  "52%",
  "40%",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR SKELETON
// Mirrors PlaylistActionBar:
//   [play size-14/16] [shuffle size-10] [heart size-10] [more size-10]
//   + owner tools: [manage size-10] [edit size-10]
// ─────────────────────────────────────────────────────────────────────────────

const ActionBarSkeleton = memo(({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-2.5 sm:gap-3" aria-hidden="true">
    {/* Play button — size-14 sm:size-16 on page, size-11 on embedded */}
    <div
      className={cn(
        "skeleton rounded-full shrink-0",
        compact ? "size-11" : "size-14 sm:size-16",
      )}
    />
    {/* Shuffle */}
    <div className="skeleton size-10 sm:size-11 rounded-full" />
    {/* Heart */}
    <div className="skeleton size-10 sm:size-11 rounded-full" />
    {/* Owner: manage + edit (shown as faint placeholders) */}
    <div className="skeleton size-10 sm:size-11 rounded-full opacity-50" />
    <div className="skeleton size-10 sm:size-11 rounded-full opacity-50" />
    {/* More */}
    <div className="skeleton size-10 sm:size-11 rounded-full" />
  </div>
));
ActionBarSkeleton.displayName = "ActionBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW SKELETON
// Mirrors TrackList row: [index/icon] [cover] [title+artist] [duration]
// Heights match real rendered values — zero CLS on data arrival.
// ─────────────────────────────────────────────────────────────────────────────

interface TrackRowSkeletonProps {
  index: number;
}

const TrackRowSkeleton = memo(({ index }: TrackRowSkeletonProps) => {
  const titleW = TRACK_TITLE_WIDTHS[index % TRACK_TITLE_WIDTHS.length];
  const artistW = TRACK_ARTIST_WIDTHS[index % TRACK_ARTIST_WIDTHS.length];

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
      aria-hidden="true"
    >
      {/* Track number / play icon — w-8 */}
      <div className="skeleton w-5 h-3.5 rounded-sm shrink-0 opacity-50" />

      {/* Cover — size-[44px] sm:size-[48px] */}
      <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

      {/* Title + artist */}
      <div className="flex-1 space-y-2 min-w-0">
        <div
          className="skeleton h-3.5 rounded-full"
          style={{ width: titleW }}
        />
        <div className="skeleton h-3 rounded-full" style={{ width: artistW }} />
      </div>

      {/* Album — hidden below lg */}
      <div className="skeleton h-3 w-24 rounded-full hidden lg:block opacity-50" />

      {/* Duration — hidden below sm */}
      <div className="skeleton h-3 w-9 rounded-full hidden sm:block" />

      {/* More icon slot */}
      <div className="skeleton size-7 rounded-lg opacity-40" />
    </div>
  );
});
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SKELETON — container with dividers between rows
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
// COVER SKELETON — lg variant
// Mirrors PlaylistCover size="lg": 200–290px, rounded-2xl, box-shadow
// ─────────────────────────────────────────────────────────────────────────────

const CoverSkeletonLg = memo(() => (
  <div
    className={cn(
      "relative shrink-0",
      "size-[200px] sm:size-[240px] md:size-[290px]",
      "rounded-2xl overflow-hidden",
      "shadow-[0_16px_40px_rgba(0,0,0,0.38)]",
    )}
    aria-hidden="true"
  >
    <div className="skeleton absolute inset-0" />
    {/* Icon overlay — matches fallback state */}
    <div className="absolute inset-0 flex items-center justify-center opacity-10">
      <ListMusic className="size-14 text-foreground" />
    </div>
  </div>
));
CoverSkeletonLg.displayName = "CoverSkeletonLg";

// ─────────────────────────────────────────────────────────────────────────────
// HERO INFO SKELETON (page variant)
// Mirrors hero info column:
//   type badge row | h1 title | description | creator row + meta
// ─────────────────────────────────────────────────────────────────────────────

const HeroInfoSkeleton = memo(() => (
  <div
    className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
    aria-hidden="true"
  >
    {/* Type badge row — "Hệ thống / Cộng đồng" pill + visibility badge */}
    <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
      <div className="skeleton h-6 w-24 rounded-full" />
      <div className="skeleton h-5 w-16 rounded-full" />
    </div>

    {/* Title — font-black large, 2–3 lines possible */}
    <div className="w-full space-y-2.5">
      <div className="skeleton h-10 sm:h-12 md:h-14 w-[85%] rounded-lg" />
      <div className="skeleton h-10 sm:h-12 md:h-14 w-[60%] rounded-lg" />
    </div>

    {/* Description — 2 lines */}
    <div className="w-full space-y-2 mt-1">
      <div className="skeleton skeleton-text w-[90%] h-4" />
      <div className="skeleton skeleton-text w-[70%] h-4" />
    </div>

    {/* Creator + meta row */}
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
      {/* Avatar + name */}
      <div className="flex items-center gap-2">
        <div className="skeleton size-6 rounded-full" />
        <div className="skeleton h-3.5 w-24 rounded-full" />
      </div>
      {/* Separator dot */}
      <div className="hidden sm:block skeleton size-1 rounded-full opacity-30" />
      {/* Track count */}
      <div className="skeleton h-3.5 w-20 rounded-full" />
      {/* Duration */}
      <div className="skeleton h-3.5 w-16 rounded-full" />
      {/* Created at */}
      <div className="skeleton h-3.5 w-20 rounded-full hidden sm:block" />
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
    aria-label="Loading playlist"
  >
    {/* ── Backdrop gradient — matches themeColor gradient, uses primary tint */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] pointer-events-none"
      style={{
        background: `linear-gradient(180deg,
          hsl(var(--primary)/0.35) 0%,
          hsl(var(--primary)/0.10) 50%,
          transparent 100%)`,
      }}
    />
    {/* Grain texture */}
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "180px",
      }}
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
    />

    <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
      {/* ── Back nav ── */}
      <div className="pt-5 pb-2">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/40"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-14 rounded-full" />
        </div>
      </div>

      {/* ── Hero section ── */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10">
        {/* Cover */}
        <div className="relative shrink-0">
          {/* Ambient glow ring */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-3xl blur-3xl opacity-20 pointer-events-none bg-primary/40"
          />
          <CoverSkeletonLg />
        </div>

        {/* Info column */}
        <HeroInfoSkeleton />
      </div>

      {/* ── Sticky action bar area ── */}
      <div className="py-3 mb-8 flex items-center justify-between gap-4">
        <ActionBarSkeleton />

        {/* Mini info chip (right side of sticky bar) */}
        <div
          className="hidden sm:flex items-center gap-2.5 opacity-40"
          aria-hidden="true"
        >
          <div className="skeleton h-4 w-32 rounded-full" />
          <div className="skeleton size-9 rounded-xl" />
        </div>
      </div>

      {/* ── Track list ── */}
      <TrackListSkeleton count={TRACK_ROW_COUNT_PAGE} />

      {/* ── Footer divider placeholder ── */}
      <div
        className="mt-16 pt-7 border-t border-border/20 flex flex-wrap items-center justify-center gap-4"
        aria-hidden="true"
      >
        <div className="skeleton h-3 w-32 rounded-full" />
        <div className="skeleton h-3 w-16 rounded-full" />
        <div className="skeleton h-3 w-20 rounded-full" />
      </div>
    </div>

    <span className="sr-only">Loading playlist, please wait…</span>
  </main>
));
PageVariantSkeleton.displayName = "PageVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED VARIANT SKELETON
// Mirrors embedded variant: compact header row + action bar + track list
// ─────────────────────────────────────────────────────────────────────────────

const EmbeddedVariantSkeleton = memo(() => (
  <div
    className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
    role="status"
    aria-busy="true"
    aria-label="Loading playlist"
  >
    {/* Gradient header area */}
    <div
      aria-hidden="true"
      className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
      style={{
        background: `linear-gradient(180deg, hsl(var(--primary)/0.22) 0%, transparent 100%)`,
      }}
    />

    <div className="relative z-10 -mt-[160px] px-4 pb-10">
      {/* Close nav */}
      <div className="flex items-center pt-4 pb-3">
        <div
          className="inline-flex items-center gap-1.5 text-muted-foreground/40"
          aria-hidden="true"
        >
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-8 rounded-full" />
        </div>
      </div>

      {/* Compact header: small cover + info */}
      <div className="flex items-center gap-3.5 pt-3 pb-5" aria-hidden="true">
        {/* Cover — size-[68px] sm:size-20 */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "skeleton",
              "size-[68px] sm:size-20",
              "rounded-xl overflow-hidden",
            )}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Type + visibility badges */}
          <div className="flex items-center gap-1.5">
            <div className="skeleton h-4 w-16 rounded-full" />
            <div className="skeleton h-4 w-12 rounded-full" />
          </div>
          {/* Title */}
          <div className="skeleton h-5 w-[75%] rounded-md" />
          {/* Meta */}
          <div className="skeleton h-3 w-[55%] rounded-full" />
        </div>
      </div>

      {/* Action bar */}
      <ActionBarSkeleton compact />

      {/* Description placeholder */}
      <div className="mt-4 space-y-1.5" aria-hidden="true">
        <div className="skeleton skeleton-text w-[90%] h-3.5" />
        <div className="skeleton skeleton-text w-[70%] h-3.5" />
        <div className="skeleton skeleton-text w-[50%] h-3.5" />
      </div>

      {/* Track list */}
      <div className="mt-6">
        <TrackListSkeleton count={TRACK_ROW_COUNT_EMBEDDED} />
      </div>
    </div>

    <span className="sr-only">Loading playlist, please wait…</span>
  </div>
));
EmbeddedVariantSkeleton.displayName = "EmbeddedVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST DETAIL SKELETON — MAIN EXPORT
//
// Usage (drop-in replacement):
//   if (isLoading) return <PlaylistDetailSkeleton variant={variant} />;
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistDetailSkeletonProps {
  variant?: "page" | "embedded";
}

const PlaylistDetailSkeleton: React.FC<PlaylistDetailSkeletonProps> = memo(
  ({ variant = "page" }) =>
    variant === "embedded" ? (
      <EmbeddedVariantSkeleton />
    ) : (
      <PageVariantSkeleton />
    ),
);

PlaylistDetailSkeleton.displayName = "PlaylistDetailSkeleton";
export default PlaylistDetailSkeleton;
