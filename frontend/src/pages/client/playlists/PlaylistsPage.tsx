import React, { useMemo, memo } from "react";
import { ListMusic } from "lucide-react";

import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import PlaylistFilter from "@/features/playlist/components/PlaylistFilter";
import { usePlaylistParams } from "@/features/playlist/hooks/usePlaylistParams";
import { usePlaylistsQuery } from "@/features/playlist/hooks/usePlaylistsQuery";

import { Playlistpageskeleton, useSyncInteractions } from "@/features";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";
import { useSmartBack } from "@/hooks/useSmartBack";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: 24,
} as const;

/** 45ms/item, capped at 700ms */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — eyebrow (ListMusic) + gradient-warm title + divider + stats
// Playlist identity: ListMusic eyebrow + text-gradient-warm (gold → pink)
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
        <ListMusic className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Playlists
      </span>
    </div>

    {/* Title — text-gradient-warm: gold → pink = playlist identity */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="playlist-page-heading"
    >
      Danh sách phát
    </h1>
    {/* Subtitle */}
    <p
      className="text-section-subtitle hidden sm:block mb-5 animate-fade-up animation-fill-both"
      style={{ animationDelay: "90ms" }}
    >
      Khám phá các playlist được tuyển chọn từ cộng đồng và hệ thống.
    </p>

    {/* Animated divider */}
    <div
      className="divider-glow animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST GRID — memo'd wrapper, stable across data transitions
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistGrid = memo(({ children }: { children: React.ReactNode }) => (
  <div className={GRID_LAYOUT}>{children}</div>
));
PlaylistGrid.displayName = "PlaylistGrid";

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
// PLAYLIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistPage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = usePlaylistParams(24);

  const { data, isLoading, isError, refetch } = usePlaylistsQuery(filterParams);

  const playlists = useMemo(() => data?.playlists ?? [], [data?.playlists]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );
  const playlistIds = useMemo(
    () => playlists?.map((p) => p._id) ?? [],
    [playlists],
  );

  useSyncInteractions(playlistIds, "like", "playlist", playlistIds.length > 0);
  /**
   * Play handler — no throw, no artificial delay (v4.0-prev fixes preserved).
   * useCallback prevents new ref breaking PublicPlaylistCard memo.
   */

  /** Stable handler object — prevents PlaylistFilter re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const skeletonCount = meta.pageSize || APP_CONFIG.PAGINATION_LIMIT;
  const hasResults = playlists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  const onBack = useSmartBack();
  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return <Playlistpageskeleton cardCount={meta.pageSize || 18} />;
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
        aria-labelledby="playlist-page-heading"
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
            <PlaylistFilter params={filterParams} {...stableFilterHandlers} />
          </div>
        </div>

        {/* ── Playlist grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Playlist catalog"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <PlaylistGrid>
              <CardSkeleton count={skeletonCount} />
            </PlaylistGrid>
          ) : !hasResults ? (
            !isLoading && !isFiltering ? (
              <MusicResult
                variant="empty-playlists"
                description="Album hiện đang trống"
              />
            ) : (
              <MusicResult
                variant="empty-playlists"
                description="Không có kết quả! Thử bộ lọc khác "
                onClearFilters={clearFilters}
                onBack={onBack}
              />
            )
          ) : (
            <PlaylistGrid>
              {playlists.map((playlist, index) => (
                <div
                  key={playlist._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <PublicPlaylistCard playlist={playlist} />
                </div>
              ))}
            </PlaylistGrid>
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

export default memo(PlaylistPage);
