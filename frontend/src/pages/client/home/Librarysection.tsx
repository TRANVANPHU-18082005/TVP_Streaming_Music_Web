import { memo, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, DiscAlbum, ListMusic, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useFavouriteTracksInfinite,
  useUserLibrary,
} from "@/features/profile/hooks/useProfileQuery";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";

import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import MusicResult from "../../../components/ui/Result";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { APP_CONFIG } from "@/config/constants";
import { IAlbum } from "@/features/album";
import { IPlaylist } from "@/features/playlist";
import { ITrack, TrackList } from "@/features/track";
import { useTabSwipe } from "@/hooks/Usetabswipe";
import { QueueSourceType } from "@/features/player/slice/playerSlice";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type LibraryTab = "tracks" | "albums" | "playlists";

interface TabConfig {
  id: LibraryTab;
  label: string;
  icon: React.ReactNode;
  wave: string;
  viewAllHref: string;
  viewAllLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const TABS: TabConfig[] = [
  {
    id: "tracks",
    label: "Bài hát",
    icon: <AudioLines className="size-3.5" aria-hidden="true" />,
    wave: "--wave-3",
    viewAllHref: "/profile?tab=library&sub=liked_tracks",
    viewAllLabel: "Xem tất cả bài hát",
  },
  {
    id: "albums",
    label: "Albums",
    icon: <DiscAlbum className="size-3.5" aria-hidden="true" />,
    wave: "--wave-4",
    viewAllHref: "/profile?tab=library&sub=liked_albums",
    viewAllLabel: "Xem tất cả albums",
  },
  {
    id: "playlists",
    label: "Playlists",
    icon: <ListMusic className="size-3.5" aria-hidden="true" />,
    wave: "--wave-5",
    viewAllHref: "/profile?tab=library&sub=liked_playlists",
    viewAllLabel: "Xem tất cả playlists",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS (direction-aware)
// ─────────────────────────────────────────────────────────────────────────────

const makeTabVariants = (direction: number) => ({
  initial: {
    opacity: 0,
    x: direction * 44,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
  exit: {
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.18, ease: EASE_EXPO },
  },
});

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: EASE_EXPO },
  },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } },
};

const mobileCardVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.065, duration: 0.38, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// CHIP TAB BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const ChipTab = memo(
  ({
    tab,
    isActive,
    hasData,
    onClick,
  }: {
    tab: TabConfig;
    isActive: boolean;
    hasData: boolean;
    onClick: () => void;
  }) => {
    const waveColor = `hsl(var(${tab.wave}))`;
    if (!hasData) return null;
    return (
      <button
        role="tab"
        aria-selected={isActive}
        aria-controls={`library-panel-${tab.id}`}
        id={`library-tab-${tab.id}`}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full",
          "text-sm font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "select-none",
          isActive
            ? "text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        style={
          isActive ? { background: waveColor } : { background: "transparent" }
        }
      >
        {isActive && (
          <motion.span
            layoutId="chip-active"
            className="absolute inset-0 rounded-full"
            style={{ background: waveColor }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}

        <span className="relative z-[1] flex items-center gap-1.5">
          {tab.icon}
          {tab.label}
        </span>

        {!isActive && hasData && (
          <span
            className="relative z-[1] size-1.5 rounded-full shrink-0"
            style={{ background: waveColor, opacity: 0.7 }}
          />
        )}
      </button>
    );
  },
);
ChipTab.displayName = "ChipTab";

// ─────────────────────────────────────────────────────────────────────────────
// SWIPE DOTS (mobile indicator)
// ─────────────────────────────────────────────────────────────────────────────

