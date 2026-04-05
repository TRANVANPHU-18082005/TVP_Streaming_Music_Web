import { memo, useState, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  DiscAlbum,
  ListMusic,
  ChevronRight,
  Music2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { useUserLibrary } from "@/features/profile/hooks/useProfileQuery";
import { Album, Playlist, TrackList } from "@/features";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import albumApi from "@/features/album/api/albumApi";
import playlistApi from "@/features/playlist/api/playlistApi";
import { albumKeys } from "@/features/album/utils/albumKeys";
import { playlistKeys } from "@/features/playlist/utils/playlistKeys";
import { useAppDispatch } from "@/store/hooks";
import { setIsPlaying, setQueue } from "@/features";
import { cn } from "@/lib/utils";
import SectionAmbient from "./SectionAmbient";

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
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ tab }: { tab: TabConfig }) => {
  const icons: Record<LibraryTab, React.ReactNode> = {
    tracks: <Music2 className="size-5" aria-hidden="true" />,
    albums: <DiscAlbum className="size-5" aria-hidden="true" />,
    playlists: <ListMusic className="size-5" aria-hidden="true" />,
  };
  const messages: Record<LibraryTab, string> = {
    tracks: "Bạn chưa yêu thích bài hát nào.",
    albums: "Bạn chưa yêu thích album nào.",
    playlists: "Bạn chưa yêu thích playlist nào.",
  };

  return (
    <div
      role="status"
      aria-label={messages[tab.id]}
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6",
        "rounded-2xl border border-dashed border-border text-center",
      )}
    >
      <div
        className="flex items-center justify-center size-12 rounded-full"
        style={{
          background: `hsl(var(${tab.wave}) / 0.1)`,
          color: `hsl(var(${tab.wave}))`,
        }}
      >
        {icons[tab.id]}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
        <p className="text-xs text-muted-foreground">{messages[tab.id]}</p>
      </div>
    </div>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────

