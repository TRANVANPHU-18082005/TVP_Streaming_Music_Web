import React, { memo, useState, useCallback } from "react";
import { AnimatePresence, motion, prefersReducedMotion } from "framer-motion";
import {
  Play,
  Pause,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { cn } from "@/lib/utils";

import { RankedTrack } from "@/features/track/hooks/useRealtimeChart";
import { fmtCount, formatDuration } from "@/utils/track-helper";
import { useAppDispatch } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { handleError } from "@/utils/handleError";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { TrackTitleMarquee } from "@/features/player/components/TrackTitleMarquee";
import { EqualizerBars } from "@/components/MusicVisualizer";
import LazyImage from "./LazyImage";

// ─────────────────────────────────────────────────────────────────────────────
// RANK CONFIG
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

const getRankCfg = (rank: number): RankCfg =>
  rank <= 3 ? RANK_CFG[rank as 1 | 2 | 3] : DEFAULT_CFG;

// ─────────────────────────────────────────────────────────────────────────────
// RANK BADGE
//
// Receives pre-computed trend + rankDelta from RankedTrack (hook v10/10).
// "Haptic" pulse: key={rankDelta} remounts motion.span each time delta
// changes → initial spring fires once, conveying physical weight.
// trend === "new" → amber ✦ MỚI badge.
// ─────────────────────────────────────────────────────────────────────────────

interface RankBadgeProps {
  trend: RankedTrack["trend"];
  rankDelta: number;
}

const BADGE_SPRING = {
  type: "spring" as const,
  stiffness: 600,
  damping: 22,
} as const;

const RankBadge = memo(({ trend, rankDelta }: RankBadgeProps) => {
  if (trend === "new") {
    return (
      <motion.span
        // key remounts on every "new" entry → spring fires fresh each time
        key="new"
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...BADGE_SPRING, delay: 0.08 }}
        aria-label="Bài hát mới vào bảng xếp hạng"
        className={cn(
          "inline-flex items-center gap-0.5 text-[7px]  font-semibold tracking-wide",
          "leading-none rounded-full select-none p-0.5",
          "text-amber-400 bg-amber-400/10 ring-1 ring-amber-400/20",
        )}
      >
        <Sparkles className="w-2 h-2 " aria-hidden="true" />
        New
      </motion.span>
    );
  }

  if (trend === "same") {
    return (
      <span
        aria-label="Hạng không thay đổi"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-foreground/18"
      >
        <Minus size={9} strokeWidth={2} aria-hidden="true" />
      </span>
    );
  }

  const isUp = trend === "up";

  return (
    <motion.span
      // key={rankDelta} → remounts whenever delta value changes,
      // firing the spring "haptic" pulse once per rank-change event.
      key={rankDelta}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...BADGE_SPRING, delay: 0.1 }}
      aria-label={`Hạng ${isUp ? "tăng" : "giảm"} ${Math.abs(rankDelta)}`}
      className={cn(
        "inline-flex items-center gap-[2px] text-[9px] font-bold font-mono leading-none",
        "select-none px-1.5 py-[2px] rounded-full",
        isUp
          ? "text-emerald-400 bg-emerald-400/10"
          : "text-rose-400   bg-rose-400/10",
      )}
    >
      {isUp ? (
        <TrendingUp size={7} strokeWidth={3} aria-hidden="true" />
      ) : (
        <TrendingDown size={7} strokeWidth={3} aria-hidden="true" />
      )}
      {Math.abs(rankDelta)}
    </motion.span>
  );
});
RankBadge.displayName = "RankBadge";

// ─────────────────────────────────────────────────────────────────────────────
// COVER OVERLAY
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
// PLAY COUNT — shows 24h score (unique listeners) instead of all-time playCount
// Falls back to playCount if score is absent (e.g. fallback tracks score = 0)
// Label updated to "24h" to set correct user expectation.
// ─────────────────────────────────────────────────────────────────────────────

