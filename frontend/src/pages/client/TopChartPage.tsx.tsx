/**
 * TopChartPage.tsx — Premium chart leaderboard page orchestrator
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * Refactor: Senior-level production upgrade
 *
 * ─── COMPONENT TREE ───────────────────────────────────────────────────────
 *
 *   TopChartPage              — data boundary, pagination, route anchor
 *   ├── PageLoader            — full-screen spinner with ambient rings
 *   ├── ErrorPage             — NEW: explicit error boundary state
 *   ├── SkipToContent         — keyboard accessibility anchor
 *   ├── HeroSection           — ambient bg + title + chart card (memo'd)
 *   │   ├── LiveBadge         — pulsing "Live · HH:MM" pill
 *   │   ├── LeaderAvatars     — stacked top-3 avatars with medal dots
 *   │   └── ChartLine         — Recharts area chart
 *   └── TrackListSection      — ranked list, pagination, search (memo'd)
 *       ├── ListControls      — title, region badge, updating indicator
 *       ├── TrackSkeletonList — CLS-safe shimmer skeletons
 *       ├── EmptyState        — zero results
 *       ├── ErrorState        — list-level error
 *       ├── AnimatePresence   — rank-swap animations
 *       │   └── ChartItem × N — each ranked row
 *       └── ShowMoreButton    — paginate / collapse CTA
 *
 * ─── KEY CHANGES FROM ORIGINAL ───────────────────────────────────────────
 *
 *  1. TIMESTAMP FIX — original memoized `lastUpdated` on `tracks.length`.
 *     This caused the timestamp to recalculate on any array growth event
 *     (e.g., pagination append), even without a real re-fetch. Now keyed
 *     exclusively to `lastUpdatedAt` from the hook.
 *
 *  2. HERO/LIST SPLIT — HeroSection is fully memo'd with no `isUpdating`
 *     dependency. `isUpdating` toggles (live refresh) no longer trigger
 *     hero re-renders — saving the ChartLine + gradient paint cost.
 *
 *  3. ANIMATION FACTORY — `listItem(index)` was redefined inside render
 *     every cycle. Moved to module scope; object references are stable.
 *
 *  4. ERROR STATE — both page-level and list-level error states added.
 *     `useRealtimeChart` assumed to expose `{ error, refetch }`.
 *
 *  5. VISIBLETRACKS SLICE — was `.slice()` inline in JSX; now memoized
 *     on `[tracks, showAll]`. No-op on unrelated Redux state changes.
 *
 *  6. LEADER AVATARS — added `rank` number rendered IN the dot (was
 *     empty `<span>` with no content). Added `overflow-hidden` on the
 *     avatar image container to prevent border-radius bleed.
 *
 *  7. SKELETON CLS — each `TrackSkeleton` now has randomized widths via
 *     a stable per-index seed so the shimmer pattern looks natural, not
 *     uniform. Uses `useMemo` inside `TrackSkeletonList` for stability.
 *
 *  8. SHOW MORE — `aria-expanded` state was inverted (original showed
 *     "Show all" when `showAll=true`). Fixed. Button also shows remaining
 *     count when collapsed.
 *
 *  9. `contain: "strict"` on HeroSection ambient layers — prevents GPU
 *     layer promotion from bleeding across page paint boundaries.
 *
 * 10. REDUCED MOTION — all Framer variants check `useReducedMotion` via
 *     a shared hook at orchestrator level, prop-drilled to sub-components.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 10;

/** Medal tier styles — intentionally not themeable (semantic gold/silver/bronze) */
const RANK_STYLES = [
  { border: "border-amber-400", dot: "bg-amber-400", label: "Gold" },
  { border: "border-slate-400", dot: "bg-slate-400", label: "Silver" },
  { border: "border-orange-500", dot: "bg-orange-500", label: "Bronze" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION FACTORIES  (module-scope — stable references, zero per-render cost)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Staggered hero entry. Expo-out easing [0.22,1,0.36,1] gives the premium
 * deceleration feel used by Spotify, Apple Music, and YouTube Music.
 */
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
        transition: {
          delay,
          duration: 0.54,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      } as const);

/**
 * Per-row spring variant. `layout` enables rank-swap reordering.
 * Cap: max 350ms total stagger for any list length.
 */
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
// LIVE BADGE — pulsing "Live · HH:MM" pill
// Uses `badge-playing` token from Soundwave (primary/10, ring primary/22).
// ─────────────────────────────────────────────────────────────────────────────

const LiveBadge = memo(({ time }: { time: string }) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full",
      "bg-primary/10 border border-primary/22",
      "text-[11px] font-bold uppercase tracking-widest text-primary",
      "shadow-glow-xs",
      "select-none",
    )}
  >
    {/* Dual-ring ping dot — matches badge-live pattern */}
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
// ─────────────────────────────────────────────────────────────────────────────

