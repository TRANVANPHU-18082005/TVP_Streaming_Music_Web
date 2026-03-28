"use client";

/**
 * @file ArtistPage.tsx — Artist catalog page (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v3.2 — aligned with FeaturedAlbums + AlbumPage v4.0:
 *
 * ── PageHero extracted as memo:
 *    Eyebrow badge (Users icon + text-overline text-primary) + gradient title
 *    + divider-glow + StatBadge chips (total artists + trending label)
 *    Matches FeaturedAlbums header pattern exactly.
 *
 * ── AmbientBackground: `position: fixed` (not absolute) — prevents layout
 *    void / broken layout on short pages (not-logged-in state). Two orbs:
 *    brand-500 violet top-left + wave-3 cyan top-right, aurora bands.
 *
 * ── ArtistFilters: no longer double-wrapped in glass-frosted from the page.
 *    v4.0 ArtistFilters.tsx manages its own card/glass styling internally,
 *    matching AlbumFilter v4.0 pattern.
 *
 * ── PaginationStrip extracted as memo — eliminates the double glass-frosted
 *    anti-pattern from v3.2 (two identical frosted wrappers nested).
 *
 * ── EmptyArtists extracted as memo — context-aware message based on
 *    whether keyword filter is active.
 *
 * ── GRID_LAYOUT module-scoped constant preserved (zero alloc per render).
 *
 * ── staggerDelay cap preserved at 700ms.
 *
 * ALL v3.2 LOGIC PRESERVED:
 * ─ useSyncInteractions unconditional call with enabled guard
 * ─ stableFilterHandlers via useMemo
 * ─ Error state renders AmbientBackground
 * ─ artists/meta granular useMemo deps
 */

import React, { memo, useMemo } from "react";
import { Users, TrendingUp } from "lucide-react";
import { Mic2 } from "lucide-react";

import Pagination from "@/utils/pagination";
import MusicResult from "@/components/ui/Result";
import CardSkeleton from "@/components/ui/CardSkeleton";
import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import { ArtistFilters } from "@/features/artist/components/ArtistFilters";
import { useArtistParams } from "@/features/artist/hooks/useArtistParams";
import { useArtistsQuery } from "@/features/artist/hooks/useArtistsQuery";
import { APP_CONFIG } from "@/config/constants";
import { type Artist, useSyncInteractions } from "@/features";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Stagger delay — linear ramp capped at 700ms (prevents 16th+ card jank) */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

/** Module-scoped — zero allocation per render */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
);

