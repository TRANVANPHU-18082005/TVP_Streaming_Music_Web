import React, { memo } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_ROWS_PAGE = 8;
const TRACK_ROWS_EMBEDDED = 5;
const ALBUM_COLS_PAGE = 4; // grid-cols-2 sm:grid-cols-3 xl:grid-cols-4
const ALBUM_COLS_EMBEDDED = 4; // grid-cols-2, 4 cards

/**
 * Deterministic width seeds.
 * Track titles: medium-length Vietnamese artist names.
 * Album titles: short-to-medium.
 */
const TRACK_TITLE_WIDTHS = [
  "64%",
  "80%",
  "54%",
  "72%",
  "46%",
  "82%",
  "60%",
  "70%",
] as const;
const TRACK_ARTIST_WIDTHS = [
  "44%",
  "58%",
  "36%",
  "50%",
  "40%",
  "62%",
  "34%",
  "48%",
] as const;
const ALBUM_TITLE_WIDTHS = [
  "72%",
  "58%",
  "80%",
  "64%",
  "70%",
  "55%",
  "75%",
  "60%",
] as const;
const ALBUM_ARTIST_WIDTHS = [
  "52%",
  "42%",
  "60%",
  "48%",
  "55%",
  "38%",
  "58%",
  "44%",
] as const;

const stagger = (i: number) => Math.min(i * 40, 400);

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR SKELETON
// Mirrors ArtistActionBar:
//   [play size-14/16 | size-11] [shuffle size-10/11] [follow pill hidden-sm | follow-icon sm] [more size-10/11]
// ─────────────────────────────────────────────────────────────────────────────

const ActionBarSkeleton = memo(({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-2.5 sm:gap-3" aria-hidden="true">
    {/* Play */}
    <div
      className={cn(
        "skeleton rounded-full shrink-0",
        compact ? "size-11" : "size-14 sm:size-16",
      )}
    />
    {/* Shuffle */}
    <div
      className={cn(
        "skeleton rounded-full",
        compact ? "size-10" : "size-10 sm:size-11",
      )}
    />
    {/* Follow — pill (desktop) */}
    <div className="hidden sm:block skeleton h-9 w-32 rounded-xl" />
    {/* Follow — icon (mobile) */}
    <div className="sm:hidden skeleton size-10 rounded-full" />
    {/* More */}
    <div
      className={cn(
        "skeleton rounded-full",
        compact ? "size-10" : "size-10 sm:size-11",
      )}
    />
  </div>
));
ActionBarSkeleton.displayName = "ActionBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW SKELETON
// Mirrors TrackList row: [index] [cover] [title+artist] [album lg+] [duration sm+] [more]
// ─────────────────────────────────────────────────────────────────────────────

const TrackRowSkeleton = memo(({ index }: { index: number }) => (
  <div
    className="flex items-center gap-3 px-4 py-2.5"
    style={{ animationDelay: `${stagger(index)}ms` }}
    aria-hidden="true"
  >
    {/* Track number */}
    <div className="skeleton w-5 h-3 rounded-sm shrink-0 opacity-50" />
    {/* Cover */}
    <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
    {/* Title + artist */}
    <div className="flex-1 space-y-2 min-w-0">
      <div
        className="skeleton h-3.5 rounded-full"
        style={{ width: TRACK_TITLE_WIDTHS[index % TRACK_TITLE_WIDTHS.length] }}
      />
      <div
        className="skeleton h-3 rounded-full"
        style={{
          width: TRACK_ARTIST_WIDTHS[index % TRACK_ARTIST_WIDTHS.length],
        }}
      />
    </div>
    {/* Duration — sm+ */}
    <div className="skeleton h-3 w-9 rounded-full hidden sm:block" />
    {/* More */}
    <div className="skeleton size-7 rounded-lg opacity-40" />
  </div>
));
TrackRowSkeleton.displayName = "TrackRowSkeleton";

const TrackListSkeleton = memo(({ count }: { count: number }) => (
  <div
    className="rounded-xl overflow-hidden border border-border/25 bg-background/30"
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
// ALBUM CARD SKELETON
// Mirrors PublicAlbumCard: aspect-square rounded-[18px] cover + text below
// ─────────────────────────────────────────────────────────────────────────────

const AlbumCardSkeleton = memo(({ index }: { index: number }) => (
  <div
    className="flex flex-col gap-2.5"
    style={{ animationDelay: `${stagger(index)}ms` }}
    aria-hidden="true"
  >
    <div className="skeleton aspect-square w-full rounded-[18px]" />
    <div className="space-y-1.5 px-0.5">
      <div
        className="skeleton h-3.5 rounded-full"
        style={{ width: ALBUM_TITLE_WIDTHS[index % ALBUM_TITLE_WIDTHS.length] }}
      />
      <div
        className="skeleton h-3 rounded-full"
        style={{
          width: ALBUM_ARTIST_WIDTHS[index % ALBUM_ARTIST_WIDTHS.length],
        }}
      />
    </div>
  </div>
));
AlbumCardSkeleton.displayName = "AlbumCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY STRIP SKELETON
// Mirrors DraggableImageGallery: horizontal scroll strip of aspect-[16/10] cards.
// Uses no-scrollbar §5 so the shimmer cards don't show a scrollbar.
// ─────────────────────────────────────────────────────────────────────────────

const GalleryStripSkeleton = memo(() => (
  <div
    className="flex gap-4 overflow-x-hidden -mx-4 px-4 sm:-mx-0 sm:px-0 no-scrollbar"
    aria-hidden="true"
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="skeleton shrink-0 rounded-2xl sm:rounded-3xl aspect-[16/10] w-[82vw] sm:w-[360px] md:w-[440px]"
        style={{ animationDelay: `${i * 80}ms` }}
      />
    ))}
  </div>
));
GalleryStripSkeleton.displayName = "GalleryStripSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER SKELETON
// Mirrors SectionHeader: icon-dot + label text + optional action link
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeaderSkeleton = memo(
  ({ withAction = false }: { withAction?: boolean }) => (
    <div
      className="flex items-center justify-between px-0.5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2.5">
        <div className="skeleton size-[18px] rounded-md opacity-60" />
        <div className="skeleton h-6 w-28 rounded-md" />
      </div>
      {withAction && (
        <div className="skeleton h-4 w-16 rounded-full opacity-50" />
      )}
    </div>
  ),
);
SectionHeaderSkeleton.displayName = "SectionHeaderSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// BIO CARD SKELETON (right sidebar)
// Mirrors the bio section card: avatar + badge + bio text + genre chips
// ─────────────────────────────────────────────────────────────────────────────

