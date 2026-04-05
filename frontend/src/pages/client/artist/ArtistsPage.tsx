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
import {
  type Artist,
  Artistpageskeleton,
  useSyncInteractions,
} from "@/features";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";

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
// PAGE HERO — eyebrow + gradient title + divider-glow + stat badges
// Mirrors FeaturedAlbums header pattern exactly.
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow */}
    <div
      className="flex items-center gap-2 mb-3 animate-fade-up animation-fill-both"
      style={{ animationDelay: "40ms" }}
    >
      <div
        className="flex items-center justify-center size-6 rounded-md"
        style={{
          background: "hsl(var(--brand-glow) / 0.12)",
          color: "hsl(var(--brand-glow))",
        }}
      >
        <Mic2 className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Artists
      </span>
    </div>

    {/* Title */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="artist-page-heading"
    >
      Nghệ Sĩ Nổi Bật
    </h1>
    {/* Subtitle */}
    <p
      className="text-section-subtitle hidden sm:block mb-5 animate-fade-up animation-fill-both"
      style={{ animationDelay: "90ms" }}
    >
      Khám phá toàn bộ nghệ sĩ trong hệ sinh thái âm nhạc.
    </p>
    {/* Animated brand divider */}
    <div
      className="divider-glow animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
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
        "rounded-2xl",
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
  if (isLoading && artists.length === 0) {
    return <Artistpageskeleton cardCount={meta.pageSize} />;
  }
  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />
      {/* ══ HERO HEADER ══ */}
      <PageHero />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="artist-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <ArtistFilters params={filterParams} {...stableFilterHandlers} />
          </div>
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