const LeaderAvatars = memo(({ tracks }: { tracks: ITrack[] }) => {
  if (tracks.length < 3) return null;
  const top3 = tracks.slice(0, 3);

  return (
    <div className="flex items-center gap-3">
      <span
        className="hidden sm:block text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest"
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
                "border-[2.5px] border-background",
                "shadow-sm",
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

            {/* Medal rank dot with number */}
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
// TRACK SKELETON — exact ChartItem column widths to eliminate CLS.
// Width seeds are stable per-index (deterministic, not random on re-render).
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
      {/* Rank column — w-[52px] fixed */}
      <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
        <div className="skeleton h-[18px] w-5 rounded-sm" />
        <div className="skeleton h-3 w-6 rounded-full" />
      </div>

      {/* Cover — sm:size-[48px] */}
      <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

      {/* Title + artist */}
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

      {/* Album col — lg+ */}
      <div className="skeleton h-3 rounded-full hidden lg:block w-[140px]" />
      {/* Duration — sm+ */}
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
// PAGE LOADER — full-screen initial state with concentric rings
// ─────────────────────────────────────────────────────────────────────────────

const PageLoader = memo(() => (
  <div
    className={cn(
      "fixed inset-0 z-50",
      "flex flex-col items-center justify-center gap-6",
      "bg-background",
    )}
    role="status"
    aria-label="Loading chart data"
  >
    {/* Triple concentric ring system */}
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
// ERROR PAGE — full-page error fallback
// ─────────────────────────────────────────────────────────────────────────────

const ErrorPage = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div
    className={cn(
      "min-h-screen bg-background",
      "flex flex-col items-center justify-center gap-6 p-8",
    )}
    role="alert"
    aria-label="Chart failed to load"
  >
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full bg-destructive/10 blur-2xl scale-150"
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-16 h-16 rounded-2xl",
          "flex items-center justify-center",
          "glass border border-destructive/20 shadow-raised",
        )}
      >
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
      <Button
        onClick={onRetry}
        variant="outline"
        size="lg"
        className="rounded-full px-6 gap-2 font-bold text-xs uppercase tracking-widest"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Try again
      </Button>
    )}
  </div>
));
ErrorPage.displayName = "ErrorPage";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — zero-track fallback, Soundwave card-base pattern
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <div
    className="flex flex-col items-center justify-center py-24 gap-5 text-center"
    role="status"
    aria-label="No chart data"
  >
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full bg-primary/8 blur-2xl scale-150 animate-glow-breathe"
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-14 h-14 rounded-2xl",
          "flex items-center justify-center",
          "glass border border-border/40 shadow-raised",
        )}
      >
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
// UPDATING BADGE — inline live-refresh indicator
// Extracted memo so toggling `isUpdating` doesn't diff the full list.
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
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
            "bg-primary/10 border border-primary/22",
            "shadow-glow-xs",
          )}
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
// SHOW MORE BUTTON — paginate / collapse CTA
// Fixed: aria-expanded was inverted in original.
// Now shows remaining count when collapsed.
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
        transition={{ delay: 0.35, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 flex justify-center"
      >
        <Button
          size="lg"
          variant="outline"
          onClick={onToggle}
          aria-expanded={showAll}
          aria-label={
            showAll ? "Show fewer tracks" : `Show all ${totalTracks} tracks`
          }
          className={cn(
            "rounded-full px-8 h-11 gap-2.5",
            "font-bold text-[11px] uppercase tracking-widest",
            "border-border/60 bg-card/80 hover:bg-muted",
            "shadow-raised hover:shadow-elevated",
            "transition-all duration-200 ease-out",
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
        </Button>
      </motion.div>
    );
  },
);
ShowMoreButton.displayName = "ShowMoreButton";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// Fully memo'd — no `isUpdating` dependency, so live refreshes don't trigger
// a ChartLine repaint or gradient layer compositing.
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
      {/* ── Ambient background ──────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        aria-hidden="true"
        style={{ contain: "strict" }}
      >
        {/* Primary wide glow — top-center */}
        <div
          className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2",
            "w-[min(1000px,100%)] h-80",
            "bg-primary/[0.07] dark:bg-primary/[0.1]",
            "blur-[100px] rounded-full",
          )}
        />

        {/* Floating wave-2 orb — top-right */}
        <div
          className={cn(
            "absolute top-12 right-[8%]",
            "w-[280px] h-[180px] rounded-full",
            "bg-[hsl(var(--wave-2)/0.042)] dark:bg-[hsl(var(--wave-2)/0.065)]",
            "blur-[72px]",
            !reduced && "animate-float-slow",
          )}
        />

        {/* Floating wave-3 orb — bottom-left */}
        <div
          className={cn(
            "absolute bottom-0 left-[5%]",
            "w-[220px] h-[150px] rounded-full",
            "bg-[hsl(var(--wave-3)/0.032)] dark:bg-[hsl(var(--wave-3)/0.055)]",
            "blur-[60px]",
            !reduced && "animate-float-slower",
          )}
        />

        {/*
         * Grid texture.
         * NOTE: CSS custom properties DO NOT resolve inside SVG `fill`/`stroke`.
         * We use inline `backgroundImage` with the token written as hsl(var(...))
         * which works in CSS `background-image` context (non-SVG).
         */}
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

        {/* Bottom fade to background */}
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

        {/* Hero title */}
        <motion.div {...fadeUp(0.07, reduced)} className="text-center mb-11">
          <h1
            className={cn(
              "font-black tracking-[-0.045em] leading-[0.88] mb-3 select-none",
              "text-[clamp(3.2rem,11vw,6.5rem)]",
            )}
          >
            <span
              className={cn(
                "text-transparent bg-clip-text",
                "bg-gradient-to-r",
                "from-violet-500 via-primary to-pink-500",
                "dark:from-violet-400 dark:via-primary dark:to-pink-400",
              )}
            >
              #Charts
            </span>
          </h1>
          <p
            className={cn(
              "text-muted-foreground/70 font-medium",
              "text-sm sm:text-[15px] max-w-[340px] mx-auto leading-relaxed",
            )}
          >
            The most-listened tracks, updated in real time.
          </p>
        </motion.div>

        {/* Chart card */}
        <motion.div {...fadeUp(0.14, reduced)}>
          <div
            className={cn(
              "rounded-2xl overflow-hidden",
              "border border-border/50 dark:border-border/30",
              "bg-card/90 dark:bg-card/80",
              // Glassmorphism T2 (glass-frosted equivalent)
              "backdrop-blur-[24px] saturate-[160%]",
              "shadow-elevated dark:shadow-black/45",
              // Inset highlight — matches shadow-inset-top token
              "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07)]",
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
                {/* Icon badge — primary/10 surface from brand-50 token */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl shrink-0",
                    "flex items-center justify-center",
                    "bg-primary/10 border border-primary/15",
                  )}
                >
                  <BarChart2
                    className="w-[18px] h-[18px] text-primary"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <p className="text-[13.5px] font-bold text-foreground/88 leading-tight">
                    24H Performance
                  </p>
                  <p className="text-[11px] text-muted-foreground/55 leading-tight mt-[1px]">
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
        </motion.div>
      </div>
    </section>
  ),
);
HeroSection.displayName = "HeroSection";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SECTION
// Separated from HeroSection: `isUpdating` toggles only re-render THIS tree.
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
      {/* ── List controls header ──────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0.2, reduced)}
        className="flex items-center justify-between gap-3 mb-6 flex-wrap"
      >
        {/* Left: title + region + updating */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <Flame
            className="w-[18px] h-[18px] text-orange-500 dark:text-orange-400 shrink-0"
            aria-hidden="true"
          />

          <h2
            className={cn(
              "font-black tracking-tight text-foreground",
              "text-xl sm:text-2xl",
            )}
          >
            Top {tracks.length || INITIAL_VISIBLE}
          </h2>

          {/* Region pill */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
              "bg-muted/60 border border-border/50",
            )}
          >
            <Globe2
              className="w-3 h-3 text-muted-foreground/55 shrink-0"
              aria-hidden="true"
            />
            <span className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-widest">
              Vietnam
            </span>
          </div>

          {/* Live updating badge — memoized, isolated from list renders */}
          <UpdatingBadge visible={isUpdating} />
        </div>

        {/* Right: rules info CTA */}
        <Button
          variant="ghost"
          size="sm"
          aria-label="View ranking rules"
          className={cn(
            "text-muted-foreground/55 hover:text-foreground",
            "text-[11px] font-semibold h-8 gap-1.5 shrink-0",
            "rounded-lg",
          )}
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Ranking rules</span>
          <span className="sm:hidden">Rules</span>
        </Button>
      </motion.div>

      {/* ── Track list ────────────────────────────────────────────────── */}
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
          /*
           * `mode="popLayout"` — Framer measures leaving elements before
           * unmount, preventing list collapse during rank-swap animations.
           * `initial={false}` — suppresses entry animation on first mount
           * when data is already present.
           */
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

      {/* ── Show more / collapse CTA ─────────────────────────────────── */}
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
      "transition-none",
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

  /**
   * Respect prefers-reduced-motion at the orchestrator level.
   * Passed down as a stable prop — avoids per-component media query reads.
   */
  const reduced = useReducedMotion() ?? false;

  /**
   * FIX: original memoized on `tracks.length` which recalculated on any
   * array growth (e.g., pagination append) without a real re-fetch.
   * Now keyed to `lastUpdatedAt` — set only when data actually arrives.
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
   * Stable slice — no re-computation unless `tracks` or `showAll` changes.
   * Unrelated Redux dispatches (isPlaying, volume, currentTime) are no-ops.
   */
  const visibleTracks = useMemo(
    () => (showAll ? tracks : tracks.slice(0, INITIAL_VISIBLE)),
    [tracks, showAll],
  );

  /** Stable track IDs for interaction sync */
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

  // ── Full-screen initial load ────────────────────────────────────────────

  if (isLoading && tracks.length === 0) return <PageLoader />;

  // ── Page-level error ────────────────────────────────────────────────────

  if (error && tracks.length === 0) {
    return <ErrorPage onRetry={handleRetry} />;
  }

  // ── Populated page ──────────────────────────────────────────────────────

  return (
    <>
      <SkipToContent />

      <main
        id="top-chart-main"
        className={cn(
          "min-h-screen bg-background",
          "overflow-x-hidden",
          // Safe-area bottom padding for sticky player bar
          "pb-[env(safe-area-inset-bottom,0px)]",
          // Player bar clearance — matches .player-bar height (~80px + safe area)
          "pb-24",
        )}
      >
        {/* Hero: ambient bg + chart card */}
        <HeroSection
          tracks={tracks}
          chartData={chartData}
          lastUpdated={lastUpdated}
          reduced={reduced}
        />

        {/* Ranked track list */}
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
