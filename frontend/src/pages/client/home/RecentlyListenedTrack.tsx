import { memo, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, BellElectric } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import { useRecentlyPlayedInfinite } from "@/features/profile/hooks/useProfileQuery";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { CLIENT_PATHS } from "@/config/paths";
import MusicResult from "../../../components/ui/Result";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { APP_CONFIG } from "@/config/constants";
import { ITrack, TrackList } from "@/features/track";
import { QueueSourceType } from "@/features/player/slice/playerSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TOP_N = 10;
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const slideUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: EASE_EXPO },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// Mirrors FeaturedPlaylists PlaylistsHeader exactly:
// eyebrow icon (wave-1 tint) + overline + h2 + subtitle + view-all link
// ─────────────────────────────────────────────────────────────────────────────

const ChartHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      {/* Eyebrow — wave-1 (brand violet) tint */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--brand-glow) / 0.12)",
            color: "hsl(var(--brand-glow))",
          }}
        >
          <BellElectric className="size-3.5" aria-hidden="true" />
        </div>
        <span
          className="text-overline"
          style={{ color: "hsl(var(--brand-glow))" }}
        >
          Lịch sử
        </span>
      </div>

      <h2
        className="text-section-title text-foreground leading-tight"
        id="top-featured-tracks-heading"
      >
        Nghe gần đây
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Track đã nghe gần đây của bạn, được cập nhật liên tục dựa trên hoạt động
        nghe nhạc của bạn.
      </p>
    </div>

    {/* View all */}
    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-brand opacity-70",
        "hover:text-brand transition-colors duration-200 hover:opacity-100",
      )}
      aria-label="Xem tất cả bảng xếp hạng"
    >
      <span>Xem tất cả</span>
      <ChevronRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  </div>
));
ChartHeader.displayName = "ChartHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — pixel-matched to ChartItem layout, mirrors FeaturedPlaylists
// skeleton pattern (mobile strip + desktop grid equivalent)
// ─────────────────────────────────────────────────────────────────────────────

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
// SECTION AMBIENT DECORATION
// Matches FeaturedPlaylists orb palette — wave-1 (brand violet) primary
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TOP FEATURED TRACKS — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export const RecentlyListenedTrack = () => {
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
  // ── Loading ────────────────────────────────────────────────────────────────
  const isOffline = !useOnlineStatus();
  const hasResults = allTracks.length > 0;

  if (isLoadingTracks && !hasResults) {
    return (
      <section
        className="section-block section-block--alt"
        aria-labelledby="top-featured-tracks-heading"
        aria-busy="true"
      >
        <div className="section-container">
          {/* Wave-1 tinted divider — mirrors FeaturedPlaylists */}
          <div
            className="hidden lg:block h-px mb-8"
            style={{
              background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--wave-2) / 0.3) 30%,
                hsl(var(--wave-2) / 0.3) 70%,
                transparent
              )`,
              boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
            }}
          />
          <ChartHeader viewAllHref="/charts" />
          <SkeletonGrid count={TOP_N} />
        </div>
      </section>
    );
  }
  // Switching
  if (isLoadingTracks && hasResults) {
    return <VinylLoader />;
  }
  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError && !hasResults) {
    return (
      <section
        className="section-block section-block--alt"
        aria-labelledby="top-featured-tracks-heading"
      >
        <div className="section-container">
          <div
            className="hidden lg:block h-px mb-8"
            style={{
              background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--wave-2) / 0.3) 30%,
                hsl(var(--wave-2) / 0.3) 70%,
                transparent
              )`,
              boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
            }}
          />
          <ChartHeader viewAllHref="/charts" />
          <AnimatePresence mode="wait">
            <motion.div key="error" {...slideUpVariants}>
              <MusicResult variant="error" onRetry={handleRetry} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    );
  }

  // ── Populated / Empty ──────────────────────────────────────────────────────
  if (!isLoadingTracks && (!allTracks || totalItems === 0)) return null;
  // return (
  //   <section
  //     className="section-block section-block--alt"
  //     aria-labelledby="top-featured-tracks-heading"
  //   >
  //     <div className="section-container">
  //       <div
  //         className="hidden lg:block h-px mb-8"
  //         style={{
  //           background: `linear-gradient(
  //             to right,
  //             transparent,
  //             hsl(var(--wave-2) / 0.3) 30%,
  //             hsl(var(--wave-2) / 0.3) 70%,
  //             transparent
  //           )`,
  //           boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
  //         }}
  //       />
  //       <ChartHeader viewAllHref="/charts" />
  //       <AnimatePresence mode="wait">
  //         <motion.div key="error" {...slideUpVariants}>
  //           <MusicResult
  //             variant="empty-tracks"
  //             description="Lịch sử nghe nhạc hiện đang trống"
  //           />
  //         </motion.div>
  //       </AnimatePresence>
  //     </div>
  //   </section>
  // );
  // Offline
  if (isOffline) {
    return (
      <section
        className="section-block section-block--alt"
        aria-labelledby="top-featured-tracks-heading"
      >
        <div className="section-container">
          <div
            className="hidden lg:block h-px mb-8"
            style={{
              background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--wave-2) / 0.3) 30%,
                hsl(var(--wave-2) / 0.3) 70%,
                transparent
              )`,
              boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
            }}
          />
          <ChartHeader viewAllHref="/charts" />
          <AnimatePresence mode="wait">
            <motion.div key="error" {...slideUpVariants}>
              <MusicResult variant="error-network" onRetry={refetchTracks} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    );
  }
  // Don't render section at all if no data (can happen on new accounts)
  return (
    <>
      <div
        className="block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-2) / 0.3) 30%,
              hsl(var(--wave-2) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--alt relative overflow-hidden transition-colors duration-300"
        aria-labelledby="top-featured-tracks-heading"
      >
        {/* Ambient orbs — decorative depth layer */}
        <SectionAmbient style="wave-2" />

        <div className="section-container relative z-[1]">
          {/* Section header — same anatomy as PlaylistsHeader */}
          <ChartHeader viewAllHref={CLIENT_PATHS.TRACK_HISTORY} />

          {/* Track list + live-update overlay */}
          <div className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              <TrackList
                {...trackListProps}
                maxHeight={400} // page tự scroll, không giới hạn height
                moodColor={`var(--wave-2)`}
                skeletonCount={APP_CONFIG.PAGINATION_LIMIT} // nhiều hơn để fill viewport lúc đầu
                staggerAnimation={true}
              />
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
};

export default RecentlyListenedTrack;
