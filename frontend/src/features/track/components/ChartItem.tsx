import React, { memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { formatDuration } from "@/utils/track-helper";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectPlayer, setIsPlaying, setQueue } from "@/features/player";
import { handleError } from "@/utils/handleError";
import { LikeButton } from "@/features";

// ─── Rank visual config ───────────────────────────────────────────────────────
const RANK_CFG = {
  1: {
    numCls: "text-[26px] font-black",
    color: "text-primary",
    glow: "drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]",
    rowBg:
      "bg-primary/[0.05] dark:bg-primary/[0.08] hover:bg-primary/[0.08] dark:hover:bg-primary/[0.12]",
    activeBg: "bg-primary/[0.10] dark:bg-primary/[0.14]",
    borderL: "border-l-[3px] border-primary",
    gradientOverlay:
      "from-primary/[0.07] via-primary/[0.02] to-transparent dark:from-primary/[0.10] dark:via-primary/[0.03]",
  },
  2: {
    numCls: "text-[22px] font-black",
    color: "text-sky-500 dark:text-sky-400",
    glow: "",
    rowBg:
      "bg-sky-500/[0.04] dark:bg-sky-400/[0.06] hover:bg-sky-500/[0.07] dark:hover:bg-sky-400/[0.10]",
    activeBg: "bg-sky-500/[0.08] dark:bg-sky-400/[0.11]",
    borderL: "border-l-[3px] border-sky-400/70",
    gradientOverlay:
      "from-sky-500/[0.06] via-sky-500/[0.02] to-transparent dark:from-sky-400/[0.09]",
  },
  3: {
    numCls: "text-[22px] font-black",
    color: "text-amber-500 dark:text-amber-400",
    glow: "",
    rowBg:
      "bg-amber-500/[0.04] dark:bg-amber-400/[0.06] hover:bg-amber-500/[0.07] dark:hover:bg-amber-400/[0.10]",
    activeBg: "bg-amber-500/[0.08] dark:bg-amber-400/[0.11]",
    borderL: "border-l-[3px] border-amber-400/70",
    gradientOverlay:
      "from-amber-500/[0.06] via-amber-500/[0.02] to-transparent dark:from-amber-400/[0.09]",
  },
} as const;

type Top3Rank = keyof typeof RANK_CFG;

const DEFAULT_RANK_CFG = {
  numCls: "text-[18px] font-bold",
  color: "text-foreground/30 dark:text-foreground/25",
  glow: "",
  rowBg: "hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05]",
  activeBg: "bg-primary/[0.06] dark:bg-primary/[0.09]",
  borderL: "",
  gradientOverlay: "",
};

const getRankCfg = (rank: number) =>
  rank <= 3 ? RANK_CFG[rank as Top3Rank] : DEFAULT_RANK_CFG;

// ─── Play count formatter ─────────────────────────────────────────────────────
function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

