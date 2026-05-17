import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  useFavouriteTracksInfinite,
  useUserLibrary,
} from "@/features/profile/hooks/useProfileQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTabSwipe } from "@/hooks/Usetabswipe";
import { APP_CONFIG } from "@/config/constants";
import { ITrack, TrackSkeleton } from "@/features/track";

import SectionAmbient from "../../../components/SectionAmbient";
import MusicResult from "../../../components/ui/Result";
import {
  LibraryHeader,
  LibraryTab,
  makeTabVariants,
  TabConfig,
} from "@/features/library";
import { AudioLines, DiscAlbum, ListMusic } from "lucide-react";
import { SwipeDots } from "@/features/library/components/LibraryHeader";
import { AlbumSkeleton } from "@/features/album";
const PlaylistTab = lazy(
  () => import("@/features/library/components/PlaylistTab"),
);
const AlbumTab = lazy(() => import("@/features/library/components/AlbumTab"));
const TrackTab = lazy(() => import("@/features/library/components/TrackTab"));

const TABS: TabConfig[] = [
  {
    id: "tracks",
    label: "Bài hát",
    shortLabel: "",
    icon: <AudioLines className="size-3.5" aria-hidden="true" />,
    wave: "--wave-3",
    viewAllHref: "/profile?tab=library&sub=liked_tracks",
    viewAllLabel: "Xem tất cả bài hát",
  },
  {
    id: "albums",
    label: "Albums",
    shortLabel: "",
    icon: <DiscAlbum className="size-3.5" aria-hidden="true" />,
    wave: "--wave-4",
    viewAllHref: "/profile?tab=library&sub=liked_albums",
    viewAllLabel: "Xem tất cả albums",
  },
  {
    id: "playlists",
    label: "Playlists",
    shortLabel: "",
    icon: <ListMusic className="size-3.5" aria-hidden="true" />,
    wave: "--wave-5",
    viewAllHref: "/profile?tab=library&sub=liked_playlists",
    viewAllLabel: "Xem tất cả playlists",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Pick the first tab that has data. */
function resolveInitialTab(
  totalTracks: number,
  albumCount: number,
  playlistCount: number,
): LibraryTab {
  if (totalTracks) return "tracks";
  if (albumCount) return "albums";
  if (playlistCount) return "playlists";
  return "tracks";
}

/** If the active tab is empty, fall back to the next available tab. */
function resolveActiveTab(
  activeTab: LibraryTab,
  totalTracks: number,
  albumCount: number,
  playlistCount: number,
): LibraryTab {
  if (activeTab === "tracks" && !totalTracks && (albumCount || playlistCount))
    return albumCount ? "albums" : "playlists";
  if (activeTab === "albums" && !albumCount && (totalTracks || playlistCount))
    return totalTracks ? "tracks" : "playlists";
  if (
    activeTab === "playlists" &&
    !playlistCount &&
    (totalTracks || albumCount)
  )
    return totalTracks ? "tracks" : "albums";
  return activeTab;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
//fix bug
export function LibrarySection() {
  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: library, isLoading, error, refetch } = useUserLibrary();
  const albums = useMemo(() => library?.albums ?? [], [library]);
  const playlists = useMemo(() => library?.playlists ?? [], [library]);

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    error: tracksError,
    refetch: refetchTracks,
  } = useFavouriteTracksInfinite(APP_CONFIG.PAGINATION_LIMIT);

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );
  const totalItems = useMemo(
    () => tracksData?.totalItems ?? 0,
    [tracksData?.totalItems],
  );
  // ── Derived flags ─────────────────────────────────────────────────────────

  const hasDataMap = useMemo(
    () => ({
      tracks: totalItems > 0,
      albums: albums.length > 0,
      playlists: playlists.length > 0,
    }),
    [totalItems, albums.length, playlists.length],
  );

  const visibleTabs = useMemo(
    () => TABS.filter((t) => hasDataMap[t.id]),
    [hasDataMap],
  );

  // ── Tab state ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<LibraryTab>(() =>
    resolveInitialTab(totalItems, albums.length, playlists.length),
  );
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  const resolvedTab = useMemo(
    () =>
      resolveActiveTab(activeTab, totalItems, albums.length, playlists.length),
    [activeTab, totalItems, albums.length, playlists.length],
  );

  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;
  const currentIndex = visibleTabs.findIndex((t) => t.id === resolvedTab);
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= visibleTabs.length - 1;

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateToTab = useCallback(
    (tab: LibraryTab, direction?: 1 | -1) => {
      if (tab === resolvedTab) return;
      const currentIdx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = visibleTabs.findIndex((t) => t.id === tab);
      setSwipeDirection(direction ?? (nextIdx > currentIdx ? 1 : -1));
      setActiveTab(tab);
    },
    [resolvedTab, visibleTabs],
  );

  const handleSwipe = useCallback(
    (direction: 1 | -1) => {
      const idx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= visibleTabs.length) return;
      setSwipeDirection(direction);
      setActiveTab(visibleTabs[nextIdx].id);
    },
    [resolvedTab, visibleTabs],
  );

  const isOffline = !useOnlineStatus();

  const { containerRef, dragX, onTouchStart, onTouchEnd } = useTabSwipe({
    onSwipe: handleSwipe,
    enabled: !isOffline,
    atStart,
    atEnd,
  });

  // ── Early exit: nothing to show ───────────────────────────────────────────

  const isEmpty =
    !isLoading &&
    !isLoadingTracks &&
    !error &&
    !totalItems &&
    !albums.length &&
    !playlists.length;

  if (isEmpty) return null;

  // ── Tab content renderer ──────────────────────────────────────────────────

  const renderTabContent = () => {
    // Loading
    if (isLoading || isLoadingTracks) {
      return resolvedTab === "tracks" ? <TrackSkeleton /> : <AlbumSkeleton />;
    }

    // Offline
    if (isOffline) {
      return (
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error-network" onRetry={refetch} />
        </div>
      );
    }

    // Tracks
    if (resolvedTab === "tracks") {
      if (tracksError && allTracks.length === 0) {
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetchTracks} />
          </div>
        );
      }
      return (
        <Suspense fallback={<TrackSkeleton />}>
          <TrackTab
            allTracks={allTracks}
            totalItems={totalItems}
            isLoading={isLoadingTracks}
            error={tracksError as Error | null}
            onRetry={refetchTracks}
            moodColor={`var(${activeTabConfig.wave})`}
          />
        </Suspense>
      );
    }

    // Albums
    if (resolvedTab === "albums") {
      if (error && albums.length === 0) {
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetch} />
          </div>
        );
      }
      return albums.length === 0 ? (
        <MusicResult
          variant="empty-albums"
          description="Album hiện đang trống"
        />
      ) : (
        <Suspense fallback={<AlbumSkeleton />}>
          <AlbumTab albums={albums} />
        </Suspense>
      );
    }

    // Playlists
    if (resolvedTab === "playlists") {
      if (error && playlists.length === 0) {
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetch} />
          </div>
        );
      }
      return playlists.length === 0 ? (
        <MusicResult
          variant="empty-playlists"
          description="Playlists hiện đang trống"
        />
      ) : (
        <Suspense fallback={<AlbumSkeleton />}>
          <PlaylistTab playlists={playlists} />
        </Suspense>
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const tabVariants = makeTabVariants(swipeDirection);

  return (
    <>
      {/* Wave-tinted section divider */}
      <div
        className="block h-px transition-all duration-500"
        style={{
          background: `linear-gradient(
            to right,
            transparent,
            hsl(var(${activeTabConfig.wave}) / 0.3) 30%,
            hsl(var(${activeTabConfig.wave}) / 0.28) 70%,
            transparent
          )`,
          boxShadow: `0 0 8px hsl(var(${activeTabConfig.wave}) / 0.1)`,
        }}
      />

      <section
        className="section-block section-block--alt relative overflow-hidden transition-colors duration-300"
        aria-labelledby="library-section-heading"
      >
        <SectionAmbient
          key={resolvedTab}
          style={
            resolvedTab === "tracks"
              ? "wave-3"
              : resolvedTab === "albums"
                ? "wave-4"
                : "wave-5"
          }
        />

        <div className="section-container relative z-[1]">
          <LibraryHeader
            tabs={TABS}
            activeTab={resolvedTab}
            hasTracks={hasDataMap.tracks}
            hasAlbums={hasDataMap.albums}
            hasPlaylists={hasDataMap.playlists}
            onTabChange={navigateToTab}
          />

          {/*
           * Swipe container — ref lets the hook attach a non-passive
           * touchmove listener that can call preventDefault().
           */}
          <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={resolvedTab}
                role="tabpanel"
                id={`library-panel-${resolvedTab}`}
                aria-labelledby={`library-tab-${resolvedTab}`}
                style={{ x: dragX }}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile swipe dots */}
          <SwipeDots
            activeTab={resolvedTab}
            tabs={TABS}
            hasDataMap={hasDataMap}
            onDotClick={navigateToTab}
          />
        </div>
      </section>
    </>
  );
}

export default LibrarySection;