const ErrorState = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div
    role="alert"
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-16 px-6",
      "rounded-2xl border text-center",
    )}
    style={{
      background: "hsl(var(--error) / 0.05)",
      borderColor: "hsl(var(--error) / 0.18)",
    }}
  >
    <div
      className="flex items-center justify-center size-12 rounded-full"
      style={{
        background: "hsl(var(--error) / 0.1)",
        color: "hsl(var(--error))",
      }}
    >
      <AlertCircle className="size-5" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Đã có lỗi xảy ra</p>
      <p className="text-xs text-muted-foreground">
        Không thể tải thư viện. Vui lòng thử lại.
      </p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="btn-outline btn-sm mt-1 flex items-center gap-1.5"
        aria-label="Thử tải lại"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Thử lại
      </button>
    )}
  </div>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const AlbumContent = memo(
  ({
    albums,
    onPlay,
  }: {
    albums: Album[];
    onPlay: (id: string) => Promise<void>;
  }) => (
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
              <PublicAlbumCard album={album} onPlay={() => onPlay(album._id)} />
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
            <PublicAlbumCard album={album} onPlay={() => onPlay(album._id)} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  ),
);
AlbumContent.displayName = "AlbumContent";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistContent = memo(
  ({
    playlists,
    onPlay,
  }: {
    playlists: Playlist[];
    onPlay: (id: string) => Promise<void>;
  }) => (
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
              <PublicPlaylistCard playlist={pl} onPlay={() => onPlay(pl._id)} />
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
            <PublicPlaylistCard playlist={pl} onPlay={() => onPlay(pl._id)} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  ),
);
PlaylistContent.displayName = "PlaylistContent";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function LibrarySection() {
  const { data: library, isLoading, error, refetch } = useUserLibrary();

  const tracks = useMemo(() => library?.tracks ?? [], [library]);
  const albums = useMemo(() => library?.albums ?? [], [library]);
  const playlists = useMemo(() => library?.playlists ?? [], [library]);
  console.log(library?.albums, library?.playlists, library?.tracks);
  console.log(tracks, albums, playlists);
  // Determine initial tab: first one that has data
  const initialTab = useMemo<LibraryTab>(() => {
    if (tracks.length) return "tracks";
    if (albums.length) return "albums";
    if (playlists.length) return "playlists";
    return "tracks";
  }, [tracks.length, albums.length, playlists.length]);

  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);

  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const handleRetry = useCallback(() => refetch?.(), [refetch]);

  // Auto-switch away from an empty tab when data arrives
  const resolvedTab = useMemo<LibraryTab>(() => {
    if (
      activeTab === "tracks" &&
      !tracks.length &&
      (albums.length || playlists.length)
    )
      return albums.length ? "albums" : "playlists";
    if (
      activeTab === "albums" &&
      !albums.length &&
      (tracks.length || playlists.length)
    )
      return tracks.length ? "tracks" : "playlists";
    if (
      activeTab === "playlists" &&
      !playlists.length &&
      (tracks.length || albums.length)
    )
      return tracks.length ? "tracks" : "albums";
    return activeTab;
  }, [activeTab, tracks.length, albums.length, playlists.length]);

  const handlePlayAlbum = useCallback(
    async (albumId: string) => {
      try {
        const res = await queryClient.fetchQuery({
          queryKey: albumKeys.detail(albumId),
          queryFn: () => albumApi.getById(albumId),
          staleTime: 5 * 60 * 1000,
        });
        const t = res.data?.tracks;
        if (!t?.length) {
          toast.error("Album này chưa có bài hát nào.");
          return;
        }
        dispatch(setQueue({ tracks: t, startIndex: 0 }));
        dispatch(setIsPlaying(true));
        toast.success(`Đang phát ${t.length} bài từ album`);
      } catch {
        toast.error("Không thể tải album. Vui lòng thử lại.");
      }
    },
    [queryClient, dispatch],
  );

  const handlePlayPlaylist = useCallback(
    async (playlistId: string) => {
      try {
        const res = await queryClient.fetchQuery({
          queryKey: playlistKeys.detail(playlistId),
          queryFn: () => playlistApi.getById(playlistId),
          staleTime: 5 * 60 * 1000,
        });
        const t = res.data?.tracks;
        if (!t?.length) {
          toast.error("Playlist này chưa có bài hát nào.");
          return;
        }
        dispatch(setQueue({ tracks: t, startIndex: 0 }));
        dispatch(setIsPlaying(true));
        toast.success(`Đang phát ${t.length} bài từ playlist`);
      } catch {
        toast.error("Không thể tải playlist. Vui lòng thử lại.");
      }
    },
    [queryClient, dispatch],
  );

  // ── Nothing to show ───────────────────────────────────────────────────────
  if (
    !isLoading &&
    !error &&
    !tracks.length &&
    !albums.length &&
    !playlists.length
  ) {
    return null;
  }

  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;

  // ── Render tab content ────────────────────────────────────────────────────
  const renderContent = () => {
    if (isLoading) {
      return resolvedTab === "tracks" ? <TrackSkeleton /> : <GridSkeleton />;
    }

    if (error) return <ErrorState onRetry={handleRetry} />;

    if (resolvedTab === "tracks") {
      return tracks.length === 0 ? (
        <EmptyState tab={activeTabConfig} />
      ) : (
        <TrackList tracks={tracks} isLoading={false} />
      );
    }

    if (resolvedTab === "albums") {
      return albums.length === 0 ? (
        <EmptyState tab={activeTabConfig} />
      ) : (
        <AlbumContent albums={albums} onPlay={handlePlayAlbum} />
      );
    }

    // playlists
    return playlists.length === 0 ? (
      <EmptyState tab={activeTabConfig} />
    ) : (
      <PlaylistContent playlists={playlists} onPlay={handlePlayPlaylist} />
    );
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
            hasTracks={tracks.length > 0}
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