const PlayCount = memo(
  ({ score, playCount }: { score: number; playCount: number }) => {
    // Prefer score (24h realtime) when non-zero; fallback to all-time playCount
    const display = score > 0 ? score : playCount;
    const label = score > 0 ? "24h" : "plays";

    return (
      <div className="hidden sm:flex flex-col items-end gap-[2px]">
        <span className="text-[12px] font-mono font-semibold tabular-nums leading-none text-foreground/45">
          {fmtCount(display)}
        </span>
        <span className="text-[8.5px] uppercase tracking-wider font-semibold text-muted-foreground/28 leading-none">
          {label}
        </span>
      </div>
    );
  },
);
PlayCount.displayName = "PlayCount";

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
//
// track: RankedTrack (superset of ChartTrack — includes rank/trend/rankDelta/score)
// rankBadge: pre-built badge node from TopFeaturedTracks (optional override).
//   When provided, ChartItem renders it directly and skips internal RankBadge.
//   Keeps ChartItem usable standalone (no rankBadge = renders own badge).
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartItemProps {
  track: RankedTrack;
  rank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART ITEM — MAIN
// ─────────────────────────────────────────────────────────────────────────────

export const ChartItem = memo(({ track, rank }: ChartItemProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentTrackId, isPlaying } = useSelector(selectPlayer);

  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const isCurrentTrack = currentTrackId === track._id;
  const isActivePlaying = isCurrentTrack && isPlaying;

  const cfg = getRankCfg(rank);
  const isTop3 = rank <= 3;
  const rowBg = isActivePlaying ? cfg.rowActive : cfg.rowIdle;
  const { loadingState } = useSelector(selectPlayer);

  const isGlobalLoading =
    loadingState === "loading" || loadingState === "buffering";

  // ── Handlers ───────────────────────────────────────────────────────────────
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
        // playerSlice v2 signature: { trackIds, initialMetadata, startIndex }
        dispatch(
          setQueue({
            trackIds: [track._id],
            initialMetadata: [track], // Chèn data trả từ search.service.ts
            startIndex: 0,
            isShuffling: false,
            source: {
              id: track._id,
              type: "chart",
              title: track.title,
            },
          }),
        );
        dispatch(setIsPlaying(true));
      } catch (err) {
        handleError(err, "Không thể phát nhạc. Hãy thử lại.");
      } finally {
        setIsLoadingPlay(false);
      }
    },
    [isLoadingPlay, isCurrentTrack, dispatch, isPlaying, track],
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={`${isActivePlaying ? "Tạm dừng" : "Phát"}: ${track.title} – ${track.artist?.name ?? "Ẩn danh"}`}
      aria-pressed={isActivePlaying}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-center rounded-xl cursor-pointer select-none gap-1.5 md:gap-3",
        "overflow-hidden transition-colors duration-150 outline-none",
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
            "absolute inset-0 pointer-events-none bg-linear-to-r rounded-xl",
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
            !isActivePlaying && cfg.numSize,
            !isActivePlaying && cfg.numColor,
            !isActivePlaying && cfg.numGlow,
          )}
        >
          {isActivePlaying ? (
            <EqualizerBars active color="primary" bars={3} />
          ) : (
            rank
          )}
        </div>

        <RankBadge trend={track.trend} rankDelta={track.rankDelta} />
      </div>

      <LazyImage
        src={track.coverImage}
        alt={track.title}
        isActive={isCurrentTrack}
        isLoading={isGlobalLoading}
        isCurrentPlaying={isActivePlaying}
        onClick={handlePlayPause}
      />

      <div className="min-w-0 flex-1 overflow-hidden">
        {isCurrentTrack ? (
          <TrackTitleMarquee
            id={track._id}
            title={track.title}
            mainArtist={track.artist}
            featuringArtists={track.featuringArtists}
            className="text-sm"
            artistClassName="text-xs"
          />
        ) : (
          <>
            <Link
              to={`/tracks/${track._id}`}
              title={track.title}
              className={cn(
                "block max-w-full truncate",
                "text-sm font-medium leading-snug mb-0.5",
                "text-foreground/90",
                "group-hover:text-foreground",
                prefersReducedMotion ? "" : "transition-colors duration-100",
              )}
            >
              {track.title}
            </Link>

            <div className="min-w-0 overflow-hidden">
              <ArtistDisplay
                mainArtist={track.artist}
                featuringArtists={track.featuringArtists}
                className={cn(
                  "block truncate",
                  "text-xs text-muted-foreground/55",
                  "hover:text-foreground/70 hover:underline underline-offset-2",
                  prefersReducedMotion ? "" : "transition-colors duration-100",
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* ── ALBUM (lg+ column) ── */}
      {track.album?.title ? (
        <button
          type="button"
          onClick={handleGoToAlbum}
          aria-label={`Đi đến album: ${track.album.title}`}
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
          className="hidden lg:block w-[150] xl:w-50 shrink-0"
        />
      )}

      {/* Actions — slides in on hover */}
      <div
        className={cn(
          "flex items-center gap-3 pl-2",
          "transition-[opacity,transform] duration-200 ease-out",
          "group-hover:opacity-0 group-hover:translate-x-1 group-hover:pointer-events-none min-w-5 md:min-w-10",
        )}
      >
        <TrackLikeButton id={track._id} />
      </div>
      {/* ── META + ACTIONS ── */}
      <div className="relative z-10 flex items-center pr-2 shrink-0 gap-1 overflow-hidden min-w-12.5 md:min-w-30">
        {/* Meta — fades on hover */}
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center gap-3",
            "transition-[opacity,transform] duration-200 ease-out",
            "group-hover:opacity-0 group-hover:translate-x-1 group-hover:pointer-events-none",
          )}
        >
          {/* 24h score if available, else total playCount */}
          <PlayCount
            score={track.score ?? 0}
            playCount={track.playCount ?? 0}
          />
          <span className="text-[12px] font-mono tabular-nums w-9 text-right text-muted-foreground/38 leading-none">
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

ChartItem.displayName = "ChartItem";
export default ChartItem;
