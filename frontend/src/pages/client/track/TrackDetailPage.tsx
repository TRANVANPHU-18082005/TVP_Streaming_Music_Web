import React, { useCallback, useRef, memo, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  Disc3,
  Heart,
  Radio,
  ListPlus,
  Share2,
  CheckCheck,
  Play,
  Pause,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import MusicResult from "@/components/ui/Result";

import {
  usePublicTrackDetail,
  useRecommendedTracks,
  useSimilarTracks,
} from "@/features/track/hooks/useTracksQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";

import { ITrack } from "@/features/track/types";
import { APP_CONFIG, SP_GENTLE, SP_HERO, SP_SNAPPY } from "@/config/constants";
import { buildPaletteWithColor, getThemePrimary } from "@/utils/color";
import { formatDuration, toCDN } from "@/utils/track-helper";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import PlayCell from "@/features/track/components/PlayCell";
import LazyImage from "@/features/track/components/LazyImage";
import { WaveformBars } from "@/components/MusicVisualizer";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectPlayer,
  setIsPlaying,
  setQueue,
} from "@/features/player/slice/playerSlice";
import { handleError } from "@/utils/handleError";
import { useContextSheet } from "@/app/provider/SheetProvider";

import { Skeleton } from "@/components/ui/skeleton";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { IAlbum } from "@/features/album";
import { IArtist } from "@/features/artist";
import { useSyncInteractions } from "@/features/interaction";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const TrackRowSkeleton = memo(() => (
  <div className="flex items-center gap-3 px-2 py-2 w-full">
    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
    <div className="flex-1 flex flex-col gap-2 min-w-0">
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
  </div>
));
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 28 } as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.045 },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};
const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  gentle: { type: "spring", stiffness: 300, damping: 30 } as const,
  pop: { type: "spring", stiffness: 520, damping: 24 } as const,
  swipe: { type: "spring", stiffness: 280, damping: 30, mass: 0.8 } as const,
} as const;

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: SP_GENTLE },
};
interface TrackRowProps {
  item: ITrack;
  onPlay?: (track: ITrack) => void;
  onAddToPlaylist: (track: ITrack) => void;
  onMoreOptions: (track: ITrack) => void; // PERF-2: removed unused anchor param
  index: number;
}

