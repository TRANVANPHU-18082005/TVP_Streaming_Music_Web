import React, { useMemo, memo, useCallback, lazy, Suspense } from "react";

import { History } from "lucide-react";

import MusicResult from "@/components/ui/Result";

import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";
import { useSmartBack } from "@/hooks/useSmartBack";
import { AnimatePresence } from "framer-motion";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useRecentlyPlayedInfinite } from "@/features/profile/hooks/useProfileQuery";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { ITrack } from "@/features/track";
import { QueueSourceType } from "@/features/player";

const TrackListModule = import("@/features/track/components/TrackList");
const TrackListLazy = lazy(() =>
  TrackListModule.then((m) => ({ default: m.TrackList })),
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
      className="text-display-xl text-primary mb-2 animate-fade-up animation-fill-both"
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
  } = useRecentlyPlayedInfinite();

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
      source: {
        id: "recently-played",
        type: "recentlyPlayed" as QueueSourceType,
        title: "Nghe gần đây",
        url: `/tracks/history`,
      },
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
              <Suspense fallback={<WaveformLoader />}>
                <TrackListLazy
                  {...trackListProps}
                  maxHeight="auto"
                  moodColor={`var(--wave-2)`}
                  skeletonCount={APP_CONFIG.PAGINATION_LIMIT} // nhiều hơn để fill viewport lúc đầu
                  staggerAnimation={true}
                />
              </Suspense>
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
};

export default memo(TrackHistoryPage);
