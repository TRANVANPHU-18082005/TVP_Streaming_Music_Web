import React, { memo, useMemo } from "react";
import { Mic2 } from "lucide-react";

import { PaginationStrip } from "@/utils/pagination";
import MusicResult from "@/components/ui/Result";
import CardSkeleton from "@/components/ui/CardSkeleton";
import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import { ArtistFilters } from "@/features/artist/components/ArtistFilters";
import { useArtistParams } from "@/features/artist/hooks/useArtistParams";
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
import {
  Artistpageskeleton,
  IArtist,
  useArtistsByUserQuery,
} from "@/features/artist";
import { useSyncInteractions } from "@/features/interaction";

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
        Artist
      </span>
    </div>

    {/* Title */}
    <h1
      className="text-display-xl text-primary mb-2 animate-fade-up animation-fill-both"
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
// ARTIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ArtistPage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useArtistParams();

  const { data, isLoading, isError, refetch } =
    useArtistsByUserQuery(filterParams);

  // Granular derived slices — avoids full object diff
  const artists = useMemo(() => data?.artists ?? [], [data?.artists]);
  const meta = useMemo(
    () => ({ ...DEFAULT_GRID_META, ...data?.meta }),
    [data?.meta],
  );
  // Must run unconditionally — enabled guard prevents execution when empty
  const artistIds = useMemo(
    () => artists.map((a: IArtist) => a._id),
    [artists],
  );
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
  const onBack = useSmartBack();
  const hasResults = artists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);
  const isOffline = !useOnlineStatus();

  if (isLoading && !hasResults) {
    return <Artistpageskeleton />;
  }

  if (isLoading && hasResults) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <WaveformLoader glass={false} text="Đang tải" />
      </div>
    );
  }



  if (isError || !hasResults) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
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
                count={meta.pageSize || DEFAULT_GRID_META.pageSize}
              />
            </div>
          ) : !hasResults ? (
            !isLoading && !isFiltering ? (
              <MusicResult
                variant="empty-artists"
                description="Danh sách nghệ sĩ hiện đang trống"
              />
            ) : (
              <MusicResult
                variant="empty-artists"
                description="Không có kết quả! Thử bộ lọc khác "
                onClearFilters={clearFilters}
                onBack={onBack}
              />
            )
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

export default memo(ArtistPage);
