/**
 * TopFeaturedTracks.tsx — Home-page chart widget (Refactored v3.0)
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ALIGNMENT WITH FeaturedPlaylists.tsx:
 * - section-block--alt surface for visual alternation rhythm (Spotify pattern)
 * - Wave-1 (violet/brand) accent palette — differentiates charts from playlists
 * - Same header anatomy: eyebrow icon + overline + title + subtitle + view-all link
 * - Same divider-glow treatment at section top (wave-1 tint)
 * - Same section-container / section-container spacing
 * - SkeletonGrid mirrors FeaturedPlaylists skeleton structure
 * - ErrorState / EmptyState use same rounded-2xl card pattern
 * - SectionAmbient orbs align to brand + wave-1 palette
 *
 * ARCHITECTURE:
 * - All animation variants at module scope (stable refs, zero GC pressure)
 * - top10 memoized on tracks ref — AnimatePresence never sees phantom diffs
 * - ChartRow memo'd — only re-renders when its own track/rank data changes
 * - ChartRankBadge memo'd on (rank, prevRank) — isolated from list shuffles
 * - UpdatingIndicator extracted — toggling isUpdating re-renders only this node
 * - makeRowVariants factory returns pre-typed stable variant shapes
 * - WCAG 2.1 AA: aria-busy, aria-live, role=status/alert, aria-label throughout
 */

import { memo, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Loader2,
  Music2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronRight,
  BellElectric,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ChartItem } from "@/features/track/components/ChartItem";
import { ChartTrack } from "@/features/track/types";
import { cn } from "@/lib/utils";
import SectionAmbient from "./SectionAmbient";
import { useProfileDashboard } from "@/features/profile/hooks/useProfileQuery";
import { TrackList } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TOP_N = 10;
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS — module-scope, stable references
// ─────────────────────────────────────────────────────────────────────────────

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: EASE_EXPO },
} as const;

const slideUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: EASE_EXPO },
} as const;

const makeRowVariants = (index: number, reduced: boolean) => ({
  layout: true as const,
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
  animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
  exit: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 },
  transition: reduced
    ? { duration: 0.15 }
    : {
        type: "spring" as const,
        stiffness: 520,
        damping: 32,
        delay: Math.min(index * 0.028, 0.28),
      },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// Mirrors FeaturedPlaylists PlaylistsHeader exactly:
// eyebrow icon (wave-1 tint) + overline + h2 + subtitle + view-all link
// ─────────────────────────────────────────────────────────────────────────────

const ChartHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      {/* Eyebrow — wave-1 (brand violet) tint */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--brand-glow) / 0.12)",
            color: "hsl(var(--brand-glow))",
          }}
        >
          <BellElectric className="size-3.5" aria-hidden="true" />
        </div>
        <span
          className="text-overline"
          style={{ color: "hsl(var(--brand-glow))" }}
        >
          Histories
        </span>
      </div>

      <h2
        className="text-section-title text-foreground leading-tight"
        id="top-featured-tracks-heading"
      >
        Recently listened tracks
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Track đã nghe gần đây của bạn, được cập nhật liên tục dựa trên hoạt động
        nghe nhạc của bạn.
      </p>
    </div>

    {/* View all */}
    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-brand opacity-70",
        "hover:text-brand transition-colors duration-200 hover:opacity-100",
      )}
      aria-label="Xem tất cả bảng xếp hạng"
    >
      <span>Xem tất cả</span>
      <ChevronRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  </div>
));
ChartHeader.displayName = "ChartHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — pixel-matched to ChartItem layout, mirrors FeaturedPlaylists
// skeleton pattern (mobile strip + desktop grid equivalent)
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonGrid = memo(({ count }: { count: number }) => (
  <div
    className="flex flex-col gap-1"
    role="status"
    aria-label="Đang tải bảng xếp hạng"
    aria-busy="true"
  >
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        style={{ animationDelay: `${i * 50}ms` }}
        aria-hidden="true"
      >
        {/* Rank column — w-[52px] matches ChartItem */}
        <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
          <div className="skeleton w-5 h-3 rounded-full" />
          <div className="skeleton w-6 h-2.5 rounded-full" />
        </div>
        {/* Cover art — matches ChartItem size-[44px] sm:size-[48px] */}
        <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
        {/* Track info */}
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
        {/* Duration — hidden on mobile */}
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
        {/* Play count — hidden on mobile/tablet */}
        <div className="skeleton w-14 h-3 rounded-full hidden md:block" />
      </div>
    ))}
  </div>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE — mirrors FeaturedPlaylists ErrorState card anatomy
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
        Không thể tải bảng xếp hạng. Vui lòng thử lại.
      </p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="btn-outline btn-sm mt-1 flex items-center gap-1.5"
        aria-label="Thử tải lại bảng xếp hạng"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Thử lại
      </button>
    )}
  </div>
));
ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — mirrors FeaturedPlaylists EmptyState card anatomy
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <div
    role="status"
    aria-label="Chưa có bài hát nào"
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-16 px-6",
      "rounded-2xl border border-dashed border-border text-center",
    )}
  >
    <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground">
      <Music2 className="size-5" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
      <p className="text-xs text-muted-foreground">
        Bảng xếp hạng đang được cập nhật. Vui lòng quay lại sau.
      </p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// RANK DELTA BADGE — memoized on (rank, prevRank), isolated from list shuffles
// ─────────────────────────────────────────────────────────────────────────────

