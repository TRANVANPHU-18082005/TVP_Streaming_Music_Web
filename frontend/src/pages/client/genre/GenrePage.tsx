"use client";

/**
 * @file GenrePage.tsx — Genre catalog page (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v3.2 — full alignment with AlbumPage + ArtistPage v4.0:
 *
 * ── PageHero extracted as memo:
 *    Eyebrow badge (Tag icon + text-overline text-primary) + text-gradient-wave
 *    title + text-section-subtitle description + divider-glow + StatBadge chips.
 *    Genre identity: wave-3 (cyan) — Tag eyebrow icon differentiates from
 *    Disc3 (albums) and Mic2 (artists).
 *
 * ── AmbientBackground: `position: fixed` — prevents layout void on short
 *    pages (not-logged-in state). Wave-3 cyan primary + wave-4 gold secondary
 *    orbs. Same pattern as AlbumPage/ArtistPage v4.0.
 *
 * ── GenreFilters: no external glass-frosted wrapper — v4.0 GenreFilters
 *    manages its own card/glass styling internally.
 *
 * ── PaginationStrip extracted as memo — eliminates v3.2 double glass-frosted
 *    anti-pattern.
 *
 * ── EmptyGenres extracted as memo — context-aware based on keyword filter.
 *
 * ── GRID_LAYOUT + DEFAULT_META module-scoped constants preserved.
 *
 * ── staggerDelay capped at 600ms (genre's 40ms × 15 cap, preserved).
 */

import React, { memo, useMemo } from "react";
import { Library, Tag, TrendingUp } from "lucide-react";

import { GenreCard } from "@/features/genre/components/GenreCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { useGenresQuery } from "@/features/genre/hooks/useGenresQuery";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 40ms/item, capped at 600ms (genre-specific cap) */
const staggerDelay = (i: number) => Math.min(i * 40, 600);

const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
);

const DEFAULT_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: 24,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND — position: fixed prevents layout void on short pages.
// Wave-3 (cyan) primary + wave-4 (gold) secondary = genre page identity.
// GPU-composited via .orb-float CSS token classes; reduced-motion handled
// by index.css @media rule.
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = memo(() => (
  <div
    className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-background" />

    {/* Wave-3 cyan — top-right primary orb */}
    <div
      className="absolute rounded-full orb-float orb-float--cyan orb-float--fast orb-float--lg"
      style={{ width: 640, height: 640, top: -180, right: -130, opacity: 0.28 }}
    />

    {/* Wave-4 gold — top-left secondary orb */}
    <div
      className="absolute rounded-full orb-float orb-float--gold orb-float--slow orb-float--lg"
      style={{ width: 520, height: 520, top: "8%", left: -150, opacity: 0.22 }}
    />

    {/* Brand-500 violet — bottom accent */}
    <div
      className="absolute rounded-full orb-float orb-float--brand orb-float--fast"
      style={{
        width: 320,
        height: 320,
        bottom: "16%",
        left: "42%",
        filter: "blur(72px)",
        opacity: 0.14,
      }}
    />

    {/* Aurora bands */}
    <div className="aurora-band aurora-band--1" style={{ opacity: 0.09 }} />
    <div className="aurora-band aurora-band--2" style={{ opacity: 0.06 }} />

    {/* Grain texture */}
    <div
      className="absolute inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />

    {/* Hero tint — wave-3 cyan identity */}
    <div
      className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--wave-3)/0.055) 0%, hsl(var(--wave-4)/0.025) 45%, transparent 100%)",
      }}
    />

    {/* Player bar clearance */}
    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
  </div>
));
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BADGE — matches AlbumPage + ArtistPage v4.0 pattern
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
// PAGE HERO — eyebrow (Tag) + gradient wave title + divider + stat badges
// Genre identity: Tag eyebrow icon + text-gradient-wave (cyan sweep)
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
          <Tag className="size-4" aria-hidden="true" />
        </div>
        <span className="text-overline text-primary">Genres</span>
      </div>

      {/* Title — text-gradient-wave: cyan → pink → purple sweep */}
      <h1
        className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
        style={{ animationDelay: "60ms" }}
        id="genre-page-heading"
      >
        Thể loại & Tâm trạng
      </h1>

      {/* Subtitle */}
      <p
        className="text-section-subtitle mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "90ms" }}
      >
        Khám phá thế giới âm nhạc qua từng thể loại và cảm xúc.
      </p>

      {/* Animated divider — .divider-glow token */}
      <div
        className="divider-glow mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "100ms", maxWidth: "32rem" }}
      />

      {/* Stat badges */}
      {!isLoading && totalItems > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 animate-fade-up animation-fill-both"
          style={{ animationDelay: "130ms" }}
        >
          <StatBadge icon={Library} label={`${totalItems} Thể loại`} />
          <StatBadge icon={TrendingUp} label="Cập nhật liên tục" />
        </div>
      )}
    </header>
  ),
);
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY GENRES — context-aware, matches AlbumPage + ArtistPage v4.0
// ─────────────────────────────────────────────────────────────────────────────
const EmptyGenres = memo(
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
        title={isFiltering ? "Không tìm thấy kết quả" : "Chưa có thể loại nào"}
        description={
          isFiltering && keyword
            ? `Không có thể loại nào phù hợp với "${keyword}". Hãy thử từ khoá khác.`
            : "Hãy thử thay đổi từ khóa tìm kiếm hoặc các tiêu chí lọc."
        }
        icon={<Library className="size-10 text-muted-foreground/30" />}
      />
    </div>
  ),
);
EmptyGenres.displayName = "EmptyGenres";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION STRIP — single glass-frosted wrapper, no double-wrap anti-pattern
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
// GENRE PAGE
// ─────────────────────────────────────────────────────────────────────────────
const GenrePage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useGenreParams(24);

  const { data, isLoading, isError } = useGenresQuery(filterParams);

  // Granular derived slices — avoids full object diff
  const genres = useMemo(() => data?.genres ?? [], [data?.genres]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );

  /** Stable handler object — prevents GenreFilters re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const hasResults = genres.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 pb-28">
        <AmbientBackground />
        <div className="card-base shadow-elevated p-8 max-w-md w-full text-center animate-scale-in">
          <MusicResult
            status="error"
            title="Không thể tải danh sách Thể loại"
            description="Máy chủ gặp sự cố hoặc kết nối không ổn định. Vui lòng thử lại."
            secondaryAction={{
              label: "Tải lại trang",
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
        aria-labelledby="genre-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: "80ms" }}
        >
          <GenreFilters params={filterParams} {...stableFilterHandlers} />
        </div>

        {/* ── Genre grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách thể loại"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className={GRID_LAYOUT}>
              <CardSkeleton count={meta.pageSize} />
            </div>
          ) : !hasResults ? (
            <EmptyGenres
              isFiltering={isFiltering}
              keyword={filterParams.keyword}
            />
          ) : (
            <div className={GRID_LAYOUT}>
              {genres.map((genre, index) => (
                <div
                  key={genre._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <GenreCard genre={genre} />
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

export default memo(GenrePage);