const TrackRow = memo(
  ({ item, onPlay, onAddToPlaylist, onMoreOptions, index }: TrackRowProps) => {
    const prefersReduced = useReducedMotion();

    const { currentTrackId, isPlaying: isGlobalPlaying } =
      useAppSelector(selectPlayer);
    const isActive = currentTrackId === item._id;
    const isPlaying = isActive && isGlobalPlaying;

    const handleMore = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onMoreOptions(item);
      },
      [item, onMoreOptions],
    );

    const handleAdd = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddToPlaylist(item);
      },
      [item, onAddToPlaylist],
    );

    const playWrapper = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();
        onPlay?.(item);
      },
      [item, onPlay],
    );

    const handleKey = useCallback(
      (e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Enter") onPlay?.(item);
      },
      [item, onPlay],
    );

    return (
      <motion.div
        variants={prefersReduced ? {} : STAGGER_ITEM}
        layout="position"
        className={cn(
          "group relative flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors duration-150 cursor-pointer",
          "hover:bg-[var(--fp-hover-bg)] active:bg-[var(--fp-active-bg)]",
          isPlaying ? "dark:bg-primary/10 bg-primary/8 shadow-sm" : "",
        )}
        role="button"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label={`Phát ${item.title}`}
      >
        {/* Index / Play cell */}
        <div className="w-6 shrink-0 flex justify-center items-center">
          <PlayCell
            index={index}
            isActive={isActive}
            isPlaying={isPlaying}
            onPlay={playWrapper}
          />
        </div>

        {/* Cover */}
        <LazyImage
          src={toCDN(item.coverImage) || item.coverImage}
          alt={item.title}
          isActive={isActive}
          isCurrentPlaying={isPlaying}
          isLoading={false}
          onClick={(e) => playWrapper(e)}
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[13px] font-semibold truncate leading-snug",
              isActive ? "text-primary" : "text-[var(--fp-fg)]",
            )}
          >
            {item.title}
          </p>
          <ArtistDisplay
            mainArtist={item.artist}
            featuringArtists={item.featuringArtists}
            className="text-[11px]"
          />
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SP.snappy}
            onClick={handleAdd}
            aria-label="Thêm vào playlist"
            className="p-1.5 rounded-lg text-[var(--fp-fg-subtle)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)] transition-colors"
          >
            <ListPlus className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SP.snappy}
            onClick={handleMore}
            aria-label="Tùy chọn khác"
            className="p-1.5 rounded-lg text-[var(--fp-fg-subtle)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  },
);
TrackRow.displayName = "TrackRow";
// ─────────────────────────────────────────────────────────────────────────────
// ArtistMeta
// ─────────────────────────────────────────────────────────────────────────────
const ArtistMeta = memo<{
  artistName?: string;
  artistAvatar?: string;
  releaseYear?: number | string;
  onNavigate: () => void;
  size?: "sm" | "md";
}>(({ artistName, artistAvatar, releaseYear, onNavigate, size = "md" }) => (
  <div
    className={cn(
      "flex items-center gap-1.5 flex-wrap",
      size === "sm" && "mt-1",
    )}
  >
    <button
      type="button"
      onClick={onNavigate}
      className="flex items-center gap-2 group/artist hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
      aria-label={`Xem trang nghệ sĩ${artistName ? `: ${artistName}` : ""}`}
    >
      <Avatar
        className={cn(
          "border-2 border-background/70 shadow-sm shrink-0",
          size === "sm" ? "size-[18px]" : "size-6",
        )}
      >
        <AvatarImage src={toCDN(artistAvatar)} />
        <AvatarFallback className="text-[8px] font-black bg-primary/20 text-primary">
          {artistName?.[0] ?? "U"}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "font-black text-foreground group-hover/artist:underline underline-offset-4 decoration-2",
          size === "sm" ? "text-[13px] text-foreground/80" : "text-sm",
        )}
      >
        {artistName ?? "Unknown Artist"}
      </span>
    </button>
    {releaseYear && (
      <>
        <span className="text-foreground/30 text-xs" aria-hidden="true">
          •
        </span>
        <span
          className={cn(
            "font-semibold text-foreground/75",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {releaseYear}
        </span>
      </>
    )}
  </div>
));
ArtistMeta.displayName = "ArtistMeta";

// ─────────────────────────────────────────────────────────────────────────────
// PlayingPill
// ─────────────────────────────────────────────────────────────────────────────
const PlayingPill = memo<{
  isPlaying: boolean;
  paletteHex: string;
  paletteR: (alpha: number) => string;
}>(({ isPlaying, paletteHex, paletteR }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.88, y: 4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.88, y: 4 }}
    transition={SP_SNAPPY}
    className="flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
    style={{ background: paletteR(0.1), borderColor: paletteR(0.28) }}
  >
    <WaveformBars color={paletteHex} active={isPlaying} />
    <span
      className="text-[10px] font-black uppercase tracking-widest"
      style={{ color: paletteHex }}
    >
      {isPlaying ? "Đang phát" : "Đã tạm dừng"}
    </span>
  </motion.div>
));
PlayingPill.displayName = "PlayingPill";

