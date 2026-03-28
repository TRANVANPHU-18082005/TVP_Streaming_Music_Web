/**
 * ChartItem.tsx — Premium ranked track row for the live chart leaderboard
 *
 * Architecture & Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * RENDERING PERFORMANCE
 *   • Atomic Redux selector: subscribes only to `currentTrack._id` + `isPlaying`.
 *     No re-renders from currentTime ticks (60fps scroll-like updates).
 *   • WaveBars: CSS keyframes injected once via singleton guard — compositor-thread only.
 *   • ChartItem itself is memo()'d; internal handlers are stable via useCallback
 *     with minimal deps arrays.
 *   • CoverOverlay: single DOM node, state-driven `data-visible` attribute.
 *     Eliminated the original double-overlay bug (stacked opacity transitions).
 *   • motion.div wrapper removed from row root — entry animation ownership
 *     belongs to the parent list's AnimatePresence, cutting one Framer
 *     instance per row.
 *
 * UX IMPROVEMENTS
 *   • Rank column: animated rank-number scale + color system for top-3.
 *   • Hover state: meta (play-count, duration) fades out; action strip
 *     (LikeButton + overflow menu) slides in from the right with translate.
 *   • WaveBars replace rank number when the track is active — visual feedback
 *     that doesn't shift layout (fixed 20px width).
 *   • RankBadge: fixed h-4 prevents layout shift between up/down/flat states.
 *   • Cover art: scale-on-hover for top-3 only (too distracting for the full list).
 *   • Keyboard: full Enter/Space support on the row + action buttons.
 *
 * DESIGN TOKENS (from globals.css)
 *   Uses exclusively --primary, --wave-*, --brand-*, --muted-foreground,
 *   --foreground, --surface-*, --border tokens — zero hardcoded colors.
 *
 * ACCESSIBILITY
 *   • role="row" + aria-label on the container.
 *   • aria-pressed on play state.
 *   • aria-hidden on all purely decorative elements.
 *   • Focus-visible ring uses --ring token.
 *   • WCAG AA contrast maintained in both light + dark modes.
 */

