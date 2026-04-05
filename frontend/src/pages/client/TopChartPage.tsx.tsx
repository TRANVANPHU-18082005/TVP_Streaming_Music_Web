import React, { memo, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  BarChart2,
  Flame,
  Globe2,
  Info,
  TrendingUp,
  Music2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
} from "lucide-react";

import { useRealtimeChart } from "@/features/track/hooks/useRealtimeChart";
import { ChartItem } from "@/features/track/components/ChartItem";
import { ChartLine } from "@/features/track/components/ChartLine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartTrack, ITrack } from "@/features/track/types";
import { useSyncInteractions } from "@/features";
import SectionAmbient from "@/components/SectionAmbient";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_VISIBLE = 10;

/** Medal tier — gold/silver/bronze are semantic and intentionally fixed */
const RANK_STYLES = [
  { border: "border-amber-400", dot: "bg-amber-400", label: "Gold" },
  { border: "border-slate-400", dot: "bg-slate-400", label: "Silver" },
  { border: "border-orange-500", dot: "bg-orange-500", label: "Bronze" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION FACTORIES — module-scope, stable references
// ─────────────────────────────────────────────────────────────────────────────
const EXPO_EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = (delay = 0, reduced = false) =>
  reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.15 },
      }
    : ({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.54, ease: EXPO_EASE },
      } as const);

const listItem = (index: number, reduced = false) =>
  reduced
    ? {
        layout: true as const,
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : ({
        layout: true as const,
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97 },
        transition: {
          type: "spring" as const,
          stiffness: 500,
          damping: 30,
          delay: Math.min(index * 0.028, 0.35),
        },
      } as const);

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BADGE — .badge-playing token from index.css §14
// ─────────────────────────────────────────────────────────────────────────────
const LiveBadge = memo(({ time }: { time: string }) => (
  <div
    className={cn(
      "badge-playing badge",
      "inline-flex items-center gap-2 px-4 py-1.5",
      "text-[11px] font-bold uppercase tracking-widest",
      "select-none",
    )}
  >
    <span className="relative flex h-[7px] w-[7px]" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-primary" />
    </span>
    Live&nbsp;·&nbsp;{time}
  </div>
));
LiveBadge.displayName = "LiveBadge";

