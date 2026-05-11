import React, { useMemo, memo } from "react";

import { Disc3 } from "lucide-react";

import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import MusicResult from "@/components/ui/Result";
import AlbumFilter from "@/features/album/components/AlbumFilter";
import { useAlbumParams } from "@/features/album/hooks/useAlbumParams";

import {
  DEFAULT_GRID_META,
  GRID_LAYOUT,
  staggerDelay,
} from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";

import { useSmartBack } from "@/hooks/useSmartBack";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Albumpageskeleton, useAlbumsByUserQuery } from "@/features/album";
import { useSyncInteractions } from "@/features/interaction";
import PaginationStrip from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — section header matching FeaturedAlbums pattern
// Eyebrow + gradient title + divider-glow + stat badges
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow — matches FeaturedAlbums */}
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
        <Disc3 className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Collection
      </span>
    </div>
    {/* Title */}
    <h1
      className="text-display-xl text-primary mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="album-page-heading"
    >
      Tuyển tập Đĩa nhạc
    </h1>
    {/* Subtitle */}
    <p
      className={cn(
        "text-section-subtitle hidden sm:block mb-5",
        "animate-fade-up animation-fill-both",
      )}
      style={{ animationDelay: "90ms" }}
    >
      Khám phá toàn bộ thư viện âm nhạc được biên tập chọn lọc.
    </p>

    {/* Animated brand divider — .divider-glow token */}
    <div
      className="divider-glow animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM GRID WRAPPER — memo'd, stable identity across data transitions
// ─────────────────────────────────────────────────────────────────────────────
const AlbumGrid = memo(({ children }: { children: React.ReactNode }) => (
  <div className={GRID_LAYOUT}>{children}</div>
));
AlbumGrid.displayName = "AlbumGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM PAGE
// ─────────────────────────────────────────────────────────────────────────────
const AlbumPage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useAlbumParams();

  const { data, isLoading, isError, refetch } =
    useAlbumsByUserQuery(filterParams);
  console.log("AlbumPage data:", data); // Debug log to check fetched data
  const albums = useMemo(() => data?.albums ?? [], [data?.albums]);
  const meta = useMemo(
    () => ({ ...DEFAULT_GRID_META, ...data?.meta }),
    [data?.meta],
  );
  const albumIds = useMemo(() => albums?.map((a) => a._id) ?? [], [albums]);

  useSyncInteractions(albumIds, "like", "album", albumIds.length > 0);
  /**
   * Play handler — no throw, no artificial delay (v3.2 fixes preserved).
   * useCallback prevents new function reference breaking PublicAlbumCard memo.
   */

  /** Stable handler object — prevents AlbumFilter re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );
  const hasResults = albums.length > 0;
  const onBack = useSmartBack();
  const isFiltering = Boolean(filterParams.keyword);
  const isOffline = !useOnlineStatus();

  if (isLoading && !hasResults) {
    return (
      <Albumpageskeleton
        cardCount={meta.pageSize || DEFAULT_GRID_META.pageSize}
      />
    );
  }

  if (isLoading && hasResults) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <WaveformLoader glass={false} text="Đang tải" />
      </div>
    );
  }

  if (isError && !hasResults) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
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
        aria-labelledby="album-page-heading"
      >
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          {/* ── Filter bar — matches FeaturedAlbums glass-frosted pattern */}
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <AlbumFilter params={filterParams} {...stableFilterHandlers} />
          </div>
        </div>

        {/* ── Album grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách album"
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
                variant="empty-albums"
                description="Danh sách album hiện đang trống"
              />
            ) : (
              <MusicResult
                variant="empty-albums"
                description="Không có kết quả! Thử bộ lọc khác "
                onClearFilters={clearFilters}
                onBack={onBack}
              />
            )
          ) : (
            <AlbumGrid>
              {albums.map((album, index) => (
                <div
                  key={album._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <PublicAlbumCard album={album} />
                </div>
              ))}
            </AlbumGrid>
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

export default memo(AlbumPage);