const DEFAULT_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: APP_CONFIG.PAGINATION_LIMIT,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND — isolated memo, position: fixed prevents layout void
// on short pages (not-logged-in states). GPU-composited via .orb-float tokens.
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = memo(() => (
  <div
    className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-background" />

    {/* Brand-500 violet — top-left primary orb */}
    <div
      className="absolute rounded-full orb-float orb-float--brand orb-float--lg"
      style={{ width: 640, height: 640, top: -200, left: -140, opacity: 0.32 }}
    />

    {/* Wave-3 cyan — top-right secondary orb */}
    <div
      className="absolute rounded-full orb-float orb-float--cyan orb-float--slow orb-float--lg"
      style={{
        width: 520,
        height: 520,
        top: "10%",
        right: -120,
        opacity: 0.22,
      }}
    />

    {/* Wave-2 pink — bottom-center accent */}
    <div
      className="absolute rounded-full orb-float orb-float--wave orb-float--fast"
      style={{
        width: 360,
        height: 360,
        bottom: "14%",
        left: "40%",
        filter: "blur(72px)",
        opacity: 0.16,
      }}
    />

    {/* Aurora bands */}
    <div className="aurora-band aurora-band--1" />
    <div className="aurora-band aurora-band--2" />

    {/* Grain texture */}
    <div
      className="absolute inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />

    {/* Hero gradient tint */}
    <div
      className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--wave-3)/0.05) 0%, hsl(var(--primary)/0.04) 45%, transparent 100%)",
      }}
    />

    {/* Player bar clearance */}
    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
  </div>
));
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BADGE — mini info chip, matches AlbumPage v4.0
// ─────────────────────────────────────────────────────────────────────────────
const StatBadge = memo(
  ({
    icon: Icon,
    label,
    className,
  }: {
    icon: React.ElementType;
    label: string;
    className?: string;
  }) => (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full",
        "border border-border/60 bg-card/50 backdrop-blur-sm shadow-raised",
        "text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3 text-primary/60" aria-hidden="true" />
      {label}
    </div>
  ),
);
StatBadge.displayName = "StatBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — eyebrow + gradient title + divider-glow + stat badges
// Mirrors FeaturedAlbums header pattern exactly.
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(
  ({ totalItems, isLoading }: { totalItems: number; isLoading: boolean }) => (
    <header className="section-container pt-12 pb-8 sm:pt-14 sm:pb-10">
      {/* Eyebrow */}
      <div
        className="flex items-center gap-2 mb-3 animate-fade-up animation-fill-both"
        style={{ animationDelay: "40ms" }}
      >
        <div
          className={cn(
            "flex items-center justify-center size-7 rounded-lg",
            "bg-primary/10 text-primary shadow-glow-xs",
          )}
        >
          <Mic2 className="size-4" aria-hidden="true" />
        </div>
        <span className="text-overline text-primary">Artists</span>
      </div>

      {/* Title */}
      <h1
        className="text-display-xl text-gradient-aurora mb-2 animate-fade-up animation-fill-both"
        style={{ animationDelay: "60ms" }}
        id="artist-page-heading"
      >
        Nghệ Sĩ Nổi Bật
      </h1>

      {/* Subtitle */}
      <p
        className="text-section-subtitle mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "90ms" }}
      >
        Khám phá toàn bộ nghệ sĩ trong hệ sinh thái âm nhạc.
      </p>

      {/* Animated brand divider */}
      <div
        className="divider-glow mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "100ms", maxWidth: "32rem" }}
      />

      {/* Stat badges — only when data loaded */}
      {!isLoading && totalItems > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 animate-fade-up animation-fill-both"
          style={{ animationDelay: "130ms" }}
        >
          <StatBadge icon={Users} label={`${totalItems} Nghệ sĩ`} />
          <StatBadge icon={TrendingUp} label="Cập nhật liên tục" />
        </div>
      )}
    </header>
  ),
);
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY ARTISTS — context-aware, matches AlbumPage v4.0 pattern
// ─────────────────────────────────────────────────────────────────────────────
const EmptyArtists = memo(
  ({ isFiltering, keyword }: { isFiltering: boolean; keyword?: string }) => (
    <div
      className={cn(
        "card-base border-dashed shadow-none",
        "flex items-center justify-center min-h-[380px]",
        "animate-fade-in",
      )}
    >
      <MusicResult
        status="empty"
        title={isFiltering ? "Không tìm thấy kết quả" : "Chưa có nghệ sĩ nào"}
        description={
          isFiltering && keyword
            ? `Không có nghệ sĩ nào phù hợp với "${keyword}". Hãy thử từ khoá khác.`
            : "Hệ thống chưa tìm thấy nghệ sĩ nào thoả mãn điều kiện này."
        }
        icon={<Users className="size-10 text-muted-foreground/30" />}
      />
    </div>
  ),
);
EmptyArtists.displayName = "EmptyArtists";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION STRIP — single glass-frosted wrapper (no double-wrap anti-pattern)
// ─────────────────────────────────────────────────────────────────────────────
const PaginationStrip = memo(
  ({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  }) => (
    <div
      className={cn(
        "glass-frosted rounded-2xl",
        "border border-border/50 dark:border-primary/15",
        "shadow-brand p-4",
        "animate-fade-up animation-fill-both",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={totalItems}
        itemsPerPage={pageSize || APP_CONFIG.PAGINATION_LIMIT}
      />
    </div>
  ),
);
PaginationStrip.displayName = "PaginationStrip";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ArtistPage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useArtistParams(APP_CONFIG.PAGINATION_LIMIT);

  const { data, isLoading, isError } = useArtistsQuery(filterParams);

  // Granular derived slices — avoids full object diff
  const artists = useMemo(() => data?.artists ?? [], [data?.artists]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );

  // Must run unconditionally — enabled guard prevents execution when empty
  const artistIds = useMemo(() => artists.map((a: Artist) => a._id), [artists]);
  useSyncInteractions(
    artistIds,
    "follow",
    "artist",
    !isLoading && artistIds.length > 0,
  );

  /** Stable handler object — prevents ArtistFilters re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const hasResults = artists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 pb-28">
        <AmbientBackground />
        <div className="card-base shadow-elevated p-8 max-w-md w-full text-center animate-scale-in">
          <MusicResult
            status="error"
            title="Không thể tải danh sách Nghệ sĩ"
            description="Máy chủ gặp sự cố. Vui lòng kiểm tra kết nối và thử lại."
            secondaryAction={{
              label: "Tải lại",
              onClick: () => window.location.reload(),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-28">
      <AmbientBackground />

      {/* ══ HERO HEADER ══ */}
      <PageHero totalItems={meta.totalItems} isLoading={isLoading} />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="artist-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: "80ms" }}
        >
          <ArtistFilters params={filterParams} {...stableFilterHandlers} />
        </div>

        {/* ── Artist grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách nghệ sĩ"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className={GRID_LAYOUT}>
              <CardSkeleton
                count={meta.pageSize}
                className="skeleton-avatar aspect-square"
              />
            </div>
          ) : !hasResults ? (
            <EmptyArtists
              isFiltering={isFiltering}
              keyword={filterParams.keyword}
            />
          ) : (
            <div className={GRID_LAYOUT}>
              {artists.map((artist, index) => (
                <div
                  key={artist._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <PublicArtistCard artist={artist} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Pagination */}
        {!isLoading && hasResults && (
          <PaginationStrip
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.totalItems}
            pageSize={meta.pageSize}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
};

export default memo(ArtistPage);
