import React, { useMemo, memo, useCallback } from "react";

import { History } from "lucide-react";

import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";

import { ITrack, TrackList } from "@/features";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";
import { useSmartBack } from "@/hooks/useSmartBack";
import { AnimatePresence } from "framer-motion";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useFavouriteTracksInfinite } from "@/features/profile/hooks/useProfileQuery";

/** Module-scoped grid constant — zero allocation per render */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

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
        <History className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        History
      </span>
    </div>
    {/* Title */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="album-page-heading"
    >
      Lịch sử Nghe nhạc
    </h1>
    {/* Subtitle */}
    <p
      className={cn(
        "text-section-subtitle hidden sm:block mb-5",
        "animate-fade-up animation-fill-both",
      )}
      style={{ animationDelay: "90ms" }}
    >
      Lịch sử nghe nhạc của bạn.
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
// PAGINATION STRIP — glass-frosted panel, single wrapper (v3.2 had double)
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
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <div
    className="flex flex-col gap-1"
    role="status"
    aria-label="Đang tải bảng xếp hạng"
    aria-busy="true"
  >
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        style={{ animationDelay: `${i * 50}ms` }}
        aria-hidden="true"
      >
        {/* Rank column — w-[52px] matches ChartItem */}
        <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
          <div className="skeleton w-5 h-3 rounded-full" />
          <div className="skeleton w-6 h-2.5 rounded-full" />
        </div>
        {/* Cover art — matches ChartItem size-[44px] sm:size-[48px] */}
        <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
        {/* Track info */}
        <div className="flex-1 space-y-2 min-w-0">
          <div
            className="skeleton h-3.5 rounded-full"
            style={{ width: `${40 + (i % 3) * 12}%` }}
          />
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: `${24 + (i % 4) * 8}%` }}
          />
        </div>
        {/* Duration — hidden on mobile */}
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
        {/* Play count — hidden on mobile/tablet */}
        <div className="skeleton w-14 h-3 rounded-full hidden md:block" />
      </div>
    ))}
  </div>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TrackHistoryPage: React.FC = () => {
  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    isError,
    refetch: refetchTracks,
  } = useFavouriteTracksInfinite();

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );
  const totalItems = useMemo(
    () => tracksData?.totalItems ?? 0,
    [tracksData?.totalItems],
  );
  const TrackIds = useMemo(() => allTracks.map((t) => t._id), [allTracks]);
  /** Read prefers-reduced-motion once at orchestrator level, pass down */

  const syncEnabled = useMemo(() => !isLoadingTracks, [isLoadingTracks]);

  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", syncEnabled);

  /** Stable retry — prevents ErrorState from re-rendering on unrelated state */
  const handleRetry = useCallback(() => refetchTracks?.(), [refetchTracks]);
  const trackListProps = useMemo(
    () => ({
      allTrackIds: TrackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetchTracks,
    }),
    [
      TrackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetchTracks,
    ],
  );
  const hasResults = allTracks.length > 0;
  const onBack = useSmartBack();
  const isOffline = !navigator.onLine;

  // Deep Error
  if (isError && !hasResults) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={handleRetry} />
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
          onRetry={handleRetry}
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
        {/* ── Album grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách album"
          aria-busy={isLoadingTracks}
        >
          {" "}
          <div className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              <TrackList
                {...trackListProps}
                maxHeight="auto" // page tự scroll, không giới hạn height
                moodColor={`var(--wave-2)`}
                skeletonCount={12} // nhiều hơn để fill viewport lúc đầu
                staggerAnimation={true}
              />
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
};

export default memo(TrackHistoryPage);