const BioCardSkeleton = memo(() => (
  <div
    className={cn(
      "rounded-3xl p-6 border border-border/50",
      // glass-frosted §6
      "bg-card/55 backdrop-blur-[28px] saturate-[175%]",
      "shadow-raised",
    )}
    aria-hidden="true"
  >
    {/* Heading row */}
    <div className="flex items-center gap-2.5 mb-5">
      <div className="skeleton size-4 rounded-sm opacity-60" />
      <div className="skeleton h-4 w-16 rounded-full" />
    </div>

    {/* Artist mini-header: avatar + name + badge */}
    <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/40">
      <div className="skeleton size-14 rounded-2xl shrink-0" />
      <div className="space-y-2">
        <div className="skeleton h-4 w-28 rounded-full" />
        <div className="skeleton h-4 w-20 rounded-full" />
      </div>
    </div>

    {/* Bio text block — 8 lines */}
    <div className="space-y-2 border-l-2 border-primary/20 pl-3.5">
      {["90%", "82%", "88%", "75%", "92%", "80%", "70%", "85%"].map((w, i) => (
        <div
          key={i}
          className="skeleton h-3 rounded-full"
          style={{ width: w }}
        />
      ))}
    </div>

    {/* Genre chip strip */}
    <div className="flex flex-wrap gap-1.5 pt-5 mt-5 border-t border-border/40">
      {["w-16", "w-20", "w-14", "w-24", "w-18"].map((w, i) => (
        <div key={i} className={cn("skeleton h-6 rounded-full", w)} />
      ))}
    </div>
  </div>
));
BioCardSkeleton.displayName = "BioCardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL LINKS SKELETON (right sidebar)
// Mirrors 2-col grid of SocialLink pills
// ─────────────────────────────────────────────────────────────────────────────

const SocialLinksSkeleton = memo(() => (
  <div className="space-y-3" aria-hidden="true">
    {/* Section label */}
    <div className="flex items-center gap-2 px-1">
      <div className="skeleton w-4 h-0.5 rounded-full opacity-50" />
      <div className="skeleton h-3 w-24 rounded-full" />
    </div>
    {/* 2×2 grid of social pill skeletons */}
    <div className="grid grid-cols-2 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton h-11 rounded-2xl"
          style={{ animationDelay: `${i * 55}ms` }}
        />
      ))}
    </div>
  </div>
));
SocialLinksSkeleton.displayName = "SocialLinksSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON (page variant)
// Mirrors the immersive hero section:
//   min-h-[460px] sm:min-h-[520px] md:min-h-[620px]
//   Avatar circle + verified badge + name + stats pills + genre chips
// ─────────────────────────────────────────────────────────────────────────────