const SwipeDots = memo(
  ({
    tabs,
    activeTab,
    hasDataMap,
    onDotClick,
  }: {
    tabs: TabConfig[];
    activeTab: LibraryTab;
    hasDataMap: Record<LibraryTab, boolean>;
    onDotClick: (tab: LibraryTab) => void;
  }) => {
    const visibleTabs = tabs.filter((t) => hasDataMap[t.id]);
    if (visibleTabs.length < 2) return null;

    return (
      <div
        className="flex items-center justify-center gap-2 mt-5 sm:hidden"
        role="presentation"
        aria-hidden="true"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onDotClick(tab.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              tabIndex={-1}
            >
              <motion.span
                className="block rounded-full"
                animate={{
                  width: isActive ? 20 : 6,
                  height: 6,
                  opacity: isActive ? 1 : 0.35,
                  background: `hsl(var(${tab.wave}))`,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            </button>
          );
        })}
      </div>
    );
  },
);
SwipeDots.displayName = "SwipeDots";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

const LibraryHeader = memo(
  ({
    activeTab,
    tabs,
    hasTracks,
    hasAlbums,
    hasPlaylists,
    onTabChange,
  }: {
    activeTab: LibraryTab;
    tabs: TabConfig[];
    hasTracks: boolean;
    hasAlbums: boolean;
    hasPlaylists: boolean;
    onTabChange: (tab: LibraryTab) => void;
  }) => {
    const activeConfig = tabs.find((t) => t.id === activeTab)!;
    const hasDataMap: Record<LibraryTab, boolean> = {
      tracks: hasTracks,
      albums: hasAlbums,
      playlists: hasPlaylists,
    };

    return (
      <div className="flex flex-col gap-4 mb-7 sm:mb-8">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center size-6 rounded-md transition-colors duration-300"
                style={{
                  background: `hsl(var(${activeConfig.wave}) / 0.12)`,
                  color: `hsl(var(${activeConfig.wave}))`,
                }}
              >
                {activeConfig.icon}
              </div>
              <motion.span
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-overline transition-colors duration-300"
                style={{ color: `hsl(var(${activeConfig.wave}))` }}
              >
                Thư viện
              </motion.span>
            </div>

            <h2
              className="text-section-title text-foreground leading-tight"
              id="library-section-heading"
            >
              Yêu thích{" "}
              <motion.span
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_EXPO }}
                className="inline-block transition-colors duration-300"
                style={{ color: `hsl(var(${activeConfig.wave}))` }}
              >
                {activeConfig.label}
              </motion.span>
            </h2>
          </div>

          <Link
            to={activeConfig.viewAllHref}
            aria-label={activeConfig.viewAllLabel}
            className={cn(
              "group flex items-center gap-1.5 shrink-0 mt-1",
              "text-sm font-medium opacity-70 transition-all duration-200",
              "hover:opacity-100",
            )}
            style={{ color: `hsl(var(${activeConfig.wave}))` }}
          >
            <span>Xem tất cả</span>
            <ChevronRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* Chip tabs */}
        <div
          role="tablist"
          aria-label="Loại nội dung trong thư viện"
          className={cn(
            "flex items-center gap-1.5 p-1 rounded-full w-fit",
            "bg-muted/50 border border-border/50",
          )}
        >
          {tabs.map((tab) => (
            <ChipTab
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              hasData={hasDataMap[tab.id]}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>
      </div>
    );
  },
);
LibraryHeader.displayName = "LibraryHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const TrackSkeleton = memo(() => (
  <div className="flex flex-col gap-1" role="status" aria-busy="true">
    {Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        aria-hidden="true"
      >
        <div className="skeleton w-[52px] shrink-0 h-8 rounded-full" />
        <div className="skeleton w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-lg" />
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
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
      </div>
    ))}
  </div>
));
TrackSkeleton.displayName = "TrackSkeleton";

