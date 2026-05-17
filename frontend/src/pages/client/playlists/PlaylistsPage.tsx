import React, { useMemo, memo } from "react";
import { ListMusic } from "lucide-react";

import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import MusicResult from "@/components/ui/Result";
import { PaginationStrip } from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import PlaylistFilter from "@/features/playlist/components/PlaylistFilter";
import { usePlaylistParams } from "@/features/playlist/hooks/usePlaylistParams";

import {
  DEFAULT_GRID_META,
  GRID_LAYOUT,
  staggerDelay,
} from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";
import { useSmartBack } from "@/hooks/useSmartBack";
import {
  Playlistpageskeleton,
  usePlaylistsByUserQuery,
} from "@/features/playlist";
import { useSyncInteractions } from "@/features/interaction";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
      className="text-display-xl text-primary mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="playlist-page-heading"
    >
      Danh sách phát
    </h1>

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
  <div className={cn(GRID_LAYOUT)}>{children}</div>
));
PlaylistGrid.displayName = "PlaylistGrid";

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
  } = usePlaylistParams();

  const { data, isLoading, isError, refetch } =
    usePlaylistsByUserQuery(filterParams);

  const playlists = useMemo(() => data?.playlists ?? [], [data?.playlists]);
  const meta = useMemo(
    () => ({ ...DEFAULT_GRID_META, ...data?.meta }),
    [data?.meta],
  );
  const playlistIds = useMemo(
    () => playlists?.map((p) => p._id) ?? [],
    [playlists],
  );

  useSyncInteractions(playlistIds, "like", "playlist", !isLoading);
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

  const skeletonCount = meta.pageSize || DEFAULT_GRID_META.pageSize;
  const hasResults = playlists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  const onBack = useSmartBack();
  const isOffline = !useOnlineStatus();
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return (
      <Playlistpageskeleton
        cardCount={meta.pageSize || DEFAULT_GRID_META.pageSize}
      />
    );
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
              <CardSkeleton count={skeletonCount} className="animate-pulse" />
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

export default memo(PlaylistPage);
