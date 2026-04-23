import { memo, useMemo } from "react";
import { Music2, AlertCircle, ListMusic, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";

import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { useFeaturedPlaylists } from "@/features/playlist/hooks/usePlaylistsQuery";

import { IPlaylist, useSyncInteractions } from "@/features";
import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import MusicResult from "../../../components/ui/Result";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS — slightly softer than Albums for tonal differentiation
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.965 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.44, ease: EASE_EXPO },
  },
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
// SECTION HEADER — wave-2 accent (fuchsia/pink) to distinguish from Albums
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistsHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      {/* Eyebrow — wave-2 tint */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--wave-8) / 0.12)",
            color: "hsl(var(--wave-8))",
          }}
        >
          <Music2 className="size-3.5" />
        </div>
        <span className="text-overline" style={{ color: "hsl(var(--wave-8))" }}>
          Curated
        </span>
      </div>

      <h2
        className="text-section-title text-foreground leading-tight"
        id="featured-playlists-heading"
      >
        Featured Playlists
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Playlist được tuyển chọn cho mọi cảm xúc.
      </p>
    </div>

    {/* View all */}
    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-wave-8 opacity-70",
        "hover:text-wave-8 transition-colors duration-200 hover:opacity-100",
      )}
      style={{ "--tw-text-opacity": 1 } as React.CSSProperties}
      aria-label="Xem tất cả playlist nổi bật"
    >
      <span>Xem tất cả</span>
      <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  </div>
));
PlaylistsHeader.displayName = "PlaylistsHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID — pixel-matched to loaded card dimensions
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <>
    {/* Mobile strip — 3 visible */}
    <div
      className="flex gap-4 overflow-hidden lg:hidden"
      aria-label="Đang tải playlists"
      aria-busy="true"
    >
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

    {/* Desktop grid */}
    <div
      className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
      aria-label="Đang tải playlists"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
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
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE — wave-2 tinted for section consistency
// ─────────────────────────────────────────────────────────────────────────────
const ErrorState = memo(({ message }: { message: string }) => (
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
      <AlertCircle className="size-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Đã có lỗi xảy ra</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
    <button
      onClick={() => window.location.reload()}
      className="btn-outline btn-sm mt-1"
    >
      Thử lại
    </button>
  </div>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(({ message }: { message: string }) => (
  <div
    role="status"
    aria-label={message}
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-16 px-6",
      "rounded-2xl border border-dashed border-border text-center",
    )}
  >
    <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground">
      <ListMusic className="size-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST GRID — desktop whileInView stagger
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistGrid = memo(({ playlists }: { playlists: IPlaylist[] }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-48px" }}
    className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
    role="list"
    aria-label="Danh sách playlist nổi bật"
  >
    {playlists.map((pl) => (
      <motion.div key={pl._id} variants={cardVariants} role="listitem">
        <PublicPlaylistCard playlist={pl} />
      </motion.div>
    ))}
  </motion.div>
));
PlaylistGrid.displayName = "PlaylistGrid";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST SCROLL — mobile snap-x horizontal strip
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistScroll = memo(({ playlists }: { playlists: IPlaylist[] }) => (
  <div
    className="lg:hidden scroll-overflow-mask -mx-4 px-4"
    role="list"
    aria-label="Danh sách playlist nổi bật"
  >
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
            "snap-start shrink-0",
            "w-[168px] sm:w-[200px]",
            "first:pl-0 last:pr-4",
          )}
        >
          <PublicPlaylistCard playlist={pl} />
        </motion.div>
      ))}
    </HorizontalScroll>
  </div>
));
PlaylistScroll.displayName = "PlaylistScroll";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURED PLAYLISTS — section orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturedPlaylists() {
  const {
    data: playlists,
    isLoading,
    isError,
    refetch,
  } = useFeaturedPlaylists(6);

  const playlistIds = useMemo(
    () => playlists?.map((p) => p._id) ?? [],
    [playlists],
  );

  useSyncInteractions(playlistIds, "like", "playlist", playlistIds.length > 0);

  const hasResults = playlists && playlists?.length > 0;
  const isOffline = !navigator.onLine;

  const renderContent = () => {
    if (isLoading && !hasResults) {
      return <SkeletonGrid count={3} />;
    }
    // Switching
    if (isLoading && hasResults) {
      return <VinylLoader />;
    }
    // Deep Error
    if (isError || !hasResults) {
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
          <MusicResult variant="error-network" onRetry={refetch} />
        </div>
      );
    }

    return (
      <div className="relative">
        <PlaylistScroll playlists={playlists} />
        <PlaylistGrid playlists={playlists} />
      </div>
    );
  };
  return (
    <>
      <div
        className="lg:block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-8) / 0.3) 30%,
              hsl(var(--wave-8) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-8) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--alt"
        aria-labelledby="featured-playlists-heading"
      >
        {/* <SectionAmbient /> */}
        <SectionAmbient style="wave-8" />
        <div className="section-container">
          <PlaylistsHeader viewAllHref="/playlists" />

          {renderContent()}
        </div>
      </section>
    </>
  );
}

export default FeaturedPlaylists;
