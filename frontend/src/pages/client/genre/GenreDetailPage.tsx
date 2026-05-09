import React, {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
  Suspense,
  type FC,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Music4,
  Hash,
  Mic2,
  ListMusic,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { cn } from "@/lib/utils";
import { SubGenreGrid } from "@/features/genre/components/SubGenreGrid";
import {
  useGenreDetailQuery,
  useGenreTracksInfinite,
} from "@/features/genre/hooks/useGenresQuery";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import { buildPalette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";
import type { QueueSourceType } from "@/features/player/slice/playerSlice";

import MusicResult from "@/components/ui/Result";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { APP_CONFIG, SP_GENTLE, SP_HERO, SP_SNAPPY } from "@/config/constants";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { GenreActionBarProps } from "./components/GenreActionBar";
import { GenreCoverProps } from "./components/GenreCover";
import { formatCount } from "@/utils/track-helper";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WaveformBars } from "@/components/MusicVisualizer";
import { ITrack } from "@/features/track";
import { Genredetailskeleton, IGenreDetail } from "@/features/genre";

dayjs.extend(relativeTime);

// ─── Static constants — defined outside component to avoid re-creation ────────

const LazyTrackList = React.lazy(() =>
  import("@/features/track/components/TrackList").then((m) => ({
    default: m.TrackList,
  })),
);
// Lightweight wrappers — single Suspense boundary per lazy component
const LazyGenreCover = React.lazy(() =>
  import("./components/GenreCover").then((m) => ({
    default: m.GenreCover,
  })),
);
const GenreCover = (props: GenreCoverProps) => (
  <Suspense fallback={null}>
    <LazyGenreCover {...props} />
  </Suspense>
);

const LazyGenreActionBar = React.lazy(() =>
  import("./components/GenreActionBar").then((m) => ({
    default: m.GenreActionBar,
  })),
);
const GenreActionBar = (props: GenreActionBarProps) => (
  <Suspense fallback={null}>
    <LazyGenreActionBar {...props} />
  </Suspense>
);
// ─── Types ────────────────────────────────────────────────────────────────────

interface GenreDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─── Playing status pill ──────────────────────────────────────────────────────

const PlayingPill = memo<{
  isActive: boolean;
  isPlaying: boolean;
  palette: ReturnType<typeof buildPalette>;
}>(({ isActive, isPlaying, palette }) => (
  <AnimatePresence>
    {isActive && (
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 4 }}
        transition={SP_SNAPPY}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
        style={{ background: palette.r(0.1), borderColor: palette.r(0.28) }}
      >
        <WaveformBars color={palette.hex} active={isPlaying} />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: palette.hex }}
        >
          {isPlaying ? "Đang phát" : "Đã tạm dừng"}
        </span>
      </motion.div>
    )}
  </AnimatePresence>
));
PlayingPill.displayName = "PlayingPill";

// ─── Genre Stats ──────────────────────────────────────────────────────────────

const GenreStats = memo<{
  trackCount?: number;
  artistCount?: number;
  variant?: "default" | "inline" | "compact";
  className?: string;
}>(({ trackCount, artistCount, variant = "default", className }) => {
  const hasTrack = (trackCount ?? 0) > 0;
  const hasArtist = (artistCount ?? 0) > 0;

  if (!hasTrack && !hasArtist) return null;

  const isInline = variant === "inline";
  const isCompact = variant === "compact";

  return (
    <div
      className={cn("flex items-center flex-wrap gap-x-2 gap-y-1", className)}
    >
      {hasTrack && (
        <span
          className={cn(
            "flex items-center gap-1.5",
            isInline
              ? "text-sm font-semibold text-foreground/70"
              : isCompact
                ? "text-[11px] font-bold text-foreground/60"
                : "text-[13px] font-bold text-foreground/80",
          )}
        >
          <ListMusic
            className="size-3.5 text-muted-foreground/50 shrink-0"
            aria-hidden
          />
          {formatCount(trackCount!)} bài hát
        </span>
      )}
      {hasTrack && hasArtist && (
        <span
          className="text-muted-foreground/30 text-xs hidden sm:inline"
          aria-hidden
        >
          ·
        </span>
      )}
      {hasArtist && (
        <span
          className={cn(
            "flex items-center gap-1.5",
            isInline
              ? "text-sm font-medium text-foreground/60"
              : isCompact
                ? "text-[11px] font-medium text-muted-foreground/70"
                : "text-[13px] font-medium text-muted-foreground",
          )}
        >
          <Mic2 className="size-3.5 opacity-50 shrink-0" aria-hidden />
          {formatCount(artistCount!)} nghệ sĩ
        </span>
      )}
    </div>
  );
});
GenreStats.displayName = "GenreStats";

