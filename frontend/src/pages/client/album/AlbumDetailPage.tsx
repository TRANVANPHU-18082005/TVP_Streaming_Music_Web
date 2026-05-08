import React, {
  useMemo,
  useCallback,
  useRef,
  memo,
  lazy,
  Suspense,
  type FC,
  useEffect,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAlbumDetail } from "@/features/album/hooks/useAlbumsQuery";
import {
  AlbumDetailSkeleton,
  IAlbum,
  ITrack,
  useAlbumTracksInfinite,
  useSyncInteractions,
} from "@/features";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import { formatDuration } from "@/utils/track-helper";
import { buildPalette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";
import MusicResult from "@/components/ui/Result";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { APP_CONFIG, SP_GENTLE, SP_HERO, SP_SNAPPY } from "@/config/constants";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { AlbumActionBarProps } from "./components/AlbumActionBar";
import { AlbumHeroCoverProps } from "./components/AlbumHeroCover";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { WaveformBars } from "@/components/MusicVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// Lazy imports — eager preload on module init (not inside effect)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Lazy loads ───────────────────────────────────────────────────────────────
const LazyTrackList = React.lazy(() =>
  import("@/features/track/components/TrackList").then((m) => ({
    default: m.TrackList,
  })),
);
const LazyAlbumActionBar = lazy(() =>
  import("./components/AlbumActionBar").then((m) => ({
    default: m.AlbumActionBar,
  })),
);
const LazyAlbumCover = lazy(() =>
  import("./components/AlbumHeroCover").then((m) => ({
    default: m.AlbumHeroCover,
  })),
);

const AlbumCover = (props: AlbumHeroCoverProps) => (
  <Suspense fallback={null}>
    <LazyAlbumCover {...props} />
  </Suspense>
);

const AlbumActionBar = (props: AlbumActionBarProps) => (
  <Suspense fallback={null}>
    <LazyAlbumActionBar {...props} />
  </Suspense>
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AlbumDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// AlbumStats
// ─────────────────────────────────────────────────────────────────────────────

const AlbumStats = memo<{
  trackCount: number;
  duration: number;
  inline?: boolean;
  className?: string;
}>(({ trackCount, duration, inline, className }) => {
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
      {trackCount} bài hát{durationText}
    </span>
  );
});
AlbumStats.displayName = "AlbumStats";

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
        <AvatarImage src={artistAvatar} />
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
// PlayingPill — animated "Đang phát / Đã tạm dừng" badge
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const AlbumDetailPage: FC<AlbumDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const isEmbedded = variant === "embedded";
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

  // Scroll threshold differs between modes
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 160 : 280);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: album, isLoading, isError, refetch } = useAlbumDetail(slug);

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = useAlbumTracksInfinite(album?._id);

  const {
    togglePlayAlbum,
    shuffleAlbum,
    isThisAlbumActive,
    isThisAlbumPlaying,
    isFetching: isPlaybackFetching,
  } = useAlbumPlayback(album);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  // Prefer server total; fall back to local count
  const totalItems = album?.trackIds.length ?? tracksData?.totalItems ?? 0;

  const albumIds = useMemo(() => (album?._id ? [album._id] : []), [album?._id]);
  useSyncInteractions(albumIds, "like", "album", !!album?._id);

  const syncEnabled = !isLoadingTracks && !!album?._id;
  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", syncEnabled);

  const palette = useMemo(
    () => buildPalette(album?.themeColor ?? "#5b21b6"),
    [album?.themeColor],
  );

  const totalDurationSec = useMemo(
    () => allTracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
    [allTracks],
  );

  const { className: titleCls, style: titleStyle } = useTitleStyle(
    album?.title ?? "",
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  // Prefetch heavy chunks early — fire once on mount
  useEffect(() => {
    void import("@/features/track/components/TrackList");
    void import("./components/AlbumActionBar");
    void import("./components/AlbumHeroCover");
  }, []);
  const handleBack = useSmartBack();

  const handleNavigateArtist = useCallback(() => {
    const artistSlug = album?.artist?.slug;
    if (artistSlug) navigate(`/artists/${artistSlug}`);
  }, [navigate, album?.artist?.slug]);

  const { openAlbumSheet } = useContextSheet();
  const handleMoreOptions = useCallback(
    (a: IAlbum) => openAlbumSheet(a),
    [openAlbumSheet],
  );

  // ── Stable prop objects ───────────────────────────────────────────────────
  //    Only recompute when their specific deps change, not on every render.

  const sharedActionBarProps: AlbumActionBarProps = useMemo(
    () => ({
      album: album!,
      handleMoreOptions,
      palette,
      isLoadingPlay: isPlaybackFetching,
      isLoadingShuffle: isPlaybackFetching,
      isPlaying: isThisAlbumPlaying,
      hasTracks: totalItems > 0,
      onPlay: togglePlayAlbum,
      onShuffle: shuffleAlbum,
    }),

    [
      album,
      handleMoreOptions,
      palette,
      isPlaybackFetching,
      isThisAlbumPlaying,
      totalItems,
      togglePlayAlbum,
      shuffleAlbum,
    ],
  );

  const trackListProps = useMemo(
    () => ({
      allTrackIds: album?.trackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetchTracks,
    }),
    [
      album?.trackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetchTracks,
    ],
  );

  // ── Render guards ─────────────────────────────────────────────────────────

  // Initial skeleton
  if (isLoading && !album) return <AlbumDetailSkeleton />;

  // Transition between albums
  if (isLoading) return <WaveformLoader glass={false} text="Đang tải" />;

  // Offline — shown before data error so the message is meaningful
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

  // Data error or missing album
  if (isError || !album) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} onBack={handleBack} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED FRAGMENTS
  // ─────────────────────────────────────────────────────────────────────────

  const artistMetaNode = (
    <ArtistMeta
      artistName={album.artist?.name}
      artistAvatar={album.artist?.avatar}
      releaseYear={album.releaseYear}
      onNavigate={handleNavigateArtist}
      size={isEmbedded ? "sm" : "md"}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDED VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  if (isEmbedded) {
    return (
      <div
        ref={scrollRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
        role="region"
        aria-label={`Album: ${album.title}`}
      >
        {/* Gradient band */}
        <div
          aria-hidden="true"
          className="sticky top-0 h-[200px] pointer-events-none shrink-0 z-0"
          style={{ background: palette.heroGradient }}
        />

        <div className="relative z-10 -mt-[200px] px-4 pb-10">
          {/* Close button */}
          {onClose && (
            <div className="pt-4 pb-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Đóng
              </button>
            </div>
          )}

          {/* Hero row */}
          <motion.div
            className="flex items-center gap-4 pt-2 pb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SP_GENTLE}
          >
            <AlbumCover
              src={album.coverImage}
              alt={album.title}
              palette={palette}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <Badge
                variant="outline"
                className="text-[9px] font-black uppercase tracking-widest mb-1.5 border-border/40"
              >
                {album.type ?? "Album"}
              </Badge>

              <h2 className="text-xl font-black tracking-tight leading-tight truncate text-foreground">
                {album.title}
              </h2>

              {artistMetaNode}

              {/* Compact playing indicator */}
              <AnimatePresence>
                {isThisAlbumPlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    <WaveformBars
                      color={palette.hex}
                      active={isThisAlbumPlaying}
                    />
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: palette.hex }}
                    >
                      Đang phát
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Action bar */}
          <div className="mb-5">
            <AlbumActionBar {...sharedActionBarProps} density="full" />
          </div>

          <AlbumStats
            trackCount={totalItems || album.totalTracks || 0}
            duration={totalDurationSec}
            className="mb-5"
          />

          <Suspense fallback={<WaveformLoader glass={false} text="Đang tải" />}>
            <LazyTrackList
              {...trackListProps}
              maxHeight="auto"
              moodColor={palette.hslChannels}
              skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
              staggerAnimation={false}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main
      className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary"
      aria-label={`Album: ${album.title}`}
    >
      {/* ── Background layers ── */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      {/* Noise grain */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      {/* Fade to bg */}
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
          aria-label="Thông tin album"
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
          >
            <AlbumCover
              src={album.coverImage}
              alt={album.title}
              palette={palette}
              isPlaying={isThisAlbumPlaying}
            />
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
              {album.type ?? "Album"}
            </Badge>

            {/* Title */}
            <div className="overflow-visible min-w-0 w-full">
              <h1
                className={cn(
                  "font-black tracking-tighter text-foreground drop-shadow-lg w-full",
                  "text-center md:text-left",
                  titleCls,
                )}
                style={titleStyle}
              >
                {album.title}
              </h1>
            </div>

            {/* Artist · Year · Stats row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1.5 mt-1">
              {artistMetaNode}
              <span
                className="text-foreground/30 text-xs hidden sm:inline"
                aria-hidden="true"
              >
                •
              </span>
              <AlbumStats
                trackCount={totalItems || album.totalTracks || 0}
                duration={totalDurationSec}
                inline
              />
            </div>

            {/* Playing pill */}
            <AnimatePresence>
              {isThisAlbumActive && (
                <PlayingPill
                  isPlaying={isThisAlbumPlaying}
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
            "flex items-center justify-between gap-4",
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
          <AlbumActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled identity: title + thumbnail + EQ */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                className="flex items-center gap-2.5 pointer-events-none select-none shrink-0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={SP_GENTLE}
                aria-hidden="true"
              >
                {/* EQ only when playing */}
                {isThisAlbumPlaying && (
                  <WaveformBars
                    color={palette.hex}
                    active={isThisAlbumPlaying}
                  />
                )}

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
                  {album.title}
                </span>

                {/* Thumbnail with playing ring */}
                <div
                  className={cn(
                    "size-9 sm:size-10 rounded-lg overflow-hidden shrink-0 border transition-all duration-300",
                    isThisAlbumPlaying
                      ? "border-transparent"
                      : "border-border/30",
                  )}
                  style={
                    isThisAlbumPlaying
                      ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` }
                      : undefined
                  }
                >
                  <ImageWithFallback
                    src={album.coverImage || "/images/default-album.png"}
                    alt=""
                    aria-hidden="true"
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Track list ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SP_GENTLE, delay: 0.22 }}
        >
          <Suspense fallback={<AlbumDetailSkeleton variant="page" />}>
            <LazyTrackList
              {...trackListProps}
              maxHeight="auto"
              skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
              moodColor={palette.hslChannels}
              staggerAnimation
            />
          </Suspense>
        </motion.div>

        {/* ── Footer ── */}
        {allTracks.length > 0 && album.releaseYear && (
          <footer className="mt-16 pt-7 border-t border-border/25 pb-8 space-y-2 text-[11px] text-muted-foreground/50 font-medium">
            <p className="font-black text-[10px] uppercase tracking-[0.15em] text-foreground/40">
              {new Date(album.createdAt ?? Date.now()).toLocaleDateString(
                "vi-VN",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )}
            </p>
            <p>
              © {album.releaseYear} {album.artist?.name ?? "Unknown"}. All
              rights reserved.
            </p>
            <p>
              ℗ {album.releaseYear} {album.artist?.name ?? "Unknown"} Official
              Records.
            </p>
          </footer>
        )}
      </div>
    </main>
  );
};

export default AlbumDetailPage;
