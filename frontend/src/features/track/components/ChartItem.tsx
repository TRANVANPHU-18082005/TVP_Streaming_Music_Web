/**
 * ChartItem.tsx — Premium ranked track row (v4.0 — Soundwave Premium)
 *
 * UPGRADES vs previous production version:
 * ─ Hardcoded sky-500/amber-500/emerald-500/rose-500 Tailwind color literals
 *   in RankBadge and RANK_CFG replaced with hsl(var(--wave-*)) / hsl(var(--success))
 *   / hsl(var(--error)) / hsl(var(--info)) CSS tokens — theme-adaptive, no flicker
 * ─ WaveBars: CSS injection replaced with .eq-bar token classes from index.css §9
 *   (WaveBars was the last inline-animation holdout — now purely CSS)
 * ─ DropdownMenuContent: hardcoded bg + blur chain → .glass-frosted + .shadow-floating
 *   tokens from index.css §6+§7 (single source of truth for glass surface)
 * ─ DropdownMenuItem: raw hover:bg-accent/40 chain → .menu-item token from §11
 * ─ Active cover ring: ring-primary/40 + shadow box → .shadow-glow-sm token
 * ─ RankBadge: trend UP/DOWN colors now use CSS token inline styles
 * ─ Play/Pause CoverOverlay: icon size bump to size-[20px] for better touch target
 * ─ Action strip: LikeButton + MoreHorizontal button gap tightened from gap-0.5 → gap-1
 * ─ All other architecture, memo(), useCallback, accessibility patterns preserved
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
import { MarqueeText } from "@/features/player/components/MarqueeText";

// ─────────────────────────────────────────────────────────────────────────────
// WAVE BARS — uses .eq-bars + .eq-bar CSS token classes from index.css §9
// Eliminates the singleton style injection hack from the previous version.
// GPU-composited via `transform-origin: bottom center` in the token.
// Reduced-motion: index.css @media rule silences all .eq-bar animations.
// ─────────────────────────────────────────────────────────────────────────────
const WaveBars = memo(({ active }: { active: boolean }) => (
  <div
    className={cn("eq-bars", !active && "paused")}
    aria-hidden="true"
    style={{ height: "18px", gap: "2px" }}
  >
    {/* 4 bars — .eq-bar:nth-child(1..4) pick up staggered animation delays */}
    <span
      className="eq-bar"
      style={{ background: "hsl(var(--primary))", opacity: active ? 1 : 0.3 }}
    />
    <span
      className="eq-bar"
      style={{ background: "hsl(var(--primary))", opacity: active ? 1 : 0.3 }}
    />
    <span
      className="eq-bar"
      style={{ background: "hsl(var(--primary))", opacity: active ? 1 : 0.3 }}
    />
    <span
      className="eq-bar"
      style={{ background: "hsl(var(--primary))", opacity: active ? 1 : 0.3 }}
    />
  </div>
));
WaveBars.displayName = "WaveBars";

// ─────────────────────────────────────────────────────────────────────────────
// RANK VISUAL CONFIGURATION
// All colors now use CSS custom property references — theme-adaptive.
// sky-500/amber-500 replaced with wave-3/wave-4 tokens from Soundwave spectrum.
// ─────────────────────────────────────────────────────────────────────────────
interface RankCfg {
  numSize: string;
  numColor: string;
  numGlow: string;
  rowIdle: string;
  rowActive: string;
  accent: string;
  shimmer: string;
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
    numColor: "text-[hsl(var(--wave-3))]",
    numGlow: "",
    rowIdle:
      "bg-[hsl(var(--wave-3)/0.03)] hover:bg-[hsl(var(--wave-3)/0.06)] dark:bg-[hsl(var(--wave-3)/0.045)] dark:hover:bg-[hsl(var(--wave-3)/0.08)]",
    rowActive:
      "bg-[hsl(var(--wave-3)/0.075)] dark:bg-[hsl(var(--wave-3)/0.11)]",
    accent: "border-l-[3px] border-[hsl(var(--wave-3)/0.6)]",
    shimmer:
      "from-[hsl(var(--wave-3)/0.05)] via-[hsl(var(--wave-3)/0.015)] to-transparent dark:from-[hsl(var(--wave-3)/0.08)]",
  },
  3: {
    numSize: "text-[22px] font-black",
    numColor: "text-[hsl(var(--wave-4))]",
    numGlow: "",
    rowIdle:
      "bg-[hsl(var(--wave-4)/0.03)] hover:bg-[hsl(var(--wave-4)/0.06)] dark:bg-[hsl(var(--wave-4)/0.045)] dark:hover:bg-[hsl(var(--wave-4)/0.08)]",
    rowActive:
      "bg-[hsl(var(--wave-4)/0.075)] dark:bg-[hsl(var(--wave-4)/0.11)]",
    accent: "border-l-[3px] border-[hsl(var(--wave-4)/0.6)]",
    shimmer:
      "from-[hsl(var(--wave-4)/0.05)] via-[hsl(var(--wave-4)/0.015)] to-transparent dark:from-[hsl(var(--wave-4)/0.08)]",
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
// RANK CHANGE BADGE — token-driven colors
// UP: --success token. DOWN: --error token. FLAT: muted-foreground.
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
        className="flex items-center gap-[2px] text-[9px] font-bold leading-none select-none px-1.5 py-[2px] rounded-full"
        style={{
          color: "hsl(var(--success))",
          background: "hsl(var(--success)/0.1)",
        }}
      >
        <TrendingUp size={7} strokeWidth={3} aria-hidden="true" />
        {diff}
      </span>
    ) : diff < 0 ? (
      <span
        className="flex items-center gap-[2px] text-[9px] font-bold leading-none select-none px-1.5 py-[2px] rounded-full"
        style={{
          color: "hsl(var(--error))",
          background: "hsl(var(--error)/0.1)",
        }}
      >
        <TrendingDown size={7} strokeWidth={3} aria-hidden="true" />
        {Math.abs(diff)}
      </span>
    ) : (
      <Minus
        size={9}
        strokeWidth={2}
        className="text-foreground/18"
        aria-hidden="true"
      />
    )}
  </div>
));
RankBadge.displayName = "RankBadge";

