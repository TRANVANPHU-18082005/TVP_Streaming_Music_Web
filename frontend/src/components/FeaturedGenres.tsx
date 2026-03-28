"use client";

/**
 * @file FeaturedGenres.tsx — Featured Genres Section (Refactored v2.0)
 *
 * ARCHITECTURE:
 * - No play handler needed (genre cards navigate, don't queue) — component is
 *   purely presentational after data resolves; zero dispatch/queryClient deps
 * - GenreGrid / GenreScroll isolated as memos — viewport IntersectionObserver
 *   only attaches after data resolves, not during loading state
 * - Aspect ratio: desktop grid uses `aspect-[3/2]` (landscape) matching
 *   GenreCard's intended proportions; mobile strip uses `aspect-[16/9]`
 * - renderContent() replaces triple ternary — explicit state machine
 *
 * DESIGN:
 * - Wave-3 (cyan/teal) accent to complete the section color palette:
 *     Albums  → brand-500 (purple)
 *     Playlists → wave-2 (fuchsia)
 *     Genres  → wave-3 (cyan) ← this file
 * - section-block (no --alt) for surface rhythm: alt → base → alt pattern
 * - Aurora-style glow divider with wave-3/wave-4 gradient
 * - 2×4 desktop grid (landscape cards) vs horizontal snap on mobile
 * - Skeleton aspect ratios match loaded card exactly — no layout shift
 */

import { memo } from "react";
import { Shapes, AlertCircle, LayoutGrid, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { Genre } from "@/features/genre/types";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { GenreCard } from "@/features/genre/components/GenreCard";
import { useGenresQuery } from "@/features/genre/hooks/useGenresQuery";
import { cn } from "@/lib/utils";

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
            background: "hsl(var(--wave-3) / 0.12)",
            color: "hsl(var(--wave-3))",
          }}
        >
          <Shapes className="size-3.5" />
        </div>
        <span className="text-overline" style={{ color: "hsl(var(--wave-3))" }}>
          Explore
        </span>
      </div>

      <h2
        id="featured-genres-heading"
        className="text-section-title text-foreground leading-tight"
      >
        Browse by Genre
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Khám phá thế giới âm nhạc qua từng thể loại.
      </p>
    </div>

    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-muted-foreground",
        "hover:text-foreground transition-colors duration-200",
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
      {Array.from({ length: 8 }).map((_, i) => (
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
// ERROR STATE
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
      <LayoutGrid className="size-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE GRID — desktop 4-col whileInView stagger
// Isolated memo: viewport observer attaches only post-data, not during loading
// ─────────────────────────────────────────────────────────────────────────────
const GenreGrid = memo(({ genres }: { genres: Genre[] }) => (
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
const GenreScroll = memo(({ genres }: { genres: Genre[] }) => (
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
  const { data, isLoading, isError } = useGenresQuery({
    page: 1,
    limit: 8,
    isTrending: true,
    sort: "priority",
  });

  const genres = data?.genres as Genre[] | undefined;

  const renderContent = () => {
    if (isLoading) return <SkeletonGrid />;
    if (isError)
      return <ErrorState message="Không thể tải danh sách thể loại." />;
    if (!genres?.length)
      return <EmptyState message="Chưa có thể loại âm nhạc nào." />;

    return (
      <div className="relative">
        <GenreScroll genres={genres} />
        <GenreGrid genres={genres} />
      </div>
    );
  };

  return (
    <section
      className="section-block section-block--base"
      aria-labelledby="featured-genres-heading"
    >
      <div className="section-container">
        {/* Wave-3/wave-4 aurora divider — teal → gold, distinct from other sections */}
        <div
          className="hidden lg:block h-px mb-8"
          style={{
            background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-3) / 0.32) 30%,
              hsl(var(--wave-4) / 0.28) 70%,
              transparent
            )`,
            boxShadow: "0 0 8px hsl(var(--wave-3) / 0.1)",
          }}
        />

        <GenresHeader viewAllHref="/genres" />

        {renderContent()}
      </div>
    </section>
  );
}

export default FeaturedGenres;