const ChartRankBadge = memo(
  ({ rank, prevRank }: { rank: number; prevRank: number }) => {
    const delta = prevRank - rank;
    if (delta === 0) {
      return (
        <span
          aria-label="Hạng không thay đổi"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/40"
        >
          <Minus className="w-2.5 h-2.5" aria-hidden="true" />
        </span>
      );
    }
    const isUp = delta > 0;
    return (
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 600,
          damping: 28,
          delay: 0.12,
        }}
        aria-label={`Hạng ${isUp ? "tăng" : "giảm"} ${Math.abs(delta)}`}
        className={cn(
          "inline-flex items-center gap-0.5 text-[9px] font-semibold font-mono tracking-wide",
          "leading-none px-1 py-0.5 rounded-full",
          isUp
            ? "text-emerald-400 bg-emerald-400/10"
            : "text-rose-400 bg-rose-400/10",
        )}
      >
        {isUp ? (
          <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5" aria-hidden="true" />
        )}
        {Math.abs(delta)}
      </motion.span>
    );
  },
);
ChartRankBadge.displayName = "ChartRankBadge";

// ─────────────────────────────────────────────────────────────────────────────
// UPDATING INDICATOR — extracted memo, only this node re-renders on isUpdating
// ─────────────────────────────────────────────────────────────────────────────

const UpdatingIndicator = memo(({ visible }: { visible: boolean }) => (
  <div
    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
    aria-live="polite"
    aria-atomic="true"
  >
    <AnimatePresence>
      {visible && (
        <motion.div
          key="updating"
          {...fadeVariants}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "glass-frosted border border-border/30",
            "text-[11px] font-medium text-muted-foreground",
            "shadow-raised",
          )}
        >
          <Loader2
            className="w-3 h-3 animate-spin text-primary/70"
            aria-hidden="true"
          />
          <span>Đang cập nhật...</span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
UpdatingIndicator.displayName = "UpdatingIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION AMBIENT DECORATION
// Matches FeaturedPlaylists orb palette — wave-1 (brand violet) primary
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CHART ROW — memo'd wrapper, only re-renders when its own data changes
// ─────────────────────────────────────────────────────────────────────────────

const ChartRow = memo(
  ({
    track,
    rank,
    prevRank,
    index,
    reduced,
  }: {
    track: ChartTrack;
    rank: number;
    prevRank: number;
    index: number;
    reduced: boolean;
  }) => {
    const variants = useMemo(
      () => makeRowVariants(index, reduced),
      [index, reduced],
    );
    return (
      <motion.div key={track._id} {...variants}>
        <ChartItem track={track} rank={rank} prevRank={prevRank} />
      </motion.div>
    );
  },
);
ChartRow.displayName = "ChartRow";

// ─────────────────────────────────────────────────────────────────────────────
// TOP FEATURED TRACKS — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export const RecentlyListenedTrack = () => {
  const { data: dashboard, isLoading, error, refetch } = useProfileDashboard();
  const tracks = useMemo(() => dashboard?.recentlyPlayed || [], [dashboard]);

  /** Read prefers-reduced-motion once at orchestrator level, pass down */

  /** Stable retry — prevents ErrorState from re-rendering on unrelated state */
  const handleRetry = useCallback(() => refetch?.(), [refetch]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <section
        className="section-block section-block--alt"
        aria-labelledby="top-featured-tracks-heading"
        aria-busy="true"
      >
        <div className="section-container">
          {/* Wave-1 tinted divider — mirrors FeaturedPlaylists */}
          <div
            className="hidden lg:block h-px mb-8"
            style={{
              background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--wave-2) / 0.3) 30%,
                hsl(var(--wave-2) / 0.3) 70%,
                transparent
              )`,
              boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
            }}
          />
          <ChartHeader viewAllHref="/charts" />
          <SkeletonGrid count={TOP_N} />
        </div>
      </section>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <section
        className="section-block section-block--alt"
        aria-labelledby="top-featured-tracks-heading"
      >
        <div className="section-container">
          <div
            className="hidden lg:block h-px mb-8"
            style={{
              background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--wave-2) / 0.3) 30%,
                hsl(var(--wave-2) / 0.3) 70%,
                transparent
              )`,
              boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
            }}
          />
          <ChartHeader viewAllHref="/charts" />
          <AnimatePresence mode="wait">
            <motion.div key="error" {...slideUpVariants}>
              <ErrorState onRetry={handleRetry} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    );
  }

  // ── Populated / Empty ──────────────────────────────────────────────────────
  if (!tracks || tracks.length === 0) return null; // Don't render section at all if no data (can happen on new accounts)
  return (
    <>
      <div
        className="block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-2) / 0.3) 30%,
              hsl(var(--wave-2) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-2) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--alt relative overflow-hidden transition-colors duration-300"
        aria-labelledby="top-featured-tracks-heading"
      >
        {/* Ambient orbs — decorative depth layer */}
        <SectionAmbient style="wave-2" />

        <div className="section-container relative z-[1]">
          {/* Section header — same anatomy as PlaylistsHeader */}
          <ChartHeader viewAllHref="/chart-top" />

          {/* Track list + live-update overlay */}
          <div className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {tracks.length === 0 ? (
                <motion.div key="empty" {...slideUpVariants}>
                  <EmptyState />
                </motion.div>
              ) : (
                <TrackList tracks={tracks} isLoading={isLoading} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
};

export default RecentlyListenedTrack;
