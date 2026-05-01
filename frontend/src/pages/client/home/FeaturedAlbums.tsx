import { memo, useMemo } from "react";
import { Disc3, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

import { Link } from "react-router-dom";

import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { useFeatureAlbums } from "@/features/album/hooks/useAlbumsQuery";

import { IAlbum, useSyncInteractions } from "@/features";
import { cn } from "@/lib/utils";

import MusicResult from "@/components/ui/Result";

import SectionAmbient from "@/components/SectionAmbient";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { APP_CONFIG } from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.065, delayChildren: 0.08 },
  },
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

const mobileCardVariants = {
  hidden: { opacity: 0, x: 18 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.38, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — inline (no external SectionHeader dep for full design control)
// ─────────────────────────────────────────────────────────────────────────────
const FeaturedHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    {/* Left — label + title + description */}
    <div className="flex flex-col gap-2">
      {/* Eyebrow */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--wave-7) / 0.14)",
            color: "hsl(var(--wave-7))",
          }}
        >
          <Disc3 className="size-3.5" />
        </div>
        <span className="text-overline" style={{ color: "hsl(var(--wave-7))" }}>
          Lựa chọn
        </span>
      </div>

      {/* Title */}
      <h2 className="text-section-title text-foreground leading-tight">
        Album nổi bật
      </h2>

      {/* Description — hidden on small mobile to save vertical space */}
      <p className="text-section-subtitle hidden sm:block">
        Album nổi bật được biên tập chọn lọc.
      </p>
    </div>

    {/* Right — View all link */}
    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-wave-7 opacity-70",
        "hover:text-wave-7 transition-colors duration-200 hover:opacity-100",
      )}
      aria-label="Xem tất cả album nổi bật"
    >
      <span>Xem tất cả</span>
      <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  </div>
));
FeaturedHeader.displayName = "FeaturedHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID — mirrors exact loaded layout; pixel-matched card sizes
// Uses Soundwave .skeleton token classes from index.css
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <>
    {/* Mobile horizontal strip — 3 visible cards */}
    <div
      className="flex gap-4 overflow-hidden lg:hidden"
      aria-label="Đang tải albums"
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
      aria-label="Đang tải albums"
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
// ALBUM GRID — desktop whileInView stagger
// Isolated so viewport observer doesn't re-mount on parent re-render
// ─────────────────────────────────────────────────────────────────────────────
const AlbumGrid = memo(({ albums }: { albums: IAlbum[] }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-48px" }}
    className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
    role="list"
    aria-label="Danh sách album nổi bật"
  >
    {albums.map((album) => (
      <motion.div key={album._id} variants={cardVariants} role="listitem">
        <PublicAlbumCard album={album} />
      </motion.div>
    ))}
  </motion.div>
));
AlbumGrid.displayName = "AlbumGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM SCROLL — mobile horizontal scroll strip
// snap-x scroll with masked edges from .scroll-overflow-mask
// ─────────────────────────────────────────────────────────────────────────────
const AlbumScroll = memo(({ albums }: { albums: IAlbum[] }) => (
  <div
    className="lg:hidden scroll-overflow-mask -mx-4 px-4"
    role="list"
    aria-label="Danh sách album nổi bật"
  >
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
            "snap-start shrink-0",
            "w-[168px] sm:w-[200px]",
            "first:pl-0 last:pr-4",
          )}
        >
          <PublicAlbumCard album={album} />
        </motion.div>
      ))}
    </HorizontalScroll>
  </div>
));
AlbumScroll.displayName = "AlbumScroll";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURED ALBUMS — main section orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturedAlbums() {
  const { data: albums, isLoading, isError, refetch } = useFeatureAlbums();

  const albumIds = useMemo(() => albums?.map((a) => a._id) ?? [], [albums]);

  useSyncInteractions(albumIds, "like", "album", albumIds.length > 0);
  const hasResults = albums && albums?.length > 0;
  const isOffline = !useOnlineStatus();

  const renderContent = () => {
    if (isLoading && !hasResults) {
      return <SkeletonGrid count={3} />;
    }
    // Switching
    if (isLoading && hasResults) {
      return <WaveformLoader glass={false} text="Đang tải" />;
    }
    // Error or Empty
    if (isError || !hasResults) {
      if (!isError && !hasResults) return null; // Prevent showing error when just empty
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
        <AlbumScroll albums={albums} />
        <AlbumGrid albums={albums} />
      </div>
    );
  };
  if (!isLoading && !hasResults && !isError) return null;
  return (
    <>
      <div
        className="lg:block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-7) / 0.3) 30%,
              hsl(var(--wave-7) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-7) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--base"
        aria-labelledby="featured-albums-heading"
      >
        {/* <SectionAmbient /> */}
        <SectionAmbient style="wave-7" />
        <div className="section-container">
          <FeaturedHeader viewAllHref="/albums" />

          {renderContent()}
        </div>
      </section>
    </>
  );
}

export default FeaturedAlbums;
