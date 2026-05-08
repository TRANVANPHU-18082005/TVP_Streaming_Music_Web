import React, { memo, useMemo } from "react";

import { GenreCard } from "@/features/genre/components/GenreCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { DEFAULT_GRID_META } from "@/config/constants";
import { cn } from "@/lib/utils";
import { Genrepageskeleton, useGenresByUserQuery } from "@/features";
import SectionAmbient from "@/components/SectionAmbient";

import { useSmartBack } from "@/hooks/useSmartBack";
import { KeyboardMusic } from "lucide-react";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — eyebrow (Tag) + gradient wave title + divider + stat badges
// Genre identity: Tag eyebrow icon + text-gradient-wave (cyan sweep)
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
        <KeyboardMusic className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Genres
      </span>
    </div>

    {/* Title — text-gradient-wave: cyan → pink → purple sweep */}
    <h1
      className="text-display-xl text-primary mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="genre-page-heading"
    >
      Thể loại & Tâm trạng
    </h1>

    {/* Animated divider — .divider-glow token */}
    <div
      className="divider-glow  animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
PageHero.displayName = "PageHero";

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
        " rounded-2xl",
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
        itemsPerPage={pageSize || DEFAULT_GRID_META.pageSize}
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
  } = useGenreParams();
  console.log("GenrePage - filterParams:", filterParams);
  const { data, isLoading, isError, refetch } =
    useGenresByUserQuery(filterParams);
  console.log("GenrePage - data:", data);
  // Granular derived slices — avoids full object diff
  const genres = useMemo(() => data?.genres ?? [], [data?.genres]);
  const meta = useMemo(
    () => ({ ...DEFAULT_GRID_META, ...data?.meta }),
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
  const onBack = useSmartBack();
  const hasResults = genres.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  const isOffline = !useOnlineStatus();
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return (
      <Genrepageskeleton
        cardCount={meta.pageSize || DEFAULT_GRID_META.pageSize}
      />
    );
  }
  // Switching
  if (isLoading && hasResults) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (isError && !hasResults) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
  // Offline
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />

      {/* ══ HERO HEADER ══ */}
      <PageHero />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="genre-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand ",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <GenreFilters params={filterParams} {...stableFilterHandlers} />
          </div>
        </div>

        {/* ── Genre grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách thể loại"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className={GRID_LAYOUT}>
              <CardSkeleton
                count={meta.pageSize || DEFAULT_GRID_META.pageSize}
              />
            </div>
          ) : !hasResults ? (
            !isLoading && !isFiltering ? (
              <MusicResult
                variant="empty-genres"
                description="Genre hiện đang trống"
              />
            ) : (
              <MusicResult
                variant="empty-genres"
                description="Không có kết quả! Thử bộ lọc khác "
                onClearFilters={clearFilters}
                onBack={onBack}
              />
            )
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
            currentPage={meta.page || DEFAULT_GRID_META.page}
            totalPages={meta.totalPages || DEFAULT_GRID_META.totalPages}
            totalItems={meta.totalItems || DEFAULT_GRID_META.totalItems}
            pageSize={meta.pageSize || DEFAULT_GRID_META.pageSize}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
};

export default memo(GenrePage);