// ─────────────────────────────────────────────────────────────────────────────
// Track Stats
// ─────────────────────────────────────────────────────────────────────────────
const TrackStats = memo<{
  playCount: number;
  duration: number;
  inline?: boolean;
  className?: string;
}>(({ playCount, duration, inline, className }) => {
  const durationText = duration > 0 ? ` · ${formatDuration(duration)}` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        inline
          ? "text-sm font-semibold text-foreground/70"
          : "text-xs text-muted-foreground",
        className,
      )}
    >
      {!inline && (
        <Disc3 className="size-3.5 opacity-50 shrink-0" aria-hidden="true" />
      )}
      {playCount > 0
        ? `${playCount.toLocaleString("vi-VN")} lượt nghe`
        : "Track mới"}
      {durationText}
    </span>
  );
});
TrackStats.displayName = "TrackStats";
interface TrackDetailAlbumCardProps {
  album: IAlbum;
  onClick: (e: React.MouseEvent) => void;
}
const TrackDetailAlbumCard = React.memo(
  ({ album, onClick }: TrackDetailAlbumCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={toCDN(album.coverImage)}
          alt={album.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <h3 className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors">
          {album.title}
        </h3>
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5 truncate">
          {album.artist?.name || "Đĩa nhạc"}
        </p>
      </div>
    </motion.div>
  ),
);
interface TrackDetailArtistCardProps {
  artist: IArtist;
  onClick: (e: React.MouseEvent) => void;
}
const TrackDetailArtistCard = React.memo(
  ({ artist, onClick }: TrackDetailArtistCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-full overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={toCDN(artist.avatar)}
          alt={artist.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-center text-center">
        <h3 className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors">
          {artist.name}
        </h3>

        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5">
          Nghệ sĩ
        </p>
      </div>
    </motion.div>
  ),
);
// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TrackDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();
  const handleBack = useSmartBack();
  const scrollY = useScrollY(scrollRef, true);
  const isScrolled = scrollY > 280;

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = usePublicTrackDetail(id ?? "");
  const track = response?.data;
  // ── Player State ──────────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const { currentTrackId, isPlaying: isGlobalPlaying } =
    useAppSelector(selectPlayer);
  const isThisTrackActive = currentTrackId === track?._id;
  const isThisTrackPlaying = isThisTrackActive && isGlobalPlaying;

  const palette = useMemo(() => {
    return buildPaletteWithColor(getThemePrimary());
  }, []);
  const { className: titleCls, style: titleStyle } = useTitleStyle(
    track?.title ?? "",
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const { openTrackSheet } = useContextSheet();
  const trackIds = useMemo(() => (track?._id ? [track._id] : []), [track?._id]);
  useSyncInteractions(trackIds, "like", "track", !!track?._id);

  const handlePlayTrack = useCallback(
    async (t: ITrack) => {
      if (currentTrackId === t._id) {
        dispatch(setIsPlaying(!isGlobalPlaying));
        return;
      }
      try {
        dispatch(
          setQueue({
            trackIds: [t._id],
            initialMetadata: [t],
            startIndex: 0,
            isShuffling: false,
            source: { id: t._id, type: "single", title: t.title, url: "" },
          }),
        );
      } catch (err) {
        handleError(err, "Không thể phát bài hát này");
      }
    },
    [currentTrackId, isGlobalPlaying, dispatch],
  );

  const handleMainPlayClick = useCallback(() => {
    if (track) handlePlayTrack(track);
  }, [track, handlePlayTrack]);

  const handleMoreOptions = useCallback(
    (t: ITrack) => {
      openTrackSheet(t);
    },
    [openTrackSheet],
  );

  // Share state
  const [shared, setShared] = React.useState(false);
  const handleShare = useCallback(async () => {
    if (!track) return;
    const url = `${window.location.origin}/tracks/${track._id || track.slug}`;
    const title = track.title;
    const text = `Nghe "${title}" trên TVP Music`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // ignore
    }
  }, [track]);

  // ── Render States ─────────────────────────────────────────────────────────
  if (isLoading || !track)
    return <WaveformLoader glass={false} text="Đang tải bài hát" />;
  if (!isOnline) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={handleBack}
        />
      </div>
    );
  }
  if (isError || !track) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} onBack={handleBack} />
      </div>
    );
  }

  // Derived sections
  const releaseYear = track.releaseDate
    ? new Date(track.releaseDate).getFullYear()
    : undefined;

  return (
    <main
      className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary"
      aria-label={`Bài hát: ${track.title}`}
    >
      {/* ── Background layers ── */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* ── Back button ── */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm font-bold transition-all duration-200 text-foreground/55 hover:text-foreground px-2 py-1 rounded-lg hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* ── Hero ── */}
        <motion.section
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* Cover image */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SP_HERO, delay: 0.08 }}
            className="group relative size-[180px] sm:size-[220px] lg:size-[240px] shrink-0 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-border/20"
            style={{
              boxShadow: isThisTrackPlaying
                ? `${palette.glowShadow}, 0 25px 50px -12px ${palette.r(0.3)}`
                : `0 25px 50px -12px ${palette.r(0.25)}`,
            }}
          >
            <ImageWithFallback
              src={toCDN(track.coverImage)}
              alt={track.title}
              className={cn(
                "w-full h-full object-cover transition-transform duration-700 ease-out",
                isThisTrackPlaying && "scale-105",
              )}
            />
            {/* Play button overlay */}
            <AnimatePresence>
              {isThisTrackPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0 flex flex-col items-center justify-end pb-5 gap-2"
                  style={{
                    background: `linear-gradient(to top, ${palette.r(0.82)} 0%, ${palette.r(0.18)} 55%, transparent 100%)`,
                  }}
                  aria-hidden="true"
                >
                  <div className="eq-bars h-7">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="eq-bar"
                        style={{ background: "rgba(255,255,255,0.88)" }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-black text-white/72 uppercase tracking-[0.22em]">
                    Đang phát
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Text meta */}
          <motion.div
            className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_HERO, delay: 0.14 }}
          >
            <Badge
              variant="outline"
              className="text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1 bg-background/30 backdrop-blur-md border-white/20 text-foreground/90 shadow-sm"
            >
              Bài hát
            </Badge>

            <div className="overflow-visible min-w-0 w-full">
              <h1
                className={cn(
                  "font-black tracking-tighter text-foreground drop-shadow-lg w-full",
                  "text-center md:text-left",
                  titleCls,
                )}
                style={titleStyle}
              >
                {track.title}
              </h1>
            </div>

            <AnimatePresence>
              {isThisTrackActive && (
                <PlayingPill
                  isPlaying={isThisTrackPlaying}
                  paletteHex={palette.hex}
                  paletteR={palette.r}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* ── Sticky action bar ── */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex flex-wrap items-center justify-between gap-4",
            "transition-[background,box-shadow,border-color] duration-300",
            "top-[var(--navbar-height,64px)]",
            "shadow-brand-dynamic",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
          style={
            {
              "--local-shadow-color": palette.hslChannels ?? "var(--primary)",
            } as React.CSSProperties
          }
        >
          {/* Main Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleMainPlayClick}
              className="size-12 md:size-14 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all text-primary-foreground"
              style={{
                background: palette.hex,
                boxShadow: isThisTrackPlaying
                  ? `${palette.glowShadow}, 0 0 0 5px ${palette.r(0.22)}`
                  : `0 10px 25px -5px ${palette.r(0.4)}`,
              }}
              aria-label={isThisTrackPlaying ? "Tạm dừng" : "Phát nhạc"}
            >
              {isThisTrackPlaying ? (
                <Pause className="size-6 md:size-7 fill-current" />
              ) : (
                <Play className="size-6 md:size-7 fill-current ml-1" />
              )}
            </button>
            <div className="rounded-full flex items-center justify-center border border-border/50 size-10 bg-background/30 backdrop-blur-sm hover:bg-muted/60 transition-all">
              <TrackLikeButton id={track._id} />
            </div>

            <button
              onClick={handleShare}
              className="rounded-full flex items-center justify-center border border-border/50 size-10 bg-background/30 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border active:scale-90 transition-all"
              aria-label="Chia sẻ"
            >
              {shared ? (
                <CheckCheck className="size-4 text-emerald-500" />
              ) : (
                <Share2 className="size-4" />
              )}
            </button>

            <button
              onClick={() => handleMoreOptions(track)}
              className="rounded-full flex items-center justify-center border border-border/50 size-10 bg-background/30 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border active:scale-90 transition-all"
              aria-label="Khác"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>

          {/* Scrolled identity */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                className="flex items-center gap-2.5 pointer-events-none select-none shrink-0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={SP_GENTLE}
              >
                {isThisTrackPlaying && (
                  <WaveformBars
                    color={palette.hex}
                    active={isThisTrackPlaying}
                  />
                )}
                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">
                  {track.title}
                </span>
                <div
                  className={cn(
                    "size-9 sm:size-10 rounded-lg overflow-hidden shrink-0 border transition-all duration-300",
                    isThisTrackPlaying
                      ? "border-transparent"
                      : "border-border/30",
                  )}
                >
                  <ImageWithFallback
                    src={toCDN(track.coverImage)}
                    className="size-full object-cover"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Track Details & Recommendations ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-12">
            <RecommendedSection
              excludeTrackId={track._id}
              onPlay={handlePlayTrack}
            />
            <SimilarSection trackId={track._id} onPlay={handlePlayTrack} />
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <div className="p-5 rounded-2xl bg-card border shadow-sm">
              <h3 className="text-sm font-bold mb-4">Thông tin chi tiết</h3>
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nghệ sĩ</dt>
                  <dd className="font-medium text-right max-w-[60%] truncate">
                    {typeof track.artist === "object"
                      ? track.artist?.name
                      : "Unknown"}
                  </dd>
                </div>
                {track.featuringArtists &&
                  track.featuringArtists.length > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kết hợp cùng</dt>
                      <dd className="font-medium text-right max-w-[60%] truncate">
                        {track.featuringArtists
                          .map((fa) => (typeof fa === "object" ? fa.name : ""))
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                {track.genres && track.genres.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Thể loại</dt>
                    <dd className="font-medium text-right max-w-[60%] truncate">
                      {track.genres
                        .map((g) => (typeof g === "object" ? g.name : ""))
                        .join(", ")}
                    </dd>
                  </div>
                )}
                {track.releaseDate && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Ngày phát hành</dt>
                    <dd className="font-medium text-right">
                      {new Date(track.releaseDate).toLocaleDateString("vi-VN")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Lượt nghe</dt>
                  <dd className="font-medium text-right">
                    {(track.playCount || 0).toLocaleString("vi-VN")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Thời lượng</dt>
                  <dd className="font-medium text-right">
                    {track.duration > 0
                      ? `${formatDuration(track.duration)}`
                      : ""}
                  </dd>
                </div>
              </dl>
            </div>
            {/* Artist, Album, Lyrics sections could go here in the future */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-card border shadow-sm">
              {typeof track.artist === "object" && (
                <TrackDetailArtistCard
                  artist={track.artist}
                  onClick={() => {}}
                />
              )}

                {Array.isArray(track.featuringArtists) &&
                track.featuringArtists.length > 0 &&
                track.featuringArtists.map((fa) =>
                  typeof fa === "object" ? (
                    <TrackDetailArtistCard
                      key={fa._id || fa.slug}
                      artist={fa}
                      onClick={() => {
                        navigate(`/artists/${fa.slug || fa._id}`);
                      }}
                    />
                  ) : null,
                )}
            </div>
            {track.album && typeof track.album === "object" && (
              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 p-5 rounded-2xl bg-card border shadow-sm">
                <TrackDetailAlbumCard
                  album={track.album}
                  onClick={() => {
                    navigate(
                      `/albums/${track.album?.slug || track.album?._id}`,
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-7 border-t border-border/25 pb-8 space-y-2 text-[11px] text-muted-foreground/50 font-medium">
          <p className="font-black text-[10px] uppercase tracking-[0.15em] text-foreground/40">
            {new Date(track.createdAt ?? Date.now()).toLocaleDateString(
              "vi-VN",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            )}
          </p>
          <p>
            © {releaseYear}{" "}
            {typeof track.artist === "object" ? track.artist?.name : "Unknown"}.
            All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
};

export default TrackDetailPage;

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDED SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = memo(
  ({
    icon: Icon,
    label,
    count,
  }: {
    icon: React.ElementType;
    label: string;
    count?: number;
  }) => (
    <div className="flex items-center justify-between mb-4 px-1">
      <div className="flex items-center gap-2 text-[15px] font-bold text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        <h2>{label}</h2>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  ),
);

const RecommendedSection = memo(
  ({
    excludeTrackId,
    onPlay,
  }: {
    excludeTrackId?: string;
    onPlay: (track: ITrack) => void;
  }) => {
    const { openTrackSheet, openAddToPlaylistSheet } = useContextSheet();
    const {
      data: tracks,
      isLoading,
      error,
    } = useRecommendedTracks(APP_CONFIG.SELECTOR_LIMIT, excludeTrackId);

    const handleMoreOptions = useCallback(
      (t: ITrack) => openTrackSheet(t),
      [openTrackSheet],
    );
    const handleAddToPlaylist = useCallback(
      (t: ITrack) => openAddToPlaylistSheet(undefined, [t]),
      [openAddToPlaylistSheet],
    );

    if (error || (!isLoading && (!tracks || tracks.length === 0))) return null;

    return (
      <motion.section variants={STAGGER_ITEM}>
        <SectionLabel icon={Heart} label="Có thể bạn thích" />
        <div className="space-y-0.5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TrackRowSkeleton key={i} />
            ))
          ) : (
            <motion.div
              variants={STAGGER_CONTAINER}
              initial="hidden"
              animate="show"
              className="space-y-0.5"
            >
              {tracks?.map((item: ITrack, idx: number) => (
                <TrackRow
                  key={item._id}
                  item={item}
                  index={idx}
                  onPlay={onPlay}
                  onAddToPlaylist={handleAddToPlaylist}
                  onMoreOptions={handleMoreOptions}
                />
              ))}
            </motion.div>
          )}
        </div>
      </motion.section>
    );
  },
);
RecommendedSection.displayName = "RecommendedSection";

// ─────────────────────────────────────────────────────────────────────────────
// SIMILAR SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SimilarSection = memo(
  ({
    trackId,
    onPlay,
  }: {
    trackId?: string;
    onPlay: (track: ITrack) => void;
  }) => {
    const { openTrackSheet, openAddToPlaylistSheet } = useContextSheet();
    const {
      data: tracks,
      isLoading,
      error,
    } = useSimilarTracks(trackId!, APP_CONFIG.SELECTOR_LIMIT);

    const handleMoreOptions = useCallback(
      (t: ITrack) => openTrackSheet(t),
      [openTrackSheet],
    );
    const handleAddToPlaylist = useCallback(
      (t: ITrack) => openAddToPlaylistSheet(undefined, [t]),
      [openAddToPlaylistSheet],
    );

    if (error || (!isLoading && (!tracks || tracks.length === 0))) return null;

    return (
      <motion.section variants={STAGGER_ITEM} className="mt-8">
        <SectionLabel icon={Radio} label="Bài hát tương tự" />
        <div className="space-y-0.5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TrackRowSkeleton key={i} />
            ))
          ) : (
            <motion.div
              variants={STAGGER_CONTAINER}
              initial="hidden"
              animate="show"
              className="space-y-0.5"
            >
              {tracks?.map((item: ITrack, idx: number) => (
                <TrackRow
                  key={item._id}
                  item={item}
                  index={idx}
                  onPlay={onPlay}
                  onAddToPlaylist={handleAddToPlaylist}
                  onMoreOptions={handleMoreOptions}
                />
              ))}
            </motion.div>
          )}
        </div>
      </motion.section>
    );
  },
);
SimilarSection.displayName = "SimilarSection";
