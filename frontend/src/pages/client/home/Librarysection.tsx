import { memo, useState, useMemo } from "react";
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

import { IAlbum, IPlaylist, ITrack, TrackList } from "@/features";
import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import MusicResult from "../../../components/ui/Result";

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
    label: "Tracks",
    icon: <AudioLines className="size-3.5" aria-hidden="true" />,
    wave: "--wave-3",
    viewAllHref: "/chart-top",
    viewAllLabel: "Xem tất cả tracks",
  },
  {
    id: "albums",
    label: "Albums",
    icon: <DiscAlbum className="size-3.5" aria-hidden="true" />,
    wave: "--wave-4",
    viewAllHref: "/albums",
    viewAllLabel: "Xem tất cả albums",
  },
  {
    id: "playlists",
    label: "Playlists",
    icon: <ListMusic className="size-3.5" aria-hidden="true" />,
    wave: "--wave-5",
    viewAllHref: "/playlists",
    viewAllLabel: "Xem tất cả playlists",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: EASE_EXPO },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: EASE_EXPO } },
};

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
        {/* Active indicator background */}
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

        {/* Unread dot — visible only when inactive and has data */}
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
        {/* Top row: title + view-all */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            {/* Eyebrow — single, not repeated per type */}
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
                My Library
              </motion.span>
            </div>

            <h2
              className="text-section-title text-foreground leading-tight"
              id="library-section-heading"
            >
              Favourite{" "}
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

          {/* View all — updates per active tab */}
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
    {/* Mobile */}
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
    {/* Desktop */}
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
    {/* Mobile */}
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
    {/* Desktop */}
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
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = useFavouriteTracksInfinite();
  console.log(tracksData);
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
  // Determine initial tab: first one that has data
  const initialTab = useMemo<LibraryTab>(() => {
    if (totalItems) return "tracks";
    if (albums.length) return "albums";
    if (playlists.length) return "playlists";
    return "tracks";
  }, [totalItems, albums.length, playlists.length]);

  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);

  // Auto-switch away from an empty tab when data arrives
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

  // ── Nothing to show ───────────────────────────────────────────────────────
  if (
    !isLoading &&
    !error &&
    !totalItems &&
    !albums.length &&
    !playlists.length
  ) {
    return null;
  }
  const isOffline = !navigator.onLine;
  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;

  // ── Render tab content ────────────────────────────────────────────────────
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
    // ✅ ĐOẠN CODE ĐÚNG:
    if (resolvedTab === "tracks") {
      if (tracksError && allTracks.length <= 0)
        return (
          <>
            <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
              <MusicResult variant="error" onRetry={refetch} />
            </div>
          </>
        );
      return (
        <TrackList
          {...trackListProps}
          maxHeight={400}
          moodColor={`var(${activeTabConfig.wave})`}
          skeletonCount={12}
          staggerAnimation={true}
        />
      );
    }

    if (resolvedTab === "albums") {
      if (error && albums.length <= 0)
        return (
          <>
            <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
              <MusicResult variant="error" onRetry={refetch} />
            </div>
          </>
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
          <>
            <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
              <MusicResult variant="error" onRetry={refetch} />
            </div>
          </>
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
        {/* Ambient — key forces remount on tab change so orb color updates */}
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
            onTabChange={setActiveTab}
          />

          {/* Tab panels */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={resolvedTab}
              role="tabpanel"
              id={`library-panel-${resolvedTab}`}
              aria-labelledby={`library-tab-${resolvedTab}`}
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}

export default LibrarySection;