// ─── Wave Bars (playing indicator) ───────────────────────────────────────────
const WaveBars = memo(({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[2.5px] h-4 w-5" aria-hidden>
    {[0.9, 1.1, 0.8].map((speed, i) => (
      <motion.span
        key={i}
        className="w-[3px] rounded-full origin-bottom bg-primary"
        style={{ height: 14 }}
        animate={
          active ? { scaleY: [0.35, 1, 0.45, 0.85, 0.3, 1] } : { scaleY: 0.25 }
        }
        transition={
          active
            ? {
                duration: speed,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: i * 0.12,
              }
            : { duration: 0.2 }
        }
      />
    ))}
  </div>
));
WaveBars.displayName = "WaveBars";

// ─── Rank Change Badge ────────────────────────────────────────────────────────
const RankBadge = memo(({ diff }: { diff: number }) => (
  // Fixed height: prevents layout shift when badge content changes
  <div
    className="h-4 flex items-center justify-center"
    aria-label={
      diff > 0
        ? `Tăng ${diff} hạng`
        : diff < 0
          ? `Giảm ${Math.abs(diff)} hạng`
          : "Không thay đổi"
    }
  >
    {diff > 0 ? (
      <span className="flex items-center gap-[3px] text-[9px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-1.5 py-[2px] rounded-full leading-none select-none">
        <TrendingUp size={7} strokeWidth={3} />
        {diff}
      </span>
    ) : diff < 0 ? (
      <span className="flex items-center gap-[3px] text-[9px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-400/10 px-1.5 py-[2px] rounded-full leading-none select-none">
        <TrendingDown size={7} strokeWidth={3} />
        {Math.abs(diff)}
      </span>
    ) : (
      <Minus
        size={9}
        strokeWidth={2}
        className="text-foreground/20 dark:text-foreground/15"
      />
    )}
  </div>
));
RankBadge.displayName = "RankBadge";

// ─── Cover Overlay (play/pause/loading) ──────────────────────────────────────
const CoverOverlay = memo(
  ({
    isLoading,
    isActivePlaying,
  }: {
    isLoading: boolean;
    isActivePlaying: boolean;
  }) => (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px] rounded-[inherit]"
      initial={false}
      // Always visible when loading or playing; fade in on hover otherwise
      animate={{ opacity: isLoading || isActivePlaying ? 1 : 0 }}
      // Hover handled by parent's group class — see wrapper
      transition={{ duration: 0.15 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.span key="loading" {...iconAnim}>
            <Loader2 className="size-[18px] text-white animate-spin" />
          </motion.span>
        ) : isActivePlaying ? (
          <motion.span key="pause" {...iconAnim}>
            <Pause className="size-[18px] text-white fill-white" />
          </motion.span>
        ) : (
          <motion.span key="play" {...iconAnim}>
            <Play className="size-[18px] text-white fill-white ml-0.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  ),
);
CoverOverlay.displayName = "CoverOverlay";

const iconAnim = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.6, opacity: 0 },
  transition: { duration: 0.13, ease: "easeOut" as const },
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ChartItemProps {
  track: ChartTrack;
  rank: number;
  prevRank: number;
  /** For entrance stagger delay from parent list */
  rankIndex?: number;
}

// ─── ChartItem ────────────────────────────────────────────────────────────────
export const ChartItem = memo(
  ({ track, rank, prevRank, rankIndex = 0 }: ChartItemProps) => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { currentTrack, isPlaying } = useAppSelector(selectPlayer);

    const [isLoadingPlay, setIsLoadingPlay] = useState(false);

    const isCurrentTrack = currentTrack?._id === track._id;
    const isActivePlaying = isCurrentTrack && isPlaying;

    const diff = prevRank - rank; // positive = moved up
    const cfg = getRankCfg(rank);
    const isTop3 = rank <= 3;

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handlePlayPause = useCallback(
      async (e: React.MouseEvent) => {
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
          // Small delay so the player UI has time to mount before we clear loading
          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          handleError(err, "Không thể phát bài hát. Vui lòng thử lại.");
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

    // ── Row background: active state takes priority over hover ───────────────
    const rowBg = isActivePlaying ? cfg.activeBg : cfg.rowBg;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{
          type: "spring",
          stiffness: 440,
          damping: 34,
          delay: Math.min(rankIndex * 0.035, 0.4),
        }}
        onClick={handlePlayPause}
        role="button"
        tabIndex={0}
        aria-label={`${isActivePlaying ? "Dừng" : "Phát"} ${track.title} – ${track.artist?.name ?? "Unknown"}`}
        onKeyDown={(e) =>
          e.key === "Enter" && handlePlayPause(e as unknown as React.MouseEvent)
        }
        className={cn(
          "group relative flex items-center rounded-xl cursor-pointer select-none",
          "transition-colors duration-200 outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
          rowBg,
          isTop3 && cfg.borderL,
        )}
      >
        {/* Top-3 gradient overlay — purely decorative */}
        {isTop3 && cfg.gradientOverlay && (
          <div
            className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-r pointer-events-none",
              cfg.gradientOverlay,
            )}
            aria-hidden
          />
        )}

        {/* ── 1. RANK (52px fixed) ─────────────────────────────────────────── */}
        <div className="relative z-10 w-[52px] shrink-0 flex flex-col items-center justify-center gap-[3px] py-3 pl-3 pr-1">
          <span
            className={cn(
              "leading-none tabular-nums transition-colors",
              cfg.numCls,
              cfg.color,
              cfg.glow,
            )}
          >
            {isCurrentTrack ? <WaveBars active={isActivePlaying} /> : rank}
          </span>
          <RankBadge diff={diff} />
        </div>

        {/* ── 2. COVER ART ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative shrink-0 rounded-lg overflow-hidden transition-transform duration-300 mr-3",
            "shadow-sm group-hover:shadow-md dark:shadow-black/30",
            isTop3
              ? "size-[52px] sm:size-[56px] group-hover:scale-[1.04]"
              : "size-[44px] sm:size-[48px]",
          )}
        >
          <ImageWithFallback
            src={track.coverImage}
            alt={track.title}
            className="size-full object-cover"
          />
          {/* Overlay: always renders, opacity managed inside */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <CoverOverlay
              isLoading={isLoadingPlay}
              isActivePlaying={isActivePlaying}
            />
          </div>
          {/* Show overlay without hover when loading or active */}
          {(isLoadingPlay || isActivePlaying) && (
            <div className="absolute inset-0">
              <CoverOverlay
                isLoading={isLoadingPlay}
                isActivePlaying={isActivePlaying}
              />
            </div>
          )}
        </div>

        {/* ── 3. TRACK INFO ────────────────────────────────────────────────── */}
        <div className="relative z-10 flex-1 min-w-0 py-2.5 pr-2">
          <p
            className={cn(
              "font-semibold truncate leading-snug text-[13.5px] sm:text-[14.5px] transition-colors",
              isActivePlaying
                ? "text-primary"
                : "text-foreground/90 dark:text-foreground/85 group-hover:text-foreground",
            )}
          >
            {track.title}
          </p>
          <div className="flex items-center gap-1 mt-[2px] min-w-0">
            <button
              onClick={handleGoToArtist}
              className="text-[11.5px] text-muted-foreground/65 dark:text-muted-foreground/55 truncate font-medium hover:text-foreground hover:underline transition-colors leading-snug shrink min-w-0"
            >
              {track.artist?.name ?? "Unknown Artist"}
            </button>
            {track.album?.title && (
              <button
                onClick={handleGoToAlbum}
                className="hidden sm:inline-block text-[11px] text-muted-foreground/35 dark:text-muted-foreground/30 truncate hover:text-muted-foreground hover:underline transition-colors shrink-0 before:content-['·'] before:mr-1 before:no-underline"
              >
                {track.album.title}
              </button>
            )}
          </div>
        </div>

        {/* ── 4. ALBUM (lg+) ───────────────────────────────────────────────── */}
        {track.album?.title && (
          <button
            onClick={handleGoToAlbum}
            className={cn(
              "relative z-10 hidden lg:block w-[180px] xl:w-[210px] shrink-0 px-4",
              "text-[12.5px] text-muted-foreground/45 dark:text-muted-foreground/35 truncate text-left",
              "hover:text-foreground hover:underline transition-colors",
            )}
          >
            {track.album.title}
          </button>
        )}
        {!track.album?.title && (
          <div
            className="hidden lg:block w-[180px] xl:w-[210px] shrink-0"
            aria-hidden
          />
        )}

        {/* ── 5. RIGHT META + ACTIONS ──────────────────────────────────────── */}
        <div className="relative z-10 flex items-center pr-3 shrink-0 gap-1">
          {/*
          Two layers:
          a) Meta (play count + duration) — visible by default, fades on hover
          b) Actions (like + more) — invisible by default, fades in on hover
          Both sit in the same space to avoid layout shift.
        */}

          {/* Meta layer */}
          <div
            className={cn(
              "flex items-center gap-3 transition-all duration-200",
              "group-hover:opacity-0 group-hover:pointer-events-none",
            )}
          >
            {/* Play count */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[12.5px] font-mono font-semibold text-foreground/50 dark:text-foreground/40 tabular-nums leading-none">
                {fmtCount(track.playCount ?? 0)}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground/30 dark:text-muted-foreground/25 font-medium mt-[2px]">
                plays
              </span>
            </div>
            {/* Duration */}
            <span className="hidden xs:block text-[12px] font-mono text-muted-foreground/40 dark:text-muted-foreground/30 tabular-nums w-9 text-right">
              {formatDuration(track.duration)}
            </span>
          </div>

          {/* Actions layer — absolutely positioned to avoid pushing layout */}
          <div
            className={cn(
              "absolute right-0 flex items-center gap-0.5",
              "opacity-0 group-hover:opacity-100",
              "translate-x-1 group-hover:translate-x-0",
              "transition-all duration-200 pointer-events-none group-hover:pointer-events-auto",
            )}
          >
            {/* Like button */}
            <LikeButton trackId={track._id} />

            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Thêm tùy chọn"
                  className="flex items-center justify-center size-8 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-foreground/8 dark:hover:bg-white/8 transition-colors"
                >
                  <MoreHorizontal className="size-[15px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={4}
                className="w-52 rounded-xl shadow-xl dark:shadow-black/40"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={handlePlayPause}
                  className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
                >
                  {isActivePlaying ? (
                    <>
                      <Pause className="size-4 text-muted-foreground" /> Tạm
                      dừng
                    </>
                  ) : (
                    <>
                      <Play className="size-4 text-muted-foreground" /> Phát
                      ngay
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
                  <ListMusic className="size-4 text-muted-foreground" />
                  Thêm vào hàng chờ
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
                  <PlusCircle className="size-4 text-muted-foreground" />
                  Thêm vào Playlist
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleGoToArtist}
                  disabled={!track.artist?.slug}
                  className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
                >
                  <Disc3 className="size-4 text-muted-foreground" />
                  Xem nghệ sĩ
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleGoToAlbum}
                  disabled={!track.album?.slug}
                  className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]"
                >
                  <Disc3 className="size-4 text-muted-foreground" />
                  Xem album
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer py-2.5 gap-3 font-medium text-[13px]">
                  <Share2 className="size-4 text-muted-foreground" />
                  Chia sẻ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    );
  },
);

ChartItem.displayName = "ChartItem";
export default ChartItem;