const HeroSkeleton = memo(() => (
  <div
    className={cn(
      "relative w-full flex flex-col justify-end overflow-hidden shrink-0",
      "min-h-[460px] sm:min-h-[520px] md:min-h-[620px]",
    )}
    aria-hidden="true"
  >
    {/* Background tint — primary gradient matching hero */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `linear-gradient(160deg,
          hsl(var(--primary)/0.28) 0%,
          hsl(var(--primary)/0.08) 55%,
          transparent 100%)`,
      }}
    />
    {/* Bottom fade */}
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent pointer-events-none" />

    {/* Back nav */}
    <div className="absolute top-5 left-4 sm:left-6 lg:left-8 z-20">
      <div className="inline-flex items-center gap-1.5 text-muted-foreground/30">
        <ChevronLeft className="size-4" />
        <div className="skeleton h-3.5 w-14 rounded-full" />
      </div>
    </div>

    {/* Hero content */}
    <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 mt-20">
      <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 text-center md:text-left">
        {/* Avatar — circle with glow blob */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-primary/15 blur-[40px] rounded-full scale-125 opacity-30 pointer-events-none" />
          <div
            className={cn(
              "relative skeleton rounded-full",
              "border-[5px] sm:border-[7px] border-background",
              "shadow-2xl",
              "size-[160px] sm:size-[210px] md:size-[260px]",
            )}
          />
        </div>

        {/* Name + meta column */}
        <div className="flex flex-col items-center md:items-start gap-3 sm:gap-4 flex-1 min-w-0 pb-1">
          {/* Verified badge pill */}
          <div className="skeleton h-6 w-32 rounded-full" />

          {/* Artist name — large, 2 lines max */}
          <div className="w-full space-y-2.5">
            <div className="skeleton h-12 sm:h-16 md:h-20 w-[75%] rounded-xl" />
            <div className="skeleton h-12 sm:h-16 md:h-20 w-[50%] rounded-xl" />
          </div>

          {/* Stats pills row */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 mt-1.5">
            <div className="skeleton h-8 w-48 rounded-2xl" />
            <div className="skeleton h-8 w-24 rounded-2xl" />
          </div>

          {/* Genre chip strip */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-0.5">
            {["w-16", "w-20", "w-14", "w-18", "w-12"].map((w, i) => (
              <div key={i} className={cn("skeleton h-6 rounded-full", w)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
));
HeroSkeleton.displayName = "HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// STICKY ACTION BAR SKELETON (page variant)
// Mirrors the sticky toolbar under the hero
// ─────────────────────────────────────────────────────────────────────────────

const StickyBarSkeleton = memo(() => (
  <div
    className="bg-background/25 border-b border-border/20"
    aria-hidden="true"
  >
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      <ActionBarSkeleton />
      {/* Mini avatar chip (right) */}
      <div className="hidden sm:flex items-center gap-2.5 opacity-35">
        <div className="skeleton h-4 w-28 rounded-full" />
        <div className="skeleton size-9 sm:size-10 rounded-full" />
      </div>
    </div>
  </div>
));
StickyBarSkeleton.displayName = "StickyBarSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// LEFT COLUMN SKELETON (page variant)
// Mirrors: Top Tracks section + Photo Gallery + Discography
// ─────────────────────────────────────────────────────────────────────────────

const LeftColumnSkeleton = memo(() => (
  <div className="lg:col-span-8 space-y-16" aria-hidden="true">
    {/* Top Tracks */}
    <section>
      <SectionHeaderSkeleton />
      <div className="mt-6">
        <TrackListSkeleton count={TRACK_ROWS_PAGE} />
      </div>
    </section>

    {/* Photo Gallery */}
    <section>
      <SectionHeaderSkeleton />
      <div className="mt-5">
        <GalleryStripSkeleton />
      </div>
    </section>

    {/* Discography */}
    <section>
      <SectionHeaderSkeleton withAction />
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9">
        {Array.from({ length: ALBUM_COLS_PAGE }, (_, i) => (
          <AlbumCardSkeleton key={i} index={i} />
        ))}
      </div>
    </section>
  </div>
));
LeftColumnSkeleton.displayName = "LeftColumnSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT COLUMN SKELETON (page variant)
// Mirrors: Bio card + Social links (sticky aside)
// ─────────────────────────────────────────────────────────────────────────────

const RightColumnSkeleton = memo(() => (
  <aside className="lg:col-span-4" aria-hidden="true">
    <div className="sticky top-[calc(var(--navbar-height,64px)+4.5rem)] space-y-8">
      <BioCardSkeleton />
      <SocialLinksSkeleton />
    </div>
  </aside>
));
RightColumnSkeleton.displayName = "RightColumnSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE VARIANT SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const PageVariantSkeleton = memo(() => (
  <main
    className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32"
    role="status"
    aria-busy="true"
    aria-label="Loading artist"
  >
    {/* Hero section */}
    <HeroSkeleton />

    {/* Sticky action bar */}
    <StickyBarSkeleton />

    {/* Main body — 12-col grid */}
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-10 md:mt-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14 xl:gap-20">
        <LeftColumnSkeleton />
        <RightColumnSkeleton />
      </div>
    </div>

    <span className="sr-only">Loading artist profile, please wait…</span>
  </main>
));
PageVariantSkeleton.displayName = "PageVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED VARIANT SKELETON
// Mirrors embedded variant:
//   sticky gradient 180px | close nav | compact header (size-20 avatar) |
//   action bar (compact) | top tracks (5 rows) | album grid (2-col 4 cards) |
//   bio snippet card
// ─────────────────────────────────────────────────────────────────────────────

const EmbeddedVariantSkeleton = memo(() => (
  <div
    className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
    role="status"
    aria-busy="true"
    aria-label="Loading artist"
  >
    {/* Sticky gradient header */}
    <div
      aria-hidden="true"
      className="sticky top-0 h-[180px] shrink-0 pointer-events-none z-0"
      style={{
        background: `linear-gradient(180deg, hsl(var(--primary)/0.24) 0%, transparent 100%)`,
      }}
    />

    <div className="relative z-10 -mt-[180px] px-4 pb-10">
      {/* Close nav */}
      <div className="flex items-center pt-4 pb-3" aria-hidden="true">
        <div className="inline-flex items-center gap-1.5 text-muted-foreground/30">
          <ChevronLeft className="size-4" />
          <div className="skeleton h-3.5 w-10 rounded-full" />
        </div>
      </div>

      {/* Compact header: avatar-2xl + name + listeners */}
      <div className="flex items-end gap-4 pt-4 pb-5" aria-hidden="true">
        {/* Avatar — size-20 rounded-2xl */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-primary/12 blur-2xl rounded-full scale-125 opacity-20 pointer-events-none" />
          <div className="relative skeleton size-20 rounded-2xl border-2 border-background shadow-xl" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pb-1 space-y-2">
          {/* Verified chip */}
          <div className="skeleton h-4 w-20 rounded-full" />
          {/* Artist name */}
          <div className="skeleton h-7 w-[70%] rounded-md" />
          {/* Monthly listeners */}
          <div className="skeleton h-3 w-[55%] rounded-full" />
        </div>
      </div>

      {/* Action bar — compact */}
      <ActionBarSkeleton compact />

      {/* Top tracks section */}
      <div className="mt-7 space-y-3">
        <div className="flex items-center gap-2" aria-hidden="true">
          <div className="skeleton size-3.5 rounded-sm opacity-60" />
          <div className="skeleton h-4 w-20 rounded-full" />
        </div>
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

      {/* Album grid — 2-col, 4 cards */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center gap-2" aria-hidden="true">
          <div className="skeleton size-3.5 rounded-sm opacity-60" />
          <div className="skeleton h-4 w-18 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: ALBUM_COLS_EMBEDDED }, (_, i) => (
            <AlbumCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>

      {/* Bio snippet card */}
      <div
        className="mt-7 p-4 rounded-2xl bg-card/50 border border-border/30"
        aria-hidden="true"
      >
        {/* Label */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="skeleton size-3.5 rounded-sm opacity-60" />
          <div className="skeleton h-3 w-12 rounded-full" />
        </div>
        {/* Bio lines */}
        <div className="space-y-2">
          {["90%", "82%", "70%", "60%"].map((w, i) => (
            <div
              key={i}
              className="skeleton h-3 rounded-full"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>
    </div>

    <span className="sr-only">Loading artist profile, please wait…</span>
  </div>
));
EmbeddedVariantSkeleton.displayName = "EmbeddedVariantSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST DETAIL SKELETON — MAIN EXPORT
//
// Drop-in replacement:
//   if (isLoading) return <ArtistDetailSkeleton variant={variant} />;
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistDetailSkeletonProps {
  variant?: "page" | "embedded";
}

const ArtistDetailSkeleton: React.FC<ArtistDetailSkeletonProps> = memo(
  ({ variant = "page" }) =>
    variant === "embedded" ? (
      <EmbeddedVariantSkeleton />
    ) : (
      <PageVariantSkeleton />
    ),
);

ArtistDetailSkeleton.displayName = "ArtistDetailSkeleton";
export default ArtistDetailSkeleton;
