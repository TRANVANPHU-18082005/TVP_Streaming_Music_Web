"use client";

/**
 * @file ArtistSpotlight.tsx — Artist Spotlight Section (Refactored v2.0)
 *
 * ARCHITECTURE:
 * - `useSyncInteractions` call preserved exactly — hook must run unconditionally,
 *   so artistIds useMemo + enabled guard pattern is kept intact
 * - ArtistGrid / ArtistScroll extracted as isolated memos; viewport observer
 *   only mounts after data resolves, not during skeleton phase
 * - Skeleton uses circular aspect-square divs with .skeleton token (not
 *   <Skeleton className="rounded-full"> which bypasses index.css shimmer)
 * - renderContent() state machine replaces chained ternaries
 * - No play handler — artist cards navigate; zero dispatch/queryClient deps
 *
 * DESIGN:
 * - Wave-4 (gold/amber) accent — completes the home page section palette:
 *     Albums    → brand-500 (purple)
 *     Playlists → wave-2   (fuchsia)
 *     Genres    → wave-3   (cyan)
 *     Artists   → wave-4   (gold)   ← this file
 * - section-block--alt for surface rhythm (base→alt→base→alt alternation)
 * - Circular skeleton with shimmer preserves perceived layout of avatar grid
 * - Gold/amber glow divider with wave-4 → wave-1 gradient
 */

import { memo, useMemo } from "react";
import { Users, AlertCircle, UserRound, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import PublicArtistCard from "@/features/artist/components/PublicArtistCard";
import { Artist } from "@/features/artist/types";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { useSpotlightArtists } from "@/features/artist/hooks/useArtistsQuery";
import { useSyncInteractions } from "@/features";
import { cn } from "@/lib/utils";

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
              background: "hsl(var(--wave-4) / 0.14)",
              color: "hsl(var(--wave-4))",
            }}
          >
            <Users className="size-3.5" />
          </div>
          <span
            className="text-overline"
            style={{ color: "hsl(var(--wave-4))" }}
          >
            Spotlight
          </span>
        </div>

        <h2
          id="artist-spotlight-heading"
          className="text-section-title text-foreground leading-tight"
        >
          Artist Spotlight
        </h2>

        <p className="text-section-subtitle hidden sm:block">
          Những nghệ sĩ đang tạo nên xu hướng âm nhạc.
        </p>
      </div>

      <Link
        to={viewAllHref}
        className={cn(
          "group flex items-center gap-1.5 shrink-0 mt-1",
          "text-sm font-medium text-muted-foreground",
          "hover:text-foreground transition-colors duration-200",
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
      <UserRound className="size-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST GRID — desktop 5-col whileInView stagger
// Isolated memo so IntersectionObserver only attaches post-data-resolve
// ─────────────────────────────────────────────────────────────────────────────
const ArtistGrid = memo(({ artists }: { artists: Artist[] }) => (
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
const ArtistScroll = memo(({ artists }: { artists: Artist[] }) => (
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
  const { data: artists, isLoading, isError } = useSpotlightArtists(5);

  // Stable ID array — avoids new array reference on every render
  const artistIds = useMemo(
    () => artists?.map((a: Artist) => a._id) ?? [],
    [artists],
  );

  // Sync follow state for all visible artists in one batch request
  // Must run unconditionally — `enabled` guard is passed into the hook
  useSyncInteractions(
    artistIds,
    "follow",
    "artist",
    !isLoading && artistIds.length > 0,
  );

  const renderContent = () => {
    if (isLoading) return <SkeletonGrid count={5} />;
    if (isError)
      return <ErrorState message="Không thể tải danh sách nghệ sĩ." />;
    if (!artists?.length)
      return <EmptyState message="Chưa có nghệ sĩ nổi bật nào." />;

    return (
      <div className="relative">
        <ArtistScroll artists={artists} />
        <ArtistGrid artists={artists} />
      </div>
    );
  };

  return (
    <section
      className="section-block section-block--alt"
      aria-labelledby="artist-spotlight-heading"
    >
      <div className="section-container">
        {/* Wave-4 → wave-1 aurora divider — gold → violet, distinct from other sections */}
        <div
          className="hidden lg:block h-px mb-8"
          style={{
            background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-4) / 0.3) 30%,
              hsl(var(--wave-1) / 0.28) 70%,
              transparent
            )`,
            boxShadow: "0 0 8px hsl(var(--wave-4) / 0.1)",
          }}
        />

        <ArtistSpotlightHeader viewAllHref="/artists" />

        {renderContent()}
      </div>
    </section>
  );
}

export default ArtistSpotlight;