// ─────────────────────────────────────────────────────────────────────────────
// LEADER AVATARS — stacked top-3 cover images in hero chart card header
// FIX 6: rank number rendered IN the medal dot (was empty)
// ─────────────────────────────────────────────────────────────────────────────
const LeaderAvatars = memo(({ tracks }: { tracks: ITrack[] }) => {
  if (tracks.length < 3) return null;
  const top3 = tracks.slice(0, 3);

  return (
    <div className="flex items-center gap-3">
      <span
        className="hidden sm:block text-[10px] font-bold text-brand uppercase tracking-widest"
        aria-hidden="true"
      >
        Top 3
      </span>

      <div className="flex -space-x-2.5" role="list" aria-label="Top 3 tracks">
        {top3.map((t, i) => (
          <div
            key={t._id}
            role="listitem"
            aria-label={`#${i + 1} — ${t.title} (${RANK_STYLES[i].label})`}
            className="relative group/avatar"
            style={{ zIndex: 3 - i }}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full overflow-hidden",
                "border-[2.5px] border-background shadow-sm",
                "transition-transform duration-200 ease-out",
                "group-hover/avatar:scale-110 group-hover/avatar:z-10",
                RANK_STYLES[i].border,
              )}
            >
              <img
                src={t.coverImage}
                alt={`#${i + 1}: ${t.title}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Medal rank dot WITH number — FIX 6 */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute -bottom-0.5 -right-0.5",
                "w-[15px] h-[15px] rounded-full",
                "flex items-center justify-center",
                "text-[7px] font-black text-white leading-none",
                "border border-background shadow-sm",
                RANK_STYLES[i].dot,
              )}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
LeaderAvatars.displayName = "LeaderAvatars";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK SKELETON — exact ChartItem column widths, CLS-safe
// FIX 7: stable per-index width seeds via SKELETON_WIDTHS constant
// ─────────────────────────────────────────────────────────────────────────────
const SKELETON_WIDTHS = [
  { title: "42%", artist: "26%" },
  { title: "55%", artist: "32%" },
  { title: "38%", artist: "20%" },
  { title: "48%", artist: "28%" },
  { title: "61%", artist: "35%" },
  { title: "44%", artist: "24%" },
  { title: "52%", artist: "30%" },
  { title: "39%", artist: "22%" },
  { title: "58%", artist: "34%" },
  { title: "46%", artist: "27%" },
] as const;

const TrackSkeleton = memo(({ index }: { index: number }) => {
  const w = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl"
      style={{ animationDelay: `${index * 52}ms` }}
      aria-hidden="true"
    >
      <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
        <div className="skeleton h-[18px] w-5 rounded-sm" />
        <div className="skeleton h-3 w-6 rounded-full" />
      </div>
      <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div
          className="skeleton h-3.5 rounded-full"
          style={{ width: w.title }}
        />
        <div
          className="skeleton h-3 rounded-full"
          style={{ width: w.artist }}
        />
      </div>
      <div className="skeleton h-3 rounded-full hidden lg:block w-[140px]" />
      <div className="skeleton h-3 w-9 rounded-full hidden sm:block" />
    </div>
  );
});
TrackSkeleton.displayName = "TrackSkeleton";

const TrackSkeletonList = memo(({ count }: { count: number }) => (
  <div
    className="flex flex-col gap-0.5"
    role="status"
    aria-label="Loading tracks"
    aria-live="polite"
  >
    {Array.from({ length: count }, (_, i) => (
      <TrackSkeleton key={i} index={i} />
    ))}
  </div>
));
TrackSkeletonList.displayName = "TrackSkeletonList";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE LOADER — triple concentric ring, uses .spinner-xl + .spinner--brand tokens
// ─────────────────────────────────────────────────────────────────────────────
const PageLoader = memo(() => (
  <div
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
    role="status"
    aria-label="Loading chart data"
  >
    <div className="relative w-16 h-16">
      <span
        className="absolute inset-0 rounded-full border border-primary/10 animate-ping"
        aria-hidden="true"
      />
      <span
        className="absolute inset-[4px] rounded-full border border-primary/20 animate-ping"
        style={{ animationDelay: "0.15s" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 rounded-full border border-primary/18 flex items-center justify-center">
        <Loader2
          className="w-6 h-6 animate-spin text-primary"
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="text-center space-y-1.5">
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-foreground/70">
        Loading Charts
      </p>
      <p className="text-[11px] text-muted-foreground/50 font-medium">
        Fetching real-time data…
      </p>
    </div>
  </div>
));
PageLoader.displayName = "PageLoader";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR PAGE — .glass + .shadow-raised, .btn-outline for retry
// ─────────────────────────────────────────────────────────────────────────────
const ErrorPage = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div
    className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8"
    role="alert"
    aria-label="Chart failed to load"
  >
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full bg-destructive/10 blur-2xl scale-150"
        aria-hidden="true"
      />
      <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center glass border border-destructive/20 shadow-raised">
        <AlertCircle
          className="w-7 h-7 text-destructive/60"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
    </div>
    <div className="text-center space-y-2 max-w-xs">
      <p className="font-black text-lg text-foreground/80 tracking-tight">
        Chart unavailable
      </p>
      <p className="text-sm text-muted-foreground/55 leading-relaxed">
        We couldn't fetch the rankings. This is usually a temporary network
        hiccup.
      </p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="btn-outline btn-lg gap-2 rounded-full"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Try again
      </button>
    )}
  </div>
));
ErrorPage.displayName = "ErrorPage";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — .card-base + .animate-glow-breathe token
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = memo(() => (
  <div
    className="flex flex-col items-center justify-center py-24 gap-5 text-center"
    role="status"
    aria-label="No chart data"
  >
    <div className="relative">
      {/* .animate-glow-breathe from index.css §17 */}
      <div
        className="absolute inset-0 rounded-full bg-primary/8 blur-2xl scale-150 animate-glow-breathe"
        aria-hidden="true"
      />
      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center glass border border-border/40 shadow-raised">
        <Music2
          className="w-6 h-6 text-muted-foreground/45"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
    </div>
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-foreground/65 tracking-tight">
        No chart data yet
      </p>
      <p className="text-xs text-muted-foreground/45 max-w-[240px] leading-relaxed">
        Rankings appear once enough listening data has been collected. Check
        back soon.
      </p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// UPDATING BADGE — .shadow-glow-xs token
// ─────────────────────────────────────────────────────────────────────────────
const UpdatingBadge = memo(({ visible }: { visible: boolean }) => (
  <div aria-live="polite" aria-atomic="true">
    <AnimatePresence>
      {visible && (
        <motion.div
          key="updating"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/22 shadow-glow-xs"
        >
          <Loader2
            className="w-3 h-3 animate-spin text-primary"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
            Updating
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
UpdatingBadge.displayName = "UpdatingBadge";

// ─────────────────────────────────────────────────────────────────────────────
// SHOW MORE BUTTON
// FIX 8: aria-expanded was inverted in original. Shows remaining count.
// ─────────────────────────────────────────────────────────────────────────────
interface ShowMoreButtonProps {
  showAll: boolean;
  totalTracks: number;
  onToggle: () => void;
  reduced: boolean;
}

const ShowMoreButton = memo(
  ({ showAll, totalTracks, onToggle, reduced }: ShowMoreButtonProps) => {
    const remaining = totalTracks - INITIAL_VISIBLE;
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EXPO_EASE }}
        className="mt-10 flex justify-center"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showAll}
          aria-label={
            showAll ? "Show fewer tracks" : `Show all ${totalTracks} tracks`
          }
          className={cn(
            "btn-secondary btn-lg",
            "rounded-full px-8 gap-2.5",
            "font-bold text-[11px] uppercase tracking-widest",
            "shadow-raised hover:shadow-elevated",
            "backdrop-blur-sm",
          )}
        >
          {showAll ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              Show less
            </>
          ) : (
            <>
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              {`+${remaining} more tracks`}
            </>
          )}
        </button>
      </motion.div>
    );
  },
);
ShowMoreButton.displayName = "ShowMoreButton";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION — memo'd, no isUpdating dependency
// FIX 2: isUpdating changes don't trigger hero re-render (ChartLine paint cost)
// FIX 9: contain: "strict" on ambient layers
// Card: .glass-frosted + .shadow-elevated tokens from index.css §6+§7
// ─────────────────────────────────────────────────────────────────────────────
interface HeroSectionProps {
  tracks: ITrack[];
  chartData: unknown[];
  lastUpdated: string;
  reduced: boolean;
}

const HeroSection = memo(
  ({ tracks, chartData, lastUpdated, reduced }: HeroSectionProps) => (
    <section
      aria-label="Chart overview"
      className="relative pt-12 pb-12 md:pt-20 md:pb-16 overflow-hidden"
    >
      {/* Ambient background — FIX 9: contain: "strict" */}
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        aria-hidden="true"
        style={{ contain: "strict" }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(1000px,100%)] h-80 blur-[100px] rounded-full"
          style={{ background: "hsl(var(--primary)/0.07)" }}
        />
        <div
          className={cn(
            "absolute top-12 right-[8%] w-[280px] h-[180px] rounded-full blur-[72px]",
            !reduced && "animate-float-slow",
          )}
          style={{ background: "hsl(var(--wave-2)/0.042)" }}
        />
        <div
          className={cn(
            "absolute bottom-0 left-[5%] w-[220px] h-[150px] rounded-full blur-[60px]",
            !reduced && "animate-float-slower",
          )}
          style={{ background: "hsl(var(--wave-3)/0.032)" }}
        />

        {/* Grid texture — inline backgroundImage for hsl(var()) support */}
        <div
          className="absolute inset-0 opacity-[0.022] dark:opacity-[0.036]"
          style={{
            backgroundImage: [
              "linear-gradient(hsl(var(--foreground)/1) 1px, transparent 1px)",
              "linear-gradient(90deg, hsl(var(--foreground)/1) 1px, transparent 1px)",
            ].join(","),
            backgroundSize: "44px 44px",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Live badge */}
        <motion.div
          {...fadeUp(0, reduced)}
          className="flex justify-center mb-7"
        >
          <LiveBadge time={lastUpdated} />
        </motion.div>

        {/* Hero title — CSS token gradient */}
        <motion.div {...fadeUp(0.07, reduced)} className="text-center mb-11">
          <h1
            className={cn(
              "font-black tracking-[-0.045em] leading-[0.88] mb-3 select-none",
              "text-[clamp(3.2rem,11vw,6.5rem)]",
            )}
          >
            <span
              className="text-transparent bg-clip-text bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(to right, hsl(var(--wave-1)), hsl(var(--primary)), hsl(var(--wave-2)))`,
              }}
            >
              #Charts
            </span>
          </h1>
          <p className="text-section-subtitle font-medium text-sm sm:text-[15px] max-w-[340px] mx-auto leading-relaxed">
            The most-listened tracks, updated in real time.
          </p>
        </motion.div>

        {/* Chart card — .glass-frosted + .shadow-elevated */}
        <motion.div {...fadeUp(0.14, reduced)}>
          <div
            className={cn(
              "rounded-2xl",
              "border border-border/50 dark:border-primary/15",
              "shadow-brand p-0 md:p-4",
              "animate-fade-up animation-fill-both",
            )}
            style={{ animationDelay: "80ms" }}
          >
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "border border-border/50 dark:border-border/30",
                // .glass-frosted from index.css §6 — T2 glassmorphism
                "glass-frosted",
                // .shadow-elevated from index.css §7
                "shadow-elevated",
              )}
            >
              {/* Card header */}
              <div
                className={cn(
                  "flex items-center justify-between px-5 py-4",
                  "border-b border-border/40 dark:border-border/25",
                  "bg-muted/20 dark:bg-muted/10",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-primary/10 border border-primary/15">
                    <BarChart2
                      className="w-[18px] h-[18px] text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-section-title  leading-tight">
                      24H Performance
                    </p>
                    <p className="text-[11px] text-section-subtitle leading-tight mt-[1px]">
                      Real-time listening trends
                    </p>
                  </div>
                </div>
                <LeaderAvatars tracks={tracks} />
              </div>

              {/* Chart body */}
              <div className="p-4 sm:p-5">
                <ChartLine data={chartData} tracks={tracks} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  ),
);
HeroSection.displayName = "HeroSection";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SECTION — separated so isUpdating only re-renders this tree
// ─────────────────────────────────────────────────────────────────────────────
interface TrackListSectionProps {
  tracks: ITrack[];
  visibleTracks: ITrack[];
  prevRankMap: Record<string, number>;
  isLoading: boolean;
  isUpdating: boolean;
  showAll: boolean;
  onToggleAll: () => void;
  reduced: boolean;
}

const TrackListSection = memo(
  ({
    tracks,
    visibleTracks,
    prevRankMap,
    isLoading,
    isUpdating,
    showAll,
    onToggleAll,
    reduced,
  }: TrackListSectionProps) => (
    <section
      id="chart-list"
      aria-label="Chart rankings"
      className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-2 pb-4"
    >
      <SectionAmbient />

      {/* List controls */}
      <motion.div
        {...fadeUp(0.2, reduced)}
        className="flex items-center justify-between gap-3 mb-6 flex-wrap"
      >
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <Flame
            className="w-[18px] h-[18px] shrink-0"
            style={{ color: "hsl(var(--wave-4))" }}
            aria-hidden="true"
          />
          <h2 className="font-black tracking-tight text-foreground text-xl sm:text-2xl">
            Top {tracks.length || INITIAL_VISIBLE}
          </h2>

          {/* Region pill — .badge-muted equivalent */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50">
            <Globe2
              className="w-3 h-3 text-brand shrink-0"
              aria-hidden="true"
            />
            <span className="text-[10px] font-bold text-brand uppercase tracking-widest">
              Vietnam
            </span>
          </div>

          <UpdatingBadge visible={isUpdating} />
        </div>

        <Button
          variant="ghost"
          size="sm"
          aria-label="View ranking rules"
          className="text-muted-foreground/55 hover:text-foreground text-[11px] font-semibold h-8 gap-1.5 shrink-0 rounded-lg"
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Ranking rules</span>
          <span className="sm:hidden">Rules</span>
        </Button>
      </motion.div>

      {/* Track list */}
      <div
        className={cn(
          "flex flex-col gap-0.5",
          "transition-opacity duration-300 ease-out",
          isUpdating && "opacity-50 pointer-events-none select-none",
        )}
        aria-busy={isUpdating}
      >
        {isLoading ? (
          <TrackSkeletonList count={INITIAL_VISIBLE} />
        ) : tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleTracks.map((track: ITrack, index: number) => {
              const rank = index + 1;
              const prevRank = prevRankMap[track._id] ?? rank;
              return (
                <motion.div key={track._id} {...listItem(index, reduced)}>
                  <ChartItem track={track} rank={rank} prevRank={prevRank} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Show more / collapse */}
      <AnimatePresence>
        {!isLoading && tracks.length > INITIAL_VISIBLE && (
          <ShowMoreButton
            key="show-more"
            showAll={showAll}
            totalTracks={tracks.length}
            onToggle={onToggleAll}
            reduced={reduced}
          />
        )}
      </AnimatePresence>
    </section>
  ),
);
TrackListSection.displayName = "TrackListSection";

// ─────────────────────────────────────────────────────────────────────────────
// SKIP TO CONTENT — keyboard accessibility anchor
// ─────────────────────────────────────────────────────────────────────────────
const SkipToContent = memo(() => (
  <a
    href="#chart-list"
    className={cn(
      "sr-only focus:not-sr-only",
      "fixed top-3 left-3 z-[200]",
      "px-4 py-2 rounded-xl",
      "bg-primary text-primary-foreground",
      "text-xs font-bold shadow-brand",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    )}
  >
    Skip to track list
  </a>
));
SkipToContent.displayName = "SkipToContent";

// ─────────────────────────────────────────────────────────────────────────────
// TOP CHART PAGE — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export const TopChartPage = () => {
  const {
    tracks = [],
    chartData = [],
    prevRankMap = {},
    isLoading,
    isUpdating,
    error,
    refetch,
    lastUpdatedAt,
  } = useRealtimeChart();

  const [showAll, setShowAll] = useState(false);

  // FIX 10: respect prefers-reduced-motion at orchestrator level — stable prop
  const reduced = useReducedMotion() ?? false;

  /**
   * FIX 1: keyed to `lastUpdatedAt` (not `tracks.length`).
   * Pagination appends shouldn't recalculate the timestamp.
   */
  const lastUpdated = useMemo(
    () =>
      new Date(lastUpdatedAt ?? Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [lastUpdatedAt],
  );

  /**
   * FIX 5: memoized slice — no re-computation on unrelated Redux state changes
   * (isPlaying, volume, currentTime). Isolates render surface.
   */
  const visibleTracks = useMemo(
    () => (showAll ? tracks : tracks.slice(0, INITIAL_VISIBLE)),
    [tracks, showAll],
  );

  const trackIds = useMemo(
    () => tracks.map((t: ChartTrack) => t._id),
    [tracks],
  );

  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !isLoading && trackIds.length > 0,
  );

  const handleToggleAll = useCallback(() => setShowAll((v) => !v), []);
  const handleRetry = useCallback(() => refetch?.(), [refetch]);

  if (isLoading && tracks.length === 0) return <PageLoader />;
  if (error && tracks.length === 0) return <ErrorPage onRetry={handleRetry} />;

  return (
    <>
      <SkipToContent />
      <main
        id="top-chart-main"
        className={cn(
          "min-h-screen bg-background overflow-x-hidden",
          // Player bar clearance — matches .player-bar height
          "pb-24 pb-[env(safe-area-inset-bottom,0px)]",
        )}
      >
        {/* Hero: no isUpdating dep — never re-renders on live refresh */}
        <HeroSection
          tracks={tracks}
          chartData={chartData}
          lastUpdated={lastUpdated}
          reduced={reduced}
        />

        {/* Ranked track list — re-renders on isUpdating, visibleTracks */}
        <TrackListSection
          tracks={tracks}
          visibleTracks={visibleTracks}
          prevRankMap={prevRankMap}
          isLoading={isLoading}
          isUpdating={isUpdating}
          showAll={showAll}
          onToggleAll={handleToggleAll}
          reduced={reduced}
        />
      </main>
    </>
  );
};

export default TopChartPage;