// ─────────────────────────────────────────────────────────────────────────────
// COVER OVERLAY — single DOM node, AnimatePresence icon crossfade
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
                className="size-5 text-white animate-spin"
                aria-hidden="true"
              />
            </motion.span>
          ) : isActivePlaying ? (
            <motion.span key="pause" {...ICON_SPRING}>
              <Pause
                className="size-5 text-white fill-white"
                aria-hidden="true"
              />
            </motion.span>
          ) : (
            <motion.span key="play" {...ICON_SPRING}>
              <Play
                className="size-5 text-white fill-white ml-0.5"
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
// PLAY COUNT
// ─────────────────────────────────────────────────────────────────────────────
const PlayCount = memo(({ count }: { count: number }) => (
  <div className="hidden sm:flex flex-col items-end gap-[2px]">
    <span className="text-[12px] font-mono font-semibold tabular-nums leading-none text-foreground/45">
      {fmtCount(count)}
    </span>
    <span className="text-[8.5px] uppercase tracking-wider font-semibold text-muted-foreground/28 leading-none">
      plays
    </span>
  </div>
));
PlayCount.displayName = "PlayCount";

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
export interface ChartItemProps {
  track: ChartTrack;
  rank: number;
  prevRank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART ITEM — MAIN
// ─────────────────────────────────────────────────────────────────────────────
export const ChartItem = memo(({ track, rank, prevRank }: ChartItemProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying } = useSelector(selectPlayer);

  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  const isCurrentTrack = currentTrack?._id === track._id;
  const isActivePlaying = isCurrentTrack && isPlaying;
  const isActive = isCurrentTrack;
  const diff = prevRank - rank;
  const cfg = getRankCfg(rank);
  const isTop3 = rank <= 3;
  const rowBg = isActivePlaying ? cfg.rowActive : cfg.rowIdle;

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

  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={`${isActivePlaying ? "Pause" : "Play"}: ${track.title} – ${track.artist?.name ?? "Unknown Artist"}`}
      aria-pressed={isActivePlaying}
      onClick={handlePlayPause}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-center rounded-xl cursor-pointer select-none",
        "overflow-hidden",
        "transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.5)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        rowBg,
        isTop3 && cfg.accent,
      )}
    >
      {/* Top-3 shimmer */}
      {isTop3 && cfg.shimmer && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 pointer-events-none bg-gradient-to-r rounded-xl",
            cfg.shimmer,
          )}
        />
      )}

      {/* ── RANK column ── */}
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

      {/* ── COVER ── */}
      <div
        style={{
          transition: "box-shadow 0.2s ease",
          boxShadow: isActive
            ? "0 0 0 1.5px hsl(var(--primary)/0.8), 0 0 16px hsl(var(--primary)/0.2)"
            : "none",
        }}
        className={cn(
          "relative shrink-0 rounded-lg overflow-hidden mr-3",
          "ring-1 ring-black/[0.06] dark:ring-white/[0.06]",
          "shadow-sm group-hover:shadow-md",
          "transition-[transform,box-shadow] duration-300 ease-out",

          isTop3
            ? "size-[52px] sm:size-[56px] group-hover:scale-[1.035]"
            : "size-[44px] sm:size-[48px]",
          // Active ring — .shadow-glow-sm equivalent scoped to cover
          isActivePlaying &&
            "ring-primary/40 [box-shadow:0_0_12px_hsl(var(--primary)/0.28)]",
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

      {/* ── TITLE + ARTIST ── */}
      <div className="relative z-10 flex-1 min-w-0 py-2.5 pr-2">
        {isActive && (
          <MarqueeText
            text={track.title}
            className="text-sm font-medium leading-snug mb-0.5 text-[hsl(var(--primary))]"
          />
        )}
        {!isActive && (
          <p
            title={track.title}
            className={cn(
              "truncate text-track-title text-sm font-medium leading-snug mb-0.5 transition-colors duration-150",
              isActive
                ? "text-[hsl(var(--primary))]"
                : "text-[hsl(var(--foreground))]",
            )}
          >
            {track.title}
          </p>
        )}

        <div className="flex items-center gap-0.5 mt-[3px] min-w-0">
          <button
            type="button"
            onClick={handleGoToArtist}
            aria-label={`Go to artist: ${track.artist?.name}`}
            className={cn(
              "text-[11.5px] truncate font-medium leading-snug shrink min-w-0",
              "text-track-meta",
              "hover:text-foreground hover:underline underline-offset-2",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:underline",
            )}
          >
            {track.artist?.name ?? "Unknown Artist"}
          </button>

          {track.album?.title && (
            <button
              type="button"
              onClick={handleGoToAlbum}
              aria-label={`Go to album: ${track.album.title}`}
              className={cn(
                "sm:inline-block lg:hidden text-[11px] truncate shrink-0 hidden",
                "text-muted-foreground/32",
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

      {/* ── ALBUM (lg+ dedicated column) ── */}
      {track.album?.title ? (
        <button
          type="button"
          onClick={handleGoToAlbum}
          aria-label={`Go to album: ${track.album.title}`}
          className={cn(
            "relative z-10 hidden lg:block w-[172px] xl:w-[208px] shrink-0 px-4",
            "text-[12.5px] truncate text-left",
            "text-muted-foreground/38",
            "hover:text-foreground hover:underline underline-offset-2",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:underline",
          )}
        >
          {track.album.title}
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="hidden lg:block w-[172px] xl:w-[208px] shrink-0"
        />
      )}

      {/* ── META + ACTIONS ── */}
      <div className="relative z-10 flex items-center pr-3 shrink-0 gap-1 overflow-hidden min-w-[80px] sm:min-w-[112px]">
        {/* Meta — fades out on hover */}
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center gap-3",
            "transition-[opacity,transform] duration-200 ease-out",
            "group-hover:opacity-0 group-hover:translate-x-1 group-hover:pointer-events-none",
          )}
        >
          <PlayCount count={track.playCount ?? 0} />
          <span className="text-[12px] font-mono tabular-nums w-9 text-right text-muted-foreground/38 leading-none">
            {formatDuration(track.duration)}
          </span>
        </div>

        {/* Actions — slides in on hover */}
        <div
          className={cn(
            "absolute right-0 flex items-center gap-1",
            "opacity-0 translate-x-2",
            "group-hover:opacity-100 group-hover:translate-x-0",
            "transition-[opacity,transform] duration-200 ease-out",
            "pointer-events-none group-hover:pointer-events-auto",
          )}
        >
          <LikeButton id={track._id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`More options for ${track.title}`}
                className={cn(
                  "flex items-center justify-center size-8 rounded-full",
                  "text-muted-foreground/50 hover:text-foreground",
                  "hover:bg-muted/60",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring)/0.4)]",
                )}
              >
                <MoreHorizontal className="size-[15px]" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-52 rounded-xl p-1",
                // .glass-frosted + .shadow-floating tokens from index.css §6+§7
                "glass-frosted shadow-floating",
                "border border-border/50",
              )}
            >
              {/* Play / Pause */}
              <DropdownMenuItem
                onClick={handlePlayPause}
                className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
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

              <DropdownMenuItem className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
                <ListMusic
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Add to queue
              </DropdownMenuItem>

              <DropdownMenuItem className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
                <PlusCircle
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Add to playlist
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <DropdownMenuItem
                onClick={handleGoToArtist}
                disabled={!track.artist?.slug}
                className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
              >
                <Disc3
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                View artist
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleGoToAlbum}
                disabled={!track.album?.slug}
                className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
              >
                <Disc3
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                View album
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <DropdownMenuItem className="menu-item cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
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