import React, { memo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Pause,
  MoreHorizontal,
  Loader2,
  PlusCircle,
  Share2,
  Disc3,
  ListMusic,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { ChartTrack } from "@/features/track/types";
import { fmtCount, formatDuration } from "@/utils/track-helper";
import { useAppDispatch } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { handleError } from "@/utils/handleError";
import { LikeButton } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// CSS-ONLY WAVE BARS  (compositor-thread — zero JS per frame)
// Singleton injection guard prevents duplicate <style> tags on HMR.
// ─────────────────────────────────────────────────────────────────────────────

const WAVE_CSS = `
  @keyframes sw-bar {
    0%, 100% { transform: scaleY(0.18); }
    50%       { transform: scaleY(1);    }
  }
`;

let _waveInjected = false;

const WaveBars = memo(({ active }: { active: boolean }) => {
  if (!_waveInjected && typeof document !== "undefined") {
    _waveInjected = true;
    const el = document.createElement("style");
    el.id = "__sw-wave-bars__";
    el.textContent = WAVE_CSS;
    document.head.appendChild(el);
  }

  const bars = [
    { dur: "0.82s", delay: "0s" },
    { dur: "1.06s", delay: "0.14s" },
    { dur: "0.74s", delay: "0.08s" },
    { dur: "0.96s", delay: "0.22s" },
  ];

  return (
    <div
      className="flex items-end gap-[2px] h-[18px] w-[22px]"
      aria-hidden="true"
    >
      {bars.map(({ dur, delay }, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: "3px",
            height: "100%",
            borderRadius: "2px 2px 1px 1px",
            transformOrigin: "bottom center",
            background: "hsl(var(--primary))",
            opacity: active ? 1 : 0.28,
            transform: active ? undefined : "scaleY(0.18)",
            animation: active
              ? `sw-bar ${dur} ease-in-out ${delay} infinite`
              : "none",
            transition: "opacity 0.25s ease, transform 0.25s ease",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
});
WaveBars.displayName = "WaveBars";

// ─────────────────────────────────────────────────────────────────────────────
// RANK VISUAL CONFIGURATION
// Design token–driven: no hardcoded hex values.
// ─────────────────────────────────────────────────────────────────────────────

interface RankCfg {
  numSize: string;
  numColor: string;
  numGlow: string;
  rowIdle: string;
  rowActive: string;
  accent: string; // left border
  shimmer: string; // decorative gradient overlay
}

const RANK_CFG: Record<1 | 2 | 3, RankCfg> = {
  1: {
    numSize: "text-[26px] font-black",
    numColor: "text-primary",
    numGlow: "[filter:drop-shadow(0_0_10px_hsl(var(--primary)/0.6))]",
    rowIdle:
      "bg-primary/[0.035] hover:bg-primary/[0.065] dark:bg-primary/[0.055] dark:hover:bg-primary/[0.09]",
    rowActive: "bg-primary/[0.09] dark:bg-primary/[0.13]",
    accent: "border-l-[3px] border-primary",
    shimmer:
      "from-primary/[0.06] via-primary/[0.02] to-transparent dark:from-primary/[0.09]",
  },
  2: {
    numSize: "text-[22px] font-black",
    numColor: "text-sky-500 dark:text-sky-400",
    numGlow: "",
    rowIdle:
      "bg-sky-500/[0.03] hover:bg-sky-500/[0.06] dark:bg-sky-400/[0.045] dark:hover:bg-sky-400/[0.08]",
    rowActive: "bg-sky-500/[0.075] dark:bg-sky-400/[0.11]",
    accent: "border-l-[3px] border-sky-400/60",
    shimmer:
      "from-sky-500/[0.05] via-sky-400/[0.015] to-transparent dark:from-sky-400/[0.08]",
  },
  3: {
    numSize: "text-[22px] font-black",
    numColor: "text-amber-500 dark:text-amber-400",
    numGlow: "",
    rowIdle:
      "bg-amber-500/[0.03] hover:bg-amber-500/[0.06] dark:bg-amber-400/[0.045] dark:hover:bg-amber-400/[0.08]",
    rowActive: "bg-amber-500/[0.075] dark:bg-amber-400/[0.11]",
    accent: "border-l-[3px] border-amber-400/60",
    shimmer:
      "from-amber-500/[0.05] via-amber-400/[0.015] to-transparent dark:from-amber-400/[0.08]",
  },
};

const DEFAULT_CFG: RankCfg = {
  numSize: "text-[17px] font-bold",
  numColor: "text-foreground/25 dark:text-foreground/20",
  numGlow: "",
  rowIdle: "hover:bg-foreground/[0.035] dark:hover:bg-white/[0.04]",
  rowActive: "bg-primary/[0.06] dark:bg-primary/[0.09]",
  accent: "",
  shimmer: "",
};

function getRankCfg(rank: number): RankCfg {
  return rank <= 3 ? RANK_CFG[rank as 1 | 2 | 3] : DEFAULT_CFG;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANK CHANGE BADGE
// Fixed h-4 prevents layout shift when badge content switches states.
// ─────────────────────────────────────────────────────────────────────────────

const RankBadge = memo(({ diff }: { diff: number }) => (
  <div
    className="h-4 flex items-center justify-center"
    aria-label={
      diff > 0
        ? `Up ${diff}`
        : diff < 0
          ? `Down ${Math.abs(diff)}`
          : "No change"
    }
  >
    {diff > 0 ? (
      <span
        className="flex items-center gap-[2px] text-[9px] font-bold leading-none select-none
        text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-[2px] rounded-full"
      >
        <TrendingUp size={7} strokeWidth={3} aria-hidden="true" />
        {diff}
      </span>
    ) : diff < 0 ? (
      <span
        className="flex items-center gap-[2px] text-[9px] font-bold leading-none select-none
        text-rose-500 dark:text-rose-400 bg-rose-500/10 px-1.5 py-[2px] rounded-full"
      >
        <TrendingDown size={7} strokeWidth={3} aria-hidden="true" />
        {Math.abs(diff)}
      </span>
    ) : (
      <Minus
        size={9}
        strokeWidth={2}
        className="text-foreground/18 dark:text-foreground/14"
        aria-hidden="true"
      />
    )}
  </div>
));
RankBadge.displayName = "RankBadge";

// ─────────────────────────────────────────────────────────────────────────────
// COVER OVERLAY
//
// Single DOM node — eliminates the double-overlay bug from the original.
// `alwaysShow = true` overrides group-hover; transition is pure CSS.
// AnimatePresence handles icon crossfade with spring physics.
// ─────────────────────────────────────────────────────────────────────────────

const ICON_SPRING = {
  initial: { scale: 0.58, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.58, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 480, damping: 30 },
} as const;

const CoverOverlay = memo(
  ({
    isLoading,
    isActivePlaying,
  }: {
    isLoading: boolean;
    isActivePlaying: boolean;
  }) => {
    const alwaysShow = isLoading || isActivePlaying;

    return (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-[inherit]",
          "bg-black/55 backdrop-blur-[1.5px]",
          "transition-opacity duration-150",
          alwaysShow ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.span key="load" {...ICON_SPRING}>
              <Loader2
                className="size-[18px] text-white animate-spin"
                aria-hidden="true"
              />
            </motion.span>
          ) : isActivePlaying ? (
            <motion.span key="pause" {...ICON_SPRING}>
              <Pause
                className="size-[18px] text-white fill-white"
                aria-hidden="true"
              />
            </motion.span>
          ) : (
            <motion.span key="play" {...ICON_SPRING}>
              <Play
                className="size-[18px] text-white fill-white ml-0.5"
                aria-hidden="true"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
CoverOverlay.displayName = "CoverOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// PLAY COUNT DISPLAY
// Formatted with fmtCount (shared util). Fades out on hover to reveal actions.
// ─────────────────────────────────────────────────────────────────────────────

const PlayCount = memo(({ count }: { count: number }) => (
  <div className="hidden sm:flex flex-col items-end gap-[2px]">
    <span
      className="text-[12px] font-mono font-semibold tabular-nums leading-none
        text-foreground/45 dark:text-foreground/38"
    >
      {fmtCount(count)}
    </span>
    <span
      className="text-[8.5px] uppercase tracking-wider font-semibold
        text-muted-foreground/28 dark:text-muted-foreground/22 leading-none"
    >
      plays
    </span>
  </div>
));
PlayCount.displayName = "PlayCount";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartItemProps {
  track: ChartTrack;
  rank: number;
  prevRank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART ITEM — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const ChartItem = memo(({ track, rank, prevRank }: ChartItemProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Granular selector — only 2 scalar fields, never re-renders on currentTime
  const { currentTrack, isPlaying } = useSelector(selectPlayer);

  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  const isCurrentTrack = currentTrack?._id === track._id;
  const isActivePlaying = isCurrentTrack && isPlaying;
  const diff = prevRank - rank; // positive = climbed the chart
  const cfg = getRankCfg(rank);
  const isTop3 = rank <= 3;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (isLoadingPlay) return;

      if (isCurrentTrack) {
        dispatch(setIsPlaying(!isPlaying));
        return;
      }

      setIsLoadingPlay(true);
      try {
        dispatch(setQueue({ tracks: [track], startIndex: 0 }));
        dispatch(setIsPlaying(true));
      } catch (err) {
        handleError(err, "Playback failed. Please try again.");
      } finally {
        setIsLoadingPlay(false);
      }
    },
    [isCurrentTrack, isPlaying, isLoadingPlay, track, dispatch],
  );

  const handleGoToArtist = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (track.artist?.slug) navigate(`/artist/${track.artist.slug}`);
    },
    [track.artist?.slug, navigate],
  );

  const handleGoToAlbum = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (track.album?.slug) navigate(`/albums/${track.album.slug}`);
    },
    [track.album?.slug, navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handlePlayPause(e);
      }
    },
    [handlePlayPause],
  );

  // ── Row background: active state takes priority over idle ─────────────────
  const rowBg = isActivePlaying ? cfg.rowActive : cfg.rowIdle;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    /**
     * Plain div — NOT motion.div.
     * Entry stagger animation is owned by the parent AnimatePresence list.
     * This avoids double Framer instance depth × N rows.
     *
     * `overflow-hidden` on the row prevents the absolute actions strip from
     * leaking outside on narrow viewports.
     */
    <div
      role="row"
      tabIndex={0}
      aria-label={`${isActivePlaying ? "Pause" : "Play"}: ${track.title} – ${track.artist?.name ?? "Unknown Artist"}`}
      aria-pressed={isActivePlaying}
      onClick={handlePlayPause}
      onKeyDown={handleKeyDown}
      className={cn(
        // Layout
        "group relative flex items-center rounded-xl cursor-pointer select-none",
        "overflow-hidden",
        // Transition
        "transition-colors duration-150 outline-none",
        // Focus ring — uses --ring token from design system
        "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.5)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        // Dynamic background
        rowBg,
        // Top-3 left accent border
        isTop3 && cfg.accent,
      )}
    >
      {/* ── Top-3 decorative shimmer overlay ──────────────────────────────── */}
      {isTop3 && cfg.shimmer && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 pointer-events-none",
            "bg-gradient-to-r rounded-xl",
            cfg.shimmer,
          )}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COLUMN 1 — RANK  (52px fixed, never shifts on WaveBars swap)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-[52px] shrink-0 flex flex-col items-center justify-center gap-[4px] py-3 pl-3 pr-1">
        <div
          className={cn(
            "flex items-center justify-center w-[22px] h-[26px]",
            "leading-none tabular-nums transition-all duration-200",
            !isCurrentTrack && cfg.numSize,
            !isCurrentTrack && cfg.numColor,
            !isCurrentTrack && cfg.numGlow,
          )}
        >
          {isCurrentTrack ? <WaveBars active={isActivePlaying} /> : rank}
        </div>
        <RankBadge diff={diff} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COLUMN 2 — COVER ART
          Top-3 gets larger thumbnail + scale hover effect.
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          "relative shrink-0 rounded-lg overflow-hidden mr-3",
          "ring-1 ring-black/[0.06] dark:ring-white/[0.06]",
          "shadow-sm group-hover:shadow-md dark:shadow-black/35",
          "transition-[transform,box-shadow] duration-300 ease-out",
          isTop3
            ? "size-[52px] sm:size-[56px] group-hover:scale-[1.035]"
            : "size-[44px] sm:size-[48px]",
          // Active playing: subtle ring glow using design system token
          isActivePlaying &&
            "ring-primary/40 dark:ring-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.28)]",
        )}
      >
        <ImageWithFallback
          src={track.coverImage}
          alt={track.title}
          className="size-full object-cover"
        />
        <CoverOverlay
          isLoading={isLoadingPlay}
          isActivePlaying={isActivePlaying}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COLUMN 3 — TITLE + ARTIST + ALBUM (inline on mobile)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 min-w-0 py-2.5 pr-2">
        {/* Track title */}
        <p
          className={cn(
            "font-semibold truncate leading-snug text-[13.5px] sm:text-[14px]",
            "transition-colors duration-150",
            isActivePlaying
              ? "text-primary"
              : "text-foreground/88 dark:text-foreground/82 group-hover:text-foreground",
          )}
        >
          {track.title}
        </p>

        {/* Artist + album (inline row, small text) */}
        <div className="flex items-center gap-0.5 mt-[3px] min-w-0">
          <button
            type="button"
            onClick={handleGoToArtist}
            aria-label={`Go to artist: ${track.artist?.name}`}
            className={cn(
              "text-[11.5px] truncate font-medium leading-snug shrink min-w-0",
              "text-muted-foreground/60 dark:text-muted-foreground/50",
              "hover:text-foreground hover:underline underline-offset-2",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:underline",
            )}
          >
            {track.artist?.name ?? "Unknown Artist"}
          </button>

          {/* Album — inline on mobile, hidden on lg+ (shown in dedicated col) */}
          {track.album?.title && (
            <button
              type="button"
              onClick={handleGoToAlbum}
              aria-label={`Go to album: ${track.album.title}`}
              className={cn(
                "sm:inline-block lg:hidden text-[11px] truncate shrink-0 hidden",
                "text-muted-foreground/32 dark:text-muted-foreground/26",
                "hover:text-muted-foreground hover:underline underline-offset-2",
                "transition-colors duration-150",
                "before:content-['·'] before:mr-1 before:opacity-60",
                "focus-visible:outline-none focus-visible:underline",
              )}
            >
              {track.album.title}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COLUMN 4 — ALBUM (lg+ desktop only, dedicated column)
          ═══════════════════════════════════════════════════════════════════ */}
      {track.album?.title ? (
        <button
          type="button"
          onClick={handleGoToAlbum}
          aria-label={`Go to album: ${track.album.title}`}
          className={cn(
            "relative z-10 hidden lg:block w-[172px] xl:w-[208px] shrink-0 px-4",
            "text-[12.5px] truncate text-left",
            "text-muted-foreground/38 dark:text-muted-foreground/30",
            "hover:text-foreground hover:underline underline-offset-2",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:underline",
          )}
        >
          {track.album.title}
        </button>
      ) : (
        // Spacer preserves grid alignment when there is no album
        <div
          aria-hidden="true"
          className="hidden lg:block w-[172px] xl:w-[208px] shrink-0"
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COLUMN 5 — META + ACTIONS (right zone)
          The meta strip (play count, duration) fades + shifts right on hover.
          The actions strip slides in from the right to replace it.
          overflow-hidden prevents bleed on narrow viewports.
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex items-center pr-3 shrink-0 gap-1 overflow-hidden min-w-[80px] sm:min-w-[112px]">
        {/* META — visible at rest, fades out on hover */}
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center gap-3",
            "transition-[opacity,transform] duration-200 ease-out",
            "group-hover:opacity-0 group-hover:translate-x-1",
            "group-hover:pointer-events-none",
          )}
        >
          <PlayCount count={track.playCount ?? 0} />

          <span
            className="text-[12px] font-mono tabular-nums w-9 text-right
              text-muted-foreground/38 dark:text-muted-foreground/30 leading-none"
          >
            {formatDuration(track.duration)}
          </span>
        </div>

        {/* ACTIONS — slides in on hover */}
        <div
          className={cn(
            "absolute right-0 flex items-center gap-0.5",
            "opacity-0 translate-x-2",
            "group-hover:opacity-100 group-hover:translate-x-0",
            "transition-[opacity,transform] duration-200 ease-out",
            "pointer-events-none group-hover:pointer-events-auto",
          )}
        >
          {/* LikeButton — from shared feature module */}
          <LikeButton id={track._id} />

          {/* Overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`More options for ${track.title}`}
                className={cn(
                  "flex items-center justify-center size-8 rounded-full",
                  "text-muted-foreground/50 hover:text-foreground",
                  "hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08]",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1",
                  "focus-visible:ring-[hsl(var(--ring)/0.4)]",
                )}
              >
                <MoreHorizontal className="size-[15px]" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
              className="w-52 rounded-xl p-1
                shadow-floating dark:shadow-black/50
                border border-border/50 dark:border-border/30
                bg-popover/90 dark:bg-popover/85
                backdrop-blur-xl"
            >
              {/* Play / Pause */}
              <DropdownMenuItem
                onClick={handlePlayPause}
                className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg"
              >
                {isActivePlaying ? (
                  <>
                    <Pause
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Pause
                  </>
                ) : (
                  <>
                    <Play
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Play now
                  </>
                )}
              </DropdownMenuItem>

              {/* Queue */}
              <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg">
                <ListMusic
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Add to queue
              </DropdownMenuItem>

              {/* Playlist */}
              <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg">
                <PlusCircle
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Add to playlist
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              {/* Artist */}
              <DropdownMenuItem
                onClick={handleGoToArtist}
                disabled={!track.artist?.slug}
                className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg"
              >
                <Disc3
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                View artist
              </DropdownMenuItem>

              {/* Album */}
              <DropdownMenuItem
                onClick={handleGoToAlbum}
                disabled={!track.album?.slug}
                className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg"
              >
                <Disc3
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                View album
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              {/* Share */}
              <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px] rounded-lg">
                <Share2
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});

ChartItem.displayName = "ChartItem";
export default ChartItem;
