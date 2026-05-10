import { memo, useMemo } from "react";
import { Users, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { useSpotlightArtists } from "@/features/artist/hooks/useArtistsQuery";
import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import MusicResult from "../../../components/ui/Result";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { IArtist } from "@/features/artist";
import { useSyncInteractions } from "@/features/interaction";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS — vertical reveal suits portrait/avatar card rhythm
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.075, delayChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.46, ease: EASE_EXPO },
  },
};

const mobileCardVariants = {
  hidden: { opacity: 0, x: 14 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.07, duration: 0.38, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — wave-4 (gold/amber) accent
// ─────────────────────────────────────────────────────────────────────────────
const ArtistSpotlightHeader = memo(
  ({ viewAllHref }: { viewAllHref: string }) => (
    <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
      <div className="flex flex-col gap-2">
        {/* Eyebrow — wave-4 gold tint */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center size-6 rounded-md"
            style={{
              background: "hsl(var(--wave-9) / 0.14)",
              color: "hsl(var(--wave-9))",
            }}
          >
            <Users className="size-3.5" />
          </div>
          <span
            className="text-overline"
            style={{ color: "hsl(var(--wave-9))" }}
          >
            Tiêu điểm
          </span>
        </div>

        <h2
          id="artist-spotlight-heading"
          className="text-section-title text-foreground leading-tight"
        >
          Nghệ sĩ nổi bật
        </h2>

        <p className="text-section-subtitle hidden sm:block">
          Những nghệ sĩ đang tạo nên xu hướng âm nhạc.
        </p>
      </div>

      <Link
        to={viewAllHref}
        className={cn(
          "group flex items-center gap-1.5 shrink-0 mt-1",
          "text-sm font-medium text-wave-9 opacity-70",
          "hover:text-wave-9 transition-colors duration-200 hover:opacity-100",
        )}
        aria-label="Xem tất cả nghệ sĩ nổi bật"
      >
        <span>Xem tất cả</span>
        <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  ),
);
ArtistSpotlightHeader.displayName = "ArtistSpotlightHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID — circular avatars with name/meta placeholder bars
// Circular skeleton (border-radius: 50%) matches PublicArtistCard avatar shape
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <>
    {/* Mobile strip — 3 visible */}
    <div
      className="flex gap-5 overflow-hidden lg:hidden"
      aria-label="Đang tải nghệ sĩ"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[160px] sm:w-[180px] shrink-0 space-y-3">
          <div
            className="skeleton skeleton-avatar w-full"
            style={{ aspectRatio: "1/1", borderRadius: "50%" }}
          />
          <div className="skeleton skeleton-text w-2/3 mx-auto" />
          <div className="skeleton skeleton-text w-1/3 mx-auto" />
        </div>
      ))}
    </div>

    {/* Desktop 5-col grid */}
    <div
      className="hidden lg:grid grid-cols-3 xl:grid-cols-5 gap-5 xl:gap-6"
      aria-label="Đang tải nghệ sĩ"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div
            className="skeleton skeleton-avatar w-full"
            style={{ aspectRatio: "1/1", borderRadius: "50%" }}
          />
          <div className="skeleton skeleton-text w-2/3 mx-auto" />
          <div className="skeleton skeleton-text w-1/3 mx-auto" />
        </div>
      ))}
    </div>
  </>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST GRID — desktop 5-col whileInView stagger
// Isolated memo so IntersectionObserver only attaches post-data-resolve
// ─────────────────────────────────────────────────────────────────────────────
const ArtistGrid = memo(({ artists }: { artists: IArtist[] }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-48px" }}
    className="hidden lg:grid grid-cols-3 xl:grid-cols-5 gap-5 xl:gap-6"
    role="list"
    aria-label="Danh sách nghệ sĩ nổi bật"
  >
    {artists.map((artist) => (
      <motion.div key={artist._id} variants={cardVariants} role="listitem">
        <PublicArtistCard artist={artist} />
      </motion.div>
    ))}
  </motion.div>
));
ArtistGrid.displayName = "ArtistGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SCROLL — mobile snap-x horizontal strip
// ─────────────────────────────────────────────────────────────────────────────
const ArtistScroll = memo(({ artists }: { artists: IArtist[] }) => (
  <div
    className="lg:hidden scroll-overflow-mask -mx-4 px-4"
    role="list"
    aria-label="Danh sách nghệ sĩ nổi bật"
  >
    <HorizontalScroll>
      {artists.map((artist, i) => (
        <motion.div
          key={artist._id}
          custom={i}
          variants={mobileCardVariants}
          initial="hidden"
          animate="visible"
          role="listitem"
          className={cn(
            "snap-start shrink-0",
            "w-[160px] sm:w-[180px]",
            "first:pl-0 last:pr-4",
          )}
        >
          <PublicArtistCard artist={artist} variant="compact" />
        </motion.div>
      ))}
    </HorizontalScroll>
  </div>
));
ArtistScroll.displayName = "ArtistScroll";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SPOTLIGHT — section orchestrator
//
// Hook call order is unconditional — useSyncInteractions must always run.
// The `enabled` guard is passed as the 4th argument to the hook itself,
// not wrapped in a conditional — this is the correct pattern.
// ─────────────────────────────────────────────────────────────────────────────
export function ArtistSpotlight() {
  const { data: artists, isLoading, isError, refetch } = useSpotlightArtists();
  const artistIds = useMemo(
    () => artists?.map((a: IArtist) => a._id),
    [artists],
  );
  useSyncInteractions(
    artistIds || [],
    "follow",
    "artist",
    !isLoading && artistIds && artistIds?.length > 0,
  );
  const hasResults = artists && artists?.length > 0;
  const isOffline = !useOnlineStatus();

  const renderContent = () => {
    if (isLoading && !hasResults) {
      return <SkeletonGrid count={3} />;
    }
    // Switching
    if (isLoading && hasResults) {
      return <VinylLoader />;
    }
    // Error or Empty
    if (isError || !hasResults) {
      if (!isError && !hasResults) return null;
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
        <ArtistScroll artists={artists} />
        <ArtistGrid artists={artists} />
      </div>
    );
  };

  if (!isLoading && !hasResults && !isError) return null;

  return (
    <>
      <div
        className="block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-9) / 0.3) 30%,
              hsl(var(--wave-9) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-9) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--alt"
        aria-labelledby="artist-spotlight-heading"
      >
        {/* <SectionAmbient /> */}
        <SectionAmbient style="wave-9" />
        <div className="section-container">
          <ArtistSpotlightHeader viewAllHref="/artists" />

          {renderContent()}
        </div>
      </section>
    </>
  );
}

export default ArtistSpotlight;
