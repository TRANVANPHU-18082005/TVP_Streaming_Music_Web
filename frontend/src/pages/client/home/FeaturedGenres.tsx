import { memo } from "react";
import { Shapes, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { GenreCard } from "@/features/genre/components/GenreCard";
import { cn } from "@/lib/utils";
import SectionAmbient from "../../../components/SectionAmbient";
import { IGenre, useGenresByUserQuery } from "@/features";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import MusicResult from "../../../components/ui/Result";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { APP_CONFIG } from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS — scale-first reveal suits the wide genre cards
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.055, delayChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 14 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.46, ease: EASE_EXPO },
  },
};

const mobileCardVariants = {
  hidden: { opacity: 0, x: 14 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.055, duration: 0.36, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — wave-3 (cyan) accent
// ─────────────────────────────────────────────────────────────────────────────
const GenresHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      {/* Eyebrow — wave-3 tint */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--wave-10) / 0.12)",
            color: "hsl(var(--wave-10))",
          }}
        >
          <Shapes className="size-3.5" />
        </div>
        <span
          className="text-overline"
          style={{ color: "hsl(var(--wave-10))" }}
        >
          Khám phá
        </span>
      </div>

      <h2
        id="featured-genres-heading"
        className="text-section-title text-foreground leading-tight"
      >
        Thể loại âm nhạc
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Khám phá thế giới âm nhạc qua từng thể loại.
      </p>
    </div>

    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-wave-10 opacity-70",
        "hover:text-wave-10 transition-colors duration-200 hover:opacity-100",
      )}
      aria-label="Xem tất cả thể loại âm nhạc"
    >
      <span>Xem tất cả</span>
      <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  </div>
));
GenresHeader.displayName = "GenresHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID — landscape aspect-[3/2] matches GenreCard desktop proportions
// Mobile uses aspect-[16/9] matching the wider horizontal cards
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(() => (
  <>
    {/* Mobile strip — 3 cards visible */}
    <div
      className="flex gap-4 overflow-hidden lg:hidden"
      aria-label="Đang tải thể loại"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="skeleton w-[240px] sm:w-[280px] shrink-0"
          style={{ aspectRatio: "16/9", borderRadius: "1rem" }}
        />
      ))}
    </div>

    {/* Desktop 2×4 grid */}
    <div
      className="hidden lg:grid lg:grid-cols-4 gap-5 xl:gap-6"
      aria-label="Đang tải thể loại"
      aria-busy="true"
    >
      {Array.from({ length: APP_CONFIG.HOME_PAGE_LIMIT }).map((_, i) => (
        <div
          key={i}
          className="skeleton w-full"
          style={{ aspectRatio: "3/2", borderRadius: "1rem" }}
        />
      ))}
    </div>
  </>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE GRID — desktop 4-col whileInView stagger
// Isolated memo: viewport observer attaches only post-data, not during loading
// ─────────────────────────────────────────────────────────────────────────────
const GenreGrid = memo(({ genres }: { genres: IGenre[] }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-48px" }}
    className="hidden lg:grid lg:grid-cols-4 gap-5 xl:gap-6"
    role="list"
    aria-label="Danh sách thể loại âm nhạc"
  >
    {genres.map((genre) => (
      <motion.div key={genre._id} variants={cardVariants} role="listitem">
        <GenreCard genre={genre} />
      </motion.div>
    ))}
  </motion.div>
));
GenreGrid.displayName = "GenreGrid";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE SCROLL — mobile snap-x horizontal strip
// ─────────────────────────────────────────────────────────────────────────────
const GenreScroll = memo(({ genres }: { genres: IGenre[] }) => (
  <div
    className="lg:hidden scroll-overflow-mask -mx-4 px-4"
    role="list"
    aria-label="Danh sách thể loại âm nhạc"
  >
    <HorizontalScroll>
      {genres.map((genre, i) => (
        <motion.div
          key={genre._id}
          custom={i}
          variants={mobileCardVariants}
          initial="hidden"
          animate="visible"
          role="listitem"
          className={cn(
            "snap-start shrink-0",
            "w-[240px] sm:w-[280px]",
            "first:pl-0 last:pr-4",
          )}
        >
          <GenreCard genre={genre} size="lg" />
        </motion.div>
      ))}
    </HorizontalScroll>
  </div>
));
GenreScroll.displayName = "GenreScroll";

// ─────────────────────────────────────────────────────────────────────────────
// FEATURED GENRES — section orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturedGenres() {
  const { data, isLoading, isError, refetch } = useGenresByUserQuery({
    page: 1,
    limit: APP_CONFIG.HOME_PAGE_LIMIT,
    isTrending: true,
    sort: "priority",
  });

  const genres = data?.genres as IGenre[] | undefined;

  const hasResults = genres && genres?.length > 0;
  const isOffline = !useOnlineStatus();

  const renderContent = () => {
    if (isLoading && !hasResults) {
      return <SkeletonGrid />;
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
        <GenreScroll genres={genres} />
        <GenreGrid genres={genres} />
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
              hsl(var(--wave-10) / 0.3) 30%,
              hsl(var(--wave-10) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-10) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--base"
        aria-labelledby="featured-genres-heading"
      >
        {/* <SectionAmbient /> */}
        <SectionAmbient style="wave-10" />
        <div className="section-container">
          <GenresHeader viewAllHref="/genres" />

          {renderContent()}
        </div>
      </section>
    </>
  );
}

export default FeaturedGenres;