// ─── Section Headers ──────────────────────────────────────────────────────────

const SectionHeader = memo<{
  label: string;
  icon?: React.ReactNode;
  variant?: "page" | "embedded";
}>(({ label, icon, variant = "page" }) => {
  if (variant === "embedded") {
    return (
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-px rounded-full bg-primary/40"
          aria-hidden
        />
        {label}
      </p>
    );
  }
  return (
    <h2 className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-2 text-foreground uppercase">
      {label}
      {icon}
    </h2>
  );
});
SectionHeader.displayName = "SectionHeader";

// ─── Cover thumbnail (sticky bar) ─────────────────────────────────────────────

const CoverThumb = memo<{
  image?: string;
  isPlaying: boolean;
  palette: ReturnType<typeof buildPalette>;
}>(({ image, isPlaying, palette }) => (
  <div
    className={cn(
      "size-9 sm:size-10 rounded-xl overflow-hidden shrink-0 border transition-all duration-300 bg-muted flex items-center justify-center",
      isPlaying ? "border-transparent" : "border-border/35",
    )}
    style={isPlaying ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` } : undefined}
  >
    {image ? (
      <img src={image} alt="" aria-hidden className="size-full object-cover" />
    ) : (
      <Music4 className="size-4 text-muted-foreground/40" aria-hidden />
    )}
  </div>
));
CoverThumb.displayName = "CoverThumb";

// ─── Main Component ───────────────────────────────────────────────────────────

export const GenreDetailPage: FC<GenreDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const isEmbedded = variant === "embedded";
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Scroll tracking ──────────────────────────────────────────────────────
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 130 : 260);

  // ── Data fetching ────────────────────────────────────────────────────────
  const {
    data: genre,
    isLoading,
    isError,
    refetch,
  } = useGenreDetailQuery(slug);

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = useGenreTracksInfinite(genre?._id);

  const {
    togglePlayGenre,
    shuffleGenre,
    isThisGenreActive,
    isThisGenrePlaying,
    isFetching,
  } = useGenrePlayback(genre);

  const { className: titleCls, style: titleStyle } = useTitleStyle(
    genre?.name ?? "",
  );

  // ── Derived state ────────────────────────────────────────────────────────

  // allTracks: only recompute when allTracks reference changes
  const allTracks = useMemo(
    () => tracksData?.allTracks ?? ([] as ITrack[]),
    [tracksData?.allTracks],
  );

  // totalItems: prefer genre's authoritative count
  const totalItems = genre?.trackIds.length ?? tracksData?.totalItems ?? 0;

  // Sync interactions only when tracks are loaded
  useSyncInteractionsPaged(
    tracksData?.allTracks,
    "like",
    "track",
    !isLoadingTracks && !!genre?._id,
  );

  // Palette: only recompute when color changes
  const palette = useMemo(
    () => buildPalette(genre?.color ?? "#8b5cf6"),
    [genre?.color],
  );

  // ── Side effects ─────────────────────────────────────────────────────────

  // Reset scroll on slug change (page mode only)
  useEffect(() => {
    if (variant === "page") window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug, variant]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleBack = useSmartBack();

  const { openGenreSheet } = useContextSheet();
  const handleMoreOptions = useCallback(
    (g: IGenreDetail) => openGenreSheet(g),
    [openGenreSheet],
  );

  // ── Shared prop objects (stable references) ───────────────────────────────

  const sharedActionBarProps: GenreActionBarProps = useMemo(
    () => ({
      genre: genre!,
      handleMoreOptions,
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisGenrePlaying,
      loadingTracks: isLoadingTracks,
      hasTracks: totalItems > 0,
      onPlay: togglePlayGenre,
      onShuffle: shuffleGenre,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      genre,
      handleMoreOptions,
      palette,
      isFetching,
      isThisGenrePlaying,
      isLoadingTracks,
      totalItems,
      togglePlayGenre,
      shuffleGenre,
    ],
  );

  const trackListProps = useMemo(
    () => ({
      allTrackIds: genre?.trackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetchTracks,
      source: {
        id: genre?._id ?? "",
        type: "genre" as QueueSourceType,
        title: genre?.name,
        url: `/genres/${genre?.slug}`,
      },
    }),

    [
      genre?.trackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetchTracks,
      genre?._id,
      genre?.name,
      genre?.slug,
    ],
  );

  // ── Early render guards ───────────────────────────────────────────────────
  const isOnline = useOnlineStatus();

  // Check offline first — cheapest guard
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

  // Initial skeleton
  if (isLoading && !genre) {
    return <Genredetailskeleton />;
  }

  // Slug-switch loading (genre exists but is stale)
  if (isLoading && genre) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }

  // Error or missing data
  if (isError || !genre) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
    );
  }

  // ── EMBEDDED VARIANT ──────────────────────────────────────────────────────

  if (isEmbedded) {
    return (
      <div
        ref={scrollRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
        role="region"
        aria-label={`Thể loại: ${genre.name}`}
      >
        {/* Hero gradient band */}
        <div
          aria-hidden
          className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
          style={{ background: palette.heroGradient }}
        />

        <div className="relative z-10 -mt-[160px] px-4 pb-10">
          {/* Close button */}
          {onClose && (
            <div className="flex items-center pt-4 pb-2">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/55 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md px-1 py-0.5 -ml-1"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Đóng
              </button>
            </div>
          )}

          {/* Header row */}
          <motion.div
            className="flex items-center gap-4 pt-4 pb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SP_GENTLE}
          >
            <GenreCover
              image={genre.image}
              name={genre.name}
              palette={palette}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">
                Thể loại
              </p>
              <h2 className="text-xl font-black tracking-tight leading-tight truncate text-foreground">
                {genre.name}
              </h2>
              <GenreStats
                trackCount={genre.trackCount}
                artistCount={genre.artistCount}
                variant="compact"
                className="mt-1"
              />
              {/* Playing indicator */}
              <AnimatePresence>
                {isThisGenrePlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    <WaveformBars
                      color={palette.hex}
                      active={isThisGenrePlaying}
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
            <GenreActionBar {...sharedActionBarProps} density="full" />
          </div>

          {/* Description */}
          {genre.description && (
            <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-5 line-clamp-3">
              {genre.description}
            </p>
          )}

          {/* Sub-genres */}
          {genre.subGenres?.length > 0 && (
            <div className="mt-6">
              <SectionHeader label="Phân nhánh" variant="embedded" />
              <div className="mt-3">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </div>
          )}

          {/* Track list */}
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

  // ── PAGE VARIANT ──────────────────────────────────────────────────────────

  return (
    <main
      className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700"
      aria-label={`Thể loại: ${genre.name}`}
    >
      {/* Background layers */}
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back nav */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-all duration-200 px-2 py-1 rounded-lg hover:bg-background/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Quay lại
          </button>
        </div>

        {/* Hero section */}
        <motion.section
          aria-label="Thông tin thể loại"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Cover art */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SP_HERO, delay: 0.08 }}
          >
            <GenreCover
              image={genre.image}
              name={genre.name}
              palette={palette}
              isPlaying={isThisGenrePlaying}
              size="lg"
            />
          </motion.div>

          {/* Meta info */}
          <motion.div
            className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_HERO, delay: 0.14 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
              <Hash className="size-3" aria-hidden />
              Thể loại âm nhạc
            </div>

            {/* Title */}
            <h1
              className={cn(
                "font-black tracking-tighter text-foreground drop-shadow-lg w-full",
                "text-center md:text-left",
                titleCls,
              )}
              style={titleStyle}
            >
              {genre.name}
            </h1>

            {/* Description */}
            {genre.description && (
              <p className="text-muted-foreground text-sm md:text-[15px] font-medium line-clamp-2 max-w-xl mt-0.5">
                {genre.description}
              </p>
            )}

            {/* Stats */}
            <GenreStats
              trackCount={genre.trackCount}
              artistCount={genre.artistCount}
              variant="inline"
              className="mt-1 justify-center md:justify-start"
            />

            {/* Parent genre nav */}
            {genre.parentId && (
              <button
                type="button"
                onClick={() => {
                  const parentSlug =
                    typeof genre.parentId === "object"
                      ? genre.parentId?.slug
                      : undefined;
                  if (parentSlug) navigate(`/genres/${parentSlug}`);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-foreground/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <ChevronLeft className="size-3" aria-hidden />
                Thuộc dòng nhạc:&nbsp;
                <span className="underline underline-offset-2">
                  {typeof genre.parentId === "object"
                    ? genre.parentId?.name
                    : ""}
                </span>
              </button>
            )}

            {/* Playing pill */}
            <PlayingPill
              isActive={isThisGenreActive}
              isPlaying={isThisGenrePlaying}
              palette={palette}
            />
          </motion.div>
        </motion.section>

        {/* Sticky action bar */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-10",
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
              "--local-shadow-color": palette.hslChannels || "var(--primary)",
            } as React.CSSProperties
          }
        >
          <GenreActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled identity */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                className="flex items-center gap-2.5 pointer-events-none select-none shrink-0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={SP_GENTLE}
                aria-hidden
              >
                {isThisGenrePlaying && (
                  <WaveformBars
                    color={palette.hex}
                    active={isThisGenrePlaying}
                  />
                )}

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[220px] hidden sm:block">
                  {genre.name}
                </span>

                <CoverThumb
                  image={genre.image}
                  isPlaying={isThisGenrePlaying}
                  palette={palette}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content sections */}
        <div className="space-y-16">
          {genre.subGenres?.length > 0 && (
            <motion.section
              aria-label="Phân nhánh"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_GENTLE, delay: 0.18 }}
            >
              <SectionHeader
                label={`Phân nhánh của ${genre.name}`}
                icon={
                  <ChevronRight
                    className="size-5 text-muted-foreground/50"
                    aria-hidden
                  />
                }
              />
              <div className="mt-6">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </motion.section>
          )}

          <motion.section
            aria-label="Bài hát nổi bật"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_GENTLE, delay: 0.22 }}
          >
            <div className="flex items-center justify-between mb-5">
              <SectionHeader label="Bài hát nổi bật" />
              {!isLoadingTracks && totalItems > 0 && (
                <span className="text-xs font-bold text-muted-foreground tabular-nums">
                  {formatCount(totalItems)} bài
                </span>
              )}
            </div>
            {/* ── Track list ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_GENTLE, delay: 0.22 }}
            >
              <Suspense fallback={<Genredetailskeleton variant="page" />}>
                <LazyTrackList
                  {...trackListProps}
                  maxHeight="auto"
                  skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
                  moodColor={palette.hslChannels}
                  staggerAnimation
                />
              </Suspense>
            </motion.div>
          </motion.section>
        </div>
      </div>
    </main>
  );
};

export default GenreDetailPage;
