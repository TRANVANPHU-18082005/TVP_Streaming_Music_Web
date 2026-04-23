import React, {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
  type FC,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Shuffle,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Share2,
  SearchX,
  Loader2,
  Music4,
  RefreshCw,
  Hash,
  Mic2,
  ListMusic,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SubGenreGrid } from "@/features/genre/components/SubGenreGrid";
import { TrackList } from "@/features/track/components/TrackList";

import { Genredetailskeleton, ITrack } from "@/features";
import {
  useGenreDetailQuery,
  useGenreTracksInfinite,
} from "@/features/genre/hooks/useGenresQuery";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import { buildPalette, Palette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";

import MusicResult from "@/components/ui/Result";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

dayjs.extend(relativeTime);

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — same as AlbumDetailPage for consistency
// ─────────────────────────────────────────────────────────────────────────────

const SP_GENTLE = { type: "spring", stiffness: 300, damping: 30 } as const;
const SP_SNAPPY = { type: "spring", stiffness: 440, damping: 28 } as const;
const SP_HERO = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface GenreDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const formatCount = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

// ─────────────────────────────────────────────────────────────────────────────
// GenreStats — memo'd
// ─────────────────────────────────────────────────────────────────────────────

const GenreStats = memo<{
  trackCount?: number;
  artistCount?: number;
  inline?: boolean;
  className?: string;
}>(({ trackCount, artistCount, inline, className }) => (
  <div className={cn("flex items-center flex-wrap gap-x-2 gap-y-1", className)}>
    {(trackCount ?? 0) > 0 && (
      <span
        className={cn(
          "flex items-center gap-1",
          inline
            ? "text-sm font-semibold text-foreground/70"
            : "text-[13px] font-bold text-foreground/80",
        )}
      >
        <ListMusic
          className="size-3.5 text-muted-foreground/50"
          aria-hidden="true"
        />
        {formatCount(trackCount!)} bài hát
      </span>
    )}
    {(artistCount ?? 0) > 0 && (
      <>
        <span
          className="text-muted-foreground/40 text-xs hidden sm:inline"
          aria-hidden="true"
        >
          •
        </span>
        <span
          className={cn(
            "flex items-center gap-1",
            inline
              ? "text-sm font-medium text-foreground/60"
              : "text-[13px] font-medium text-muted-foreground",
          )}
        >
          <Mic2 className="size-3.5 opacity-50" aria-hidden="true" />
          {formatCount(artistCount!)} nghệ sĩ
        </span>
      </>
    )}
  </div>
));
GenreStats.displayName = "GenreStats";

// ─────────────────────────────────────────────────────────────────────────────
// Section headers — memo'd
// ─────────────────────────────────────────────────────────────────────────────

const PageSectionHeader = memo<{ label: string; icon?: React.ReactNode }>(
  ({ label, icon }) => (
    <h2 className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-2 text-foreground uppercase">
      {label}
      {icon}
    </h2>
  ),
);
PageSectionHeader.displayName = "PageSectionHeader";

const EmbeddedSectionHeader = memo<{ label: string }>(({ label }) => (
  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-1.5">
    <span
      className="inline-block w-3 h-0.5 rounded-full bg-primary/50"
      aria-hidden="true"
    />
    {label}
  </p>
));
EmbeddedSectionHeader.displayName = "EmbeddedSectionHeader";

// ─────────────────────────────────────────────────────────────────────────────
// GenreNotFound — memo'd
// ─────────────────────────────────────────────────────────────────────────────

const GenreNotFound = memo<{
  onBack: () => void;
  onRetry: () => void;
}>(({ onBack, onRetry }) => (
  <div
    className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in fade-in zoom-in-95 duration-500"
    role="alert"
    aria-live="assertive"
  >
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-primary/[0.08] blur-3xl rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-3xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <SearchX
          className="size-10 text-muted-foreground/50"
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground uppercase">
        Không tìm thấy thể loại
      </h2>
      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
        Dòng nhạc này có thể đã bị xóa, đổi đường dẫn, hoặc chưa được thêm vào
        hệ thống.
      </p>
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border/60 text-sm font-bold text-foreground/80 hover:bg-muted/60 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Thử lại
      </button>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Khám phá thể loại khác
      </button>
    </div>
  </div>
));
GenreNotFound.displayName = "GenreNotFound";

// ─────────────────────────────────────────────────────────────────────────────
// GenreCover — enhanced with playing state, spinning ring, EQ overlay
// Mirrors HeroCover from AlbumDetailPage
// ─────────────────────────────────────────────────────────────────────────────

const GenreCover = memo<{
  image?: string;
  name: string;
  palette: Palette;
  isPlaying?: boolean;
  size?: "sm" | "lg";
}>(({ image, name, palette, isPlaying = false, size = "lg" }) => {
  const isLg = size === "lg";

  return (
    <div
      className={cn(
        "group relative shrink-0",
        isLg ? "self-center md:self-auto" : "",
      )}
    >
      {/* Glow halo */}
      <div
        aria-hidden="true"
        className="absolute -inset-3 rounded-2xl blur-3xl pointer-events-none transition-opacity duration-700"
        style={{
          backgroundColor: palette.hex,
          opacity: isPlaying ? 0.48 : 0.22,
        }}
      />

      {/* Spinning conic ring — only lg + playing */}
      <AnimatePresence>
        {isPlaying && isLg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            aria-hidden="true"
            className="absolute -inset-[5px] rounded-2xl pointer-events-none"
            style={{
              background: `conic-gradient(
                ${palette.r(0.9)} 0deg,
                ${palette.r(0.1)} 120deg,
                ${palette.r(0.7)} 240deg,
                ${palette.r(0.9)} 360deg
              )`,
              animation: "album-ring-spin 4s linear infinite",
            }}
          />
        )}
      </AnimatePresence>

      {/* Cover shell */}
      <div
        className={cn(
          "relative overflow-hidden bg-muted border border-white/10",
          "transition-[transform,box-shadow] duration-500 group-hover:scale-[1.012]",
          isLg
            ? "size-[180px] sm:size-[220px] md:size-[260px] lg:size-[300px] rounded-2xl"
            : "size-16 sm:size-20 rounded-xl",
        )}
        style={
          isPlaying && isLg
            ? {
                boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
              }
            : { boxShadow: "0 16px 40px rgba(0,0,0,0.38)" }
        }
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className={cn(
              "size-full object-cover",
              "transition-[transform,filter] duration-700 group-hover:scale-105",
              isPlaying && isLg && "saturate-[1.15] brightness-[0.88]",
            )}
            loading={isLg ? "eager" : "lazy"}
            fetchPriority={isLg ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${palette.r(0.3)} 0%, ${palette.r(0.08)} 100%)`,
            }}
          >
            <Music4
              className={cn(
                "text-muted-foreground/30",
                isLg ? "size-16" : "size-7",
              )}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Now Playing overlay — EQ bars + gradient tint */}
        <AnimatePresence>
          {isPlaying && isLg && (
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

        {/* Inner ring inset */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/15 pointer-events-none"
        />
      </div>
    </div>
  );
});
GenreCover.displayName = "GenreCover";

// ─────────────────────────────────────────────────────────────────────────────
// GenreContextMenu — extracted from inline dropdown
// ─────────────────────────────────────────────────────────────────────────────

const GenreContextMenu = memo<{ size?: "sm" | "md"; align?: "start" | "end" }>(
  ({ size = "md", align = "start" }) => {
    const btnCls = cn(
      "rounded-full flex items-center justify-center border border-border/50",
      "bg-background/30 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
      "transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      size === "sm" ? "size-9" : "size-10 sm:size-11",
    );
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btnCls} aria-label="More options">
            <MoreHorizontal
              className={size === "sm" ? "size-4" : "size-[18px]"}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
        >
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Share2
              className="size-4 text-primary shrink-0"
              aria-hidden="true"
            />
            Chia sẻ thể loại
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <ListMusic
              className="size-4 text-[hsl(var(--success))] shrink-0"
              aria-hidden="true"
            />
            Thêm vào hàng đợi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
GenreContextMenu.displayName = "GenreContextMenu";

// ─────────────────────────────────────────────────────────────────────────────
// ActionBar — mirrors AlbumDetailPage's ActionBar
// Play/Pause toggle, isPlaying state, motion animations, glow shadow
// ─────────────────────────────────────────────────────────────────────────────

interface ActionBarProps {
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isPlaying: boolean;
  loadingTracks: boolean;
  hasTracks: boolean;
  density?: "compact" | "full";
  onPlay: () => void;
  onShuffle: () => void;
}

const ActionBar = memo<ActionBarProps>(
  ({
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isPlaying,
    loadingTracks,
    hasTracks,
    density = "full",
    onPlay,
    onShuffle,
  }) => {
    const isCompact = density === "compact";
    const playSz = isCompact ? "size-12" : "size-14 sm:size-16";
    const playIconSz = isCompact ? "size-5" : "size-6 sm:size-7";
    const ctrlSz = isCompact ? "size-10" : "size-10 sm:size-11";
    const ctrlIconSz = isCompact ? "size-3.5" : "size-4";
    const canPlay = hasTracks && !isLoadingPlay;
    const canShuffle = hasTracks && !isLoadingShuffle;

    return (
      <div
        className="flex items-center gap-3"
        role="toolbar"
        aria-label="Genre controls"
      >
        {/* ── PLAY / PAUSE ── */}
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause genre" : "Play genre"}
          aria-pressed={isPlaying}
          className={cn(
            playSz,
            "rounded-full flex items-center justify-center shrink-0 shadow-lg",
            "transition-[box-shadow,transform] duration-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={{
            backgroundColor: palette.hex,
            boxShadow: isPlaying
              ? `${palette.glowShadow}, 0 0 0 5px ${palette.r(0.22)}`
              : palette.glowShadow,
          }}
          whileHover={canPlay ? { scale: 1.06 } : undefined}
          whileTap={canPlay ? { scale: 0.93 } : undefined}
          transition={SP_SNAPPY}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoadingPlay || loadingTracks ? (
              <motion.span
                key="load"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2
                  className={cn(playIconSz, "text-white animate-spin")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : isPlaying ? (
              <motion.span
                key="pause"
                initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
                transition={SP_SNAPPY}
              >
                <Pause
                  className={cn(playIconSz, "text-white fill-white")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.6, opacity: 0, rotate: 15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: -15 }}
                transition={SP_SNAPPY}
              >
                <Play
                  className={cn(playIconSz, "text-white fill-white ml-0.5")}
                  aria-hidden="true"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* ── SHUFFLE ── */}
        <motion.button
          type="button"
          onClick={onShuffle}
          disabled={!canShuffle}
          aria-label="Shuffle genre"
          className={cn(
            ctrlSz,
            "rounded-full flex items-center justify-center border border-border/50",
            "bg-background/30 backdrop-blur-sm text-foreground/70",
            "hover:text-foreground hover:bg-muted/60 hover:border-border",
            "transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
          whileTap={canShuffle ? { scale: 0.9 } : undefined}
          transition={SP_SNAPPY}
        >
          {isLoadingShuffle ? (
            <Loader2
              className={cn(ctrlIconSz, "animate-spin")}
              aria-hidden="true"
            />
          ) : (
            <Shuffle className={ctrlIconSz} aria-hidden="true" />
          )}
        </motion.button>

        <div className="flex-1" aria-hidden="true" />
        <GenreContextMenu size={isCompact ? "sm" : "md"} align="end" />
      </div>
    );
  },
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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

  // useScrollY — same pattern as AlbumDetailPage
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 130 : 260);

  // ── Data ──────────────────────────────────────────────────────────────────

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
  // ── Derived ───────────────────────────────────────────────────────────────

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const totalItems = useMemo(
    () => genre?.trackIds.length ?? tracksData?.totalItems ?? 0,
    [genre?.trackIds.length, tracksData?.totalItems],
  );

  const syncEnabled = useMemo(
    () => !isLoadingTracks && !!genre?._id,
    [isLoadingTracks, genre?._id],
  );
  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", syncEnabled);

  // buildPalette — same as AlbumDetailPage
  const palette = useMemo(
    () => buildPalette(genre?.color ?? "#8b5cf6"),
    [genre?.color],
  );

  // ── Reset scroll on slug change (page mode only) ──────────────────────────

  useEffect(() => {
    if (variant === "page") window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug, variant]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (isEmbedded && onClose) onClose();
    else {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [isEmbedded, onClose, navigate]);

  // ── Shared props ──────────────────────────────────────────────────────────
  const sharedActionBarProps: ActionBarProps = useMemo(
    () => ({
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisGenrePlaying,
      loadingTracks: isLoadingTracks,
      hasTracks: totalItems > 0,
      onPlay: togglePlayGenre,
      onShuffle: shuffleGenre,
    }),
    [
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
    ],
  );

  // ── Render guards ─────────────────────────────────────────────────────────
  // ── Render guards ─────────────────────────────────────────────────────────
  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !genre) {
    return <Genredetailskeleton />;
  }
  // Switching
  if (isLoading && genre) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (isError || !genre) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
  // Offline
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={handleBack}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDED VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  if (isEmbedded) {
    return (
      <div
        ref={scrollRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
        role="region"
        aria-label={`Genre: ${genre.name}`}
      >
        <div
          aria-hidden="true"
          className="sticky top-0 h-[180px] shrink-0 pointer-events-none z-0"
          style={{ background: palette.heroGradient }}
        />

        <div className="relative z-10 -mt-[180px] px-4 pb-10">
          {onClose && (
            <div className="flex items-center pt-4 pb-3">
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

          <motion.div
            className="flex items-center gap-4 pt-3 pb-5"
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
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                Thể loại
              </p>
              <h2 className="text-xl font-black tracking-tight leading-tight truncate text-foreground">
                {genre.name}
              </h2>
              <GenreStats
                trackCount={genre.trackCount}
                artistCount={genre.artistCount}
                className="mt-1"
              />
              {/* Playing indicator in embedded */}
              <AnimatePresence>
                {isThisGenrePlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="eq-bar w-[3px] rounded-full sw-animate-eq"
                        style={{
                          animationDelay: `${i * 0.12}s`,
                          backgroundColor: palette.hex,
                        }}
                      />
                    ))}
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

          <div className="mb-5">
            <ActionBar {...sharedActionBarProps} density="full" />
          </div>

          {genre.description && (
            <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-2 mb-5 line-clamp-3">
              {genre.description}
            </p>
          )}

          {genre.subGenres?.length > 0 && (
            <div className="mt-7">
              <EmbeddedSectionHeader label="Phân nhánh" />
              <div className="mt-3">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </div>
          )}

          <div className="mt-7">
            <EmbeddedSectionHeader label="Bài hát nổi bật" />
            <TrackList
              {...trackListProps}
              maxHeight={400}
              moodColor={palette.hex}
              skeletonCount={7}
              staggerAnimation={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* Background layers — matches AlbumDetailPage structure */}
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden="true"
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
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* Hero — motion entrance like AlbumDetailPage */}
        <motion.section
          aria-label="Genre details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Cover */}
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

          {/* Meta */}
          <motion.div
            className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_HERO, delay: 0.14 }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
              <Hash className="size-3" aria-hidden="true" />
              Thể loại âm nhạc
            </div>

            <div className="overflow-visible min-w-0 w-full">
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
            </div>

            {genre.description && (
              <p className="text-muted-foreground text-sm md:text-[15px] font-medium line-clamp-2 max-w-xl mt-0.5">
                {genre.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 mt-1.5">
              <GenreStats
                trackCount={genre.trackCount}
                artistCount={genre.artistCount}
                inline
              />
            </div>

            {/* Parent genre navigation */}
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
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-foreground/55 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <ChevronLeft className="size-3" aria-hidden="true" />
                Thuộc dòng nhạc:{" "}
                <span className="underline underline-offset-2">
                  {typeof genre.parentId === "object"
                    ? genre.parentId?.name
                    : ""}
                </span>
              </button>
            )}

            {/* Playing status pill — mirrors AlbumDetailPage */}
            <AnimatePresence>
              {isThisGenreActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: 4 }}
                  transition={SP_SNAPPY}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
                  style={{
                    background: palette.r(0.1),
                    borderColor: palette.r(0.28),
                  }}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "eq-bars shrink-0 flex items-end gap-[2px] h-4",
                      !isThisGenrePlaying && "paused opacity-40",
                      "transition-opacity duration-300",
                    )}
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="eq-bar w-[3px] rounded-full sw-animate-eq"
                        style={{
                          animationDelay: `${i * 0.12}s`,
                          backgroundColor: palette.hex,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: palette.hex }}
                  >
                    {isThisGenrePlaying ? "Đang phát" : "Đã tạm dừng"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* Sticky Action Bar — mirrors AlbumDetailPage */}
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
          <ActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled genre identity — with playing state */}
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
                {/* Mini EQ when playing */}
                <AnimatePresence>
                  {isThisGenrePlaying && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "eq-bars shrink-0 flex items-end gap-[2px] h-4",
                        "transition-opacity duration-300",
                      )}
                    >
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className="eq-bar w-[3px] rounded-full sw-animate-eq"
                          style={{
                            animationDelay: `${i * 0.12}s`,
                            backgroundColor: palette.hex,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[220px] hidden sm:block">
                  {genre.name}
                </span>

                {/* Cover thumbnail — ring when playing */}
                <div
                  className={cn(
                    "size-9 sm:size-10 rounded-xl overflow-hidden shrink-0 border transition-all duration-300 bg-muted flex items-center justify-center",
                    isThisGenrePlaying
                      ? "border-transparent"
                      : "border-border/35",
                  )}
                  style={
                    isThisGenrePlaying
                      ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` }
                      : undefined
                  }
                >
                  {genre.image ? (
                    <img
                      src={genre.image}
                      alt=""
                      aria-hidden="true"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Music4
                      className="size-4 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main content — motion entrance */}
        <div className="space-y-16">
          {genre.subGenres?.length > 0 && (
            <motion.section
              aria-label="Sub-genres"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_GENTLE, delay: 0.18 }}
            >
              <PageSectionHeader
                label={`Phân nhánh của ${genre.name}`}
                icon={
                  <ChevronRight
                    className="size-5 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                }
              />
              <div className="mt-6">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </motion.section>
          )}

          <motion.section
            aria-label="Popular tracks"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_GENTLE, delay: 0.22 }}
          >
            <div className="flex items-center justify-between mb-5">
              <PageSectionHeader label="Bài hát nổi bật" />
              {!isLoadingTracks && totalItems > 0 && (
                <span className="text-xs font-bold text-muted-foreground">
                  {formatCount(totalItems)} bài
                </span>
              )}
            </div>
            <TrackList
              {...trackListProps}
              maxHeight="auto"
              moodColor={palette.hslChannels}
              skeletonCount={12}
              staggerAnimation={true}
            />
          </motion.section>
        </div>
      </div>
    </main>
  );
};

export default GenreDetailPage;