const GridSkeleton = memo(() => (
  <>
    <div className="flex gap-4 overflow-hidden lg:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[168px] sm:w-[200px] shrink-0 space-y-2.5">
          <div
            className="skeleton skeleton-cover"
            style={{ borderRadius: "1rem" }}
          />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
    <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2.5">
          <div
            className="skeleton skeleton-cover"
            style={{ borderRadius: "1rem" }}
          />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
  </>
));
GridSkeleton.displayName = "GridSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const AlbumContent = memo(({ albums }: { albums: IAlbum[] }) => (
  <div className="relative">
    <div className="lg:hidden scroll-overflow-mask -mx-4 px-4" role="list">
      <HorizontalScroll>
        {albums.map((album, i) => (
          <motion.div
            key={album._id}
            custom={i}
            variants={mobileCardVariants}
            initial="hidden"
            animate="visible"
            role="listitem"
            className={cn(
              "snap-start shrink-0 w-[168px] sm:w-[200px] first:pl-0 last:pr-4",
            )}
          >
            <PublicAlbumCard album={album} />
          </motion.div>
        ))}
      </HorizontalScroll>
    </div>
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-48px" }}
      className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
      role="list"
    >
      {albums.map((album) => (
        <motion.div key={album._id} variants={cardVariants} role="listitem">
          <PublicAlbumCard album={album} />
        </motion.div>
      ))}
    </motion.div>
  </div>
));
AlbumContent.displayName = "AlbumContent";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistContent = memo(({ playlists }: { playlists: IPlaylist[] }) => (
  <div className="relative">
    <div className="lg:hidden scroll-overflow-mask -mx-4 px-4" role="list">
      <HorizontalScroll>
        {playlists.map((pl, i) => (
          <motion.div
            key={pl._id}
            custom={i}
            variants={mobileCardVariants}
            initial="hidden"
            animate="visible"
            role="listitem"
            className={cn(
              "snap-start shrink-0 w-[168px] sm:w-[200px] first:pl-0 last:pr-4",
            )}
          >
            <PublicPlaylistCard playlist={pl} />
          </motion.div>
        ))}
      </HorizontalScroll>
    </div>
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-48px" }}
      className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
      role="list"
    >
      {playlists.map((pl) => (
        <motion.div key={pl._id} variants={cardVariants} role="listitem">
          <PublicPlaylistCard playlist={pl} />
        </motion.div>
      ))}
    </motion.div>
  </div>
));
PlaylistContent.displayName = "PlaylistContent";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function LibrarySection() {
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
  const TrackIds = useMemo(() => allTracks.map((t) => t._id), [allTracks]);

  const trackListProps = useMemo(
    () => ({
      allTrackIds: TrackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage: false,
      hasNextPage: false,
      onFetchNextPage: () => {},
      onRetry: refetchTracks,
      source: {
        id: "library_favourite_tracks",
        type: "likedTracks" as QueueSourceType,
        title: "Yêu thích",
      },
    }),
    [
      TrackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      refetchTracks,
    ],
  );

  // ── Tab state ────────────────────────────────────────────────────────────

  const initialTab = useMemo<LibraryTab>(() => {
    if (totalItems) return "tracks";
    if (albums.length) return "albums";
    if (playlists.length) return "playlists";
    return "tracks";
  }, [totalItems, albums.length, playlists.length]);

  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);

  // Direction: 1 = forward (left swipe → next tab), -1 = backward (right swipe → prev tab)
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  // Auto-switch away from empty tabs when data loads
  const resolvedTab = useMemo<LibraryTab>(() => {
    if (
      activeTab === "tracks" &&
      !totalItems &&
      (albums.length || playlists.length)
    )
      return albums.length ? "albums" : "playlists";
    if (
      activeTab === "albums" &&
      !albums.length &&
      (totalItems || playlists.length)
    )
      return totalItems ? "tracks" : "playlists";
    if (
      activeTab === "playlists" &&
      !playlists.length &&
      (totalItems || albums.length)
    )
      return totalItems ? "tracks" : "albums";
    return activeTab;
  }, [activeTab, totalItems, albums.length, playlists.length]);

  const isOffline = !useOnlineStatus();
  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;

  // ── Visible tabs list (tabs that have data) ──────────────────────────────
  const hasDataMap = useMemo<Record<LibraryTab, boolean>>(
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

  // ── Edge detection for rubber-band ──────────────────────────────────────
  const currentIndex = visibleTabs.findIndex((t) => t.id === resolvedTab);
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= visibleTabs.length - 1;

  // ── Navigate with direction tracking ────────────────────────────────────

  const navigateToTab = useCallback(
    (tab: LibraryTab, direction?: 1 | -1) => {
      if (tab === resolvedTab) return;

      const currentIdx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = visibleTabs.findIndex((t) => t.id === tab);

      const dir = direction ?? (nextIdx > currentIdx ? 1 : -1);
      setSwipeDirection(dir);
      setActiveTab(tab);
    },
    [resolvedTab, visibleTabs],
  );

  // ── Swipe handler ────────────────────────────────────────────────────────

  const handleSwipe = useCallback(
    (direction: 1 | -1) => {
      const idx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= visibleTabs.length) return;
      const nextTab = visibleTabs[nextIdx].id;
      setSwipeDirection(direction);
      setActiveTab(nextTab);
    },
    [resolvedTab, visibleTabs],
  );

  const { containerRef, dragX, onTouchStart, onTouchEnd } = useTabSwipe({
    onSwipe: handleSwipe,
    enabled: !isOffline,
    atStart,
    atEnd,
  });

  // ── Nothing to show ──────────────────────────────────────────────────────
  if (
    !isLoading &&
    !isLoadingTracks &&
    !error &&
    !totalItems &&
    !albums.length &&
    !playlists.length
  ) {
    return null;
  }

  // ── Tab content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    if (isLoading || isLoadingTracks) {
      return resolvedTab === "tracks" ? <TrackSkeleton /> : <GridSkeleton />;
    }

    if (isOffline) {
      return (
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error-network" onRetry={refetch} />
        </div>
      );
    }

    if (resolvedTab === "tracks") {
      if (tracksError && allTracks.length <= 0)
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetchTracks} />
          </div>
        );
      return (
        <TrackList
          {...trackListProps}
          maxHeight={400}
          moodColor={`var(${activeTabConfig.wave})`}
          skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
          staggerAnimation={true}
        />
      );
    }

    if (resolvedTab === "albums") {
      if (error && albums.length <= 0)
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetch} />
          </div>
        );
      return albums.length === 0 ? (
        <MusicResult
          variant="empty-albums"
          description="Album hiện đang trống"
        />
      ) : (
        <AlbumContent albums={albums} />
      );
    }

    if (resolvedTab === "playlists") {
      if (error && playlists.length <= 0)
        return (
          <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
            <MusicResult variant="error" onRetry={refetch} />
          </div>
        );
      return playlists.length === 0 ? (
        <MusicResult
          variant="empty-playlists"
          description="Playlists hiện đang trống"
        />
      ) : (
        <PlaylistContent playlists={playlists} />
      );
    }
  };

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
            activeTab={resolvedTab}
            tabs={TABS}
            hasTracks={totalItems > 0}
            hasAlbums={albums.length > 0}
            hasPlaylists={playlists.length > 0}
            onTabChange={(tab) => navigateToTab(tab)}
          />

          {/*
           * Swipe container — ref passed to the hook so we can attach a
           * non-passive touchmove listener that can call preventDefault().
           * React's synthetic onTouchStart / onTouchEnd handle the rest.
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
                // dragX drives live finger-follow; tab variants handle enter/exit
                style={{ x: dragX }}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile swipe dots indicator */}
          <SwipeDots
            tabs={TABS}
            activeTab={resolvedTab}
            hasDataMap={hasDataMap}
            onDotClick={(tab) => navigateToTab(tab)}
          />
        </div>
      </section>
    </>
  );
}

export default LibrarySection;
