import React, { useMemo, useCallback, useRef, memo, type FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  MoreHorizontal,
  Share2,
  ListMusic,
  Plus,
  Loader2,
  ChevronLeft,
  Shuffle,
  Disc3,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { TrackList } from "@/features/track/components/TrackList";
import { useAlbumDetail } from "@/features/album/hooks/useAlbumsQuery";
import {
  AlbumDetailSkeleton,
  IGenre,
  ITrack,
  useAlbumTracksInfinite,
  useSyncInteractions,
} from "@/features";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { AlbumLikeButton } from "@/features/interaction/components/LikeButton";
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import { formatDuration } from "@/utils/track-helper";
import { buildPalette, Palette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";
import MusicResult from "@/components/ui/Result";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AlbumDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
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
// AlbumStats
// ─────────────────────────────────────────────────────────────────────────────

const AlbumStats = memo<{
  trackCount: number;
  duration: number;
  inline?: boolean;
  className?: string;
}>(({ trackCount, duration, inline, className }) => {
  const text = `${trackCount} bài hát${duration > 0 ? ` · ${formatDuration(duration)}` : ""}`;
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
      {text}
    </span>
  );
});
AlbumStats.displayName = "AlbumStats";

// ─────────────────────────────────────────────────────────────────────────────
// AlbumContextMenu
// ─────────────────────────────────────────────────────────────────────────────

const AlbumContextMenu = memo<{ size?: "sm" | "md"; align?: "start" | "end" }>(
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
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer">
            <Plus className="size-4 shrink-0" aria-hidden="true" /> Thêm vào
            Playlist
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer">
            <ListMusic className="size-4 shrink-0" aria-hidden="true" /> Thêm
            vào hàng đợi
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/40 my-1" />
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer text-primary focus:text-primary focus:bg-primary/10">
            <Share2 className="size-4 shrink-0" aria-hidden="true" /> Chia sẻ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
AlbumContextMenu.displayName = "AlbumContextMenu";

// ─────────────────────────────────────────────────────────────────────────────
// ActionBar
//
// FIX: thêm prop `isPlaying` — Play button hiện Pause khi album đang phát.
// Ring glow + boxShadow mạnh hơn khi playing để user thấy trạng thái ngay.
// aria-label + aria-pressed đồng bộ theo state.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionBarProps {
  albumId: string;
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isPlaying: boolean;
  hasTracks: boolean;
  density?: "compact" | "full";
  onPlay: () => void;
  onShuffle: () => void;
}

const ActionBar = memo<ActionBarProps>(
  ({
    albumId,
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isPlaying,
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
        aria-label="Album controls"
      >
        {/* ── PLAY / PAUSE ── */}
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause album" : "Play album"}
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
            {isLoadingPlay ? (
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
          aria-label="Shuffle album"
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

        <AlbumLikeButton id={albumId} variant="detail" />
        <div className="flex-1" aria-hidden="true" />
        <AlbumContextMenu size={isCompact ? "sm" : "md"} align="end" />
      </div>
    );
  },
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// HeroCover
//
// FIX: isPlaying prop drives:
//   - conic-gradient spinning ring (size lg only)
//   - EQ bars overlay + gradient tint trên ảnh
//   - saturate/brightness filter gợi cảm giác "audio on"
//   - Glow halo mạnh hơn khi playing
// ─────────────────────────────────────────────────────────────────────────────

const HeroCover = memo<{
  src: string;
  alt: string;
  palette: Palette;
  isPlaying?: boolean;
  size?: "sm" | "lg";
}>(({ src, alt, palette, isPlaying = false, size = "lg" }) => {
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
          opacity: isPlaying ? 0.48 : 0.2,
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
          "relative rounded-2xl overflow-hidden border border-white/10 bg-muted",
          "transition-[transform,box-shadow] duration-500 group-hover:scale-[1.012]",
          isLg
            ? "size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px]"
            : "size-20",
        )}
        style={
          isPlaying && isLg
            ? {
                boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
              }
            : { boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }
        }
      >
        <img
          src={src || "/images/default-album.png"}
          alt={alt}
          className={cn(
            "size-full object-cover",
            "transition-[transform,filter] duration-700",
            "group-hover:scale-105",
            isPlaying && isLg && "saturate-[1.15] brightness-[0.88]",
          )}
          loading={isLg ? "eager" : "lazy"}
          fetchPriority={isLg ? "high" : "auto"}
          decoding="async"
        />

        {/* Now Playing overlay — eq bars + gradient tint */}
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
          className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/20 pointer-events-none"
        />
      </div>
    </div>
  );
});
HeroCover.displayName = "HeroCover";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistMeta
// ─────────────────────────────────────────────────────────────────────────────

const ArtistMeta = memo<{
  artistName?: string;
  artistAvatar?: string;
  artistSlug?: string;
  releaseYear?: number | string;
  onNavigate: () => void;
  size?: "sm" | "md";
}>(({ artistName, artistAvatar, releaseYear, onNavigate, size = "md" }) => (
  <div
    className={cn(
      "flex items-center gap-1.5 flex-wrap",
      size === "sm" ? "mt-1" : "mt-0",
    )}
  >
    <button
      type="button"
      onClick={onNavigate}
      className="flex items-center gap-2 group/artist hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
      aria-label={`View artist page${artistName ? `: ${artistName}` : ""}`}
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
    isFetching,
  } = useAlbumPlayback(album);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const totalItems = useMemo(
    () => album?.trackIds.length ?? tracksData?.totalItems ?? 0,
    [album?.trackIds.length, tracksData?.totalItems],
  );

  const albumIds = useMemo(() => (album?._id ? [album._id] : []), [album?._id]);
  useSyncInteractions(albumIds, "like", "album", !!album?._id);

  const syncEnabled = useMemo(
    () => !isLoadingTracks && !!album?._id,
    [isLoadingTracks, album?._id],
  );
  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", syncEnabled);

  const palette = useMemo(
    () => buildPalette(album?.themeColor ?? "#5b21b6"),
    [album?.themeColor],
  );
  const totalDurationSec = useMemo(
    () => allTracks.reduce((s, t) => s + (t.duration ?? 0), 0),
    [allTracks],
  );

  const genres = useMemo(
    () => (album?.genres ?? []) as IGenre[],
    [album?.genres],
  );

  // ── Title style ───────────────────────────────────────────────────────────

  const { className: titleCls, style: titleStyle } = useTitleStyle(
    album?.title ?? "",
  );

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

  const handleNavigateArtist = useCallback(() => {
    const artistSlug = album?.artist?.slug;
    if (artistSlug) navigate(`/artist/${artistSlug}`);
  }, [navigate, album?.artist?.slug]);

  // ── Shared props ──────────────────────────────────────────────────────────

  const sharedActionBarProps: ActionBarProps = useMemo(
    () => ({
      albumId: album?._id || "",
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisAlbumPlaying,
      hasTracks: totalItems > 0,
      onPlay: togglePlayAlbum,
      onShuffle: shuffleAlbum,
    }),
    [
      album?._id,
      palette,
      isFetching,
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
  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !album) {
    return <AlbumDetailSkeleton />;
  }
  // Switching
  if (isLoading && album) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (isError || !album) {
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
        aria-label={`Album: ${album.title}`}
      >
        <div
          aria-hidden="true"
          className="sticky top-0 h-[200px] pointer-events-none shrink-0 z-0"
          style={{ background: palette.heroGradient }}
        />

        <div className="relative z-10 -mt-[200px] px-4 pb-10">
          {onClose && (
            <div className="pt-4 pb-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Đóng
              </button>
            </div>
          )}

          <motion.div
            className="flex items-center gap-4 pt-2 pb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SP_GENTLE}
          >
            {/* Embedded: size="sm" — no playing overlay */}
            <HeroCover
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
              <ArtistMeta
                artistName={album.artist?.name}
                artistAvatar={album.artist?.avatar}
                artistSlug={album.artist?.slug}
                releaseYear={album.releaseYear}
                onNavigate={handleNavigateArtist}
                size="sm"
              />
              {/* Playing indicator in embedded */}
              <AnimatePresence>
                {isThisAlbumPlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "eq-bar w-[3px] rounded-full sw-animate-eq",
                        )}
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

          <AlbumStats
            trackCount={totalItems || album.totalTracks || 0}
            duration={totalDurationSec}
            className="mb-5"
          />

          <TrackList
            {...trackListProps}
            maxHeight={400}
            moodColor={palette.hex}
            skeletonCount={7}
            staggerAnimation={false}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      {/* Background layers */}
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={{ background: palette.heroGradient }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Back button */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold transition-all duration-200 text-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Quay lại
          </button>
        </div>

        {/* Hero section */}
        <motion.section
          aria-label="Album details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10"
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
            <HeroCover
              src={album.coverImage}
              alt={album.title}
              palette={palette}
              isPlaying={isThisAlbumPlaying}
            />
          </motion.div>

          {/* Meta */}
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

            {/* Title — Vietnamese-safe */}
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

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1.5 mt-1">
              <ArtistMeta
                artistName={album.artist?.name}
                artistAvatar={album.artist?.avatar}
                artistSlug={album.artist?.slug}
                releaseYear={album.releaseYear}
                onNavigate={handleNavigateArtist}
              />
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

            {/* Playing status pill under meta */}
            <AnimatePresence>
              {isThisAlbumActive && (
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
                      !isThisAlbumPlaying && "paused opacity-40",
                      "transition-opacity duration-300",
                    )}
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "eq-bar w-[3px] rounded-full sw-animate-eq",
                        )}
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
                    {isThisAlbumPlaying ? "Đang phát" : "Đã tạm dừng"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Genres */}
            {genres.length > 0 && (
              <motion.div
                className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
              >
                {genres.slice(0, 4).map((g) => (
                  <button
                    key={g._id ?? String(g)}
                    type="button"
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-background/30 backdrop-blur-sm border border-white/15 text-foreground/80 hover:bg-background/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                    aria-label={`Genre: ${g.name ?? ""}`}
                  >
                    {g.name ?? String(g)}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.section>

        {/* Sticky action bar */}
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
              animationDelay: "80ms",
              // Nếu không có moodColor thì fallback về màu primary mặc định
              "--local-shadow-color": palette.hslChannels || "var(--primary)",
            } as React.CSSProperties
          }
        >
          <ActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled album identity — with playing state */}
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
                  {isThisAlbumPlaying && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "eq-bars shrink-0 flex items-end gap-[2px] h-4",
                        !isThisAlbumPlaying && "paused opacity-40",
                        "transition-opacity duration-300",
                      )}
                    >
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "eq-bar w-[3px] rounded-full sw-animate-eq",
                          )}
                          style={{
                            animationDelay: `${i * 0.12}s`,
                            backgroundColor: palette.hex,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
                  {album.title}
                </span>

                {/* Cover thumbnail — ring when playing */}
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
                  <img
                    src={album.coverImage || "/images/default-album.png"}
                    alt=""
                    aria-hidden="true"
                    className="size-full object-cover"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Track list */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SP_GENTLE, delay: 0.22 }}
        >
          <TrackList
            {...trackListProps}
            maxHeight="auto"
            skeletonCount={12}
            moodColor={palette.hslChannels}
            staggerAnimation={true}
          />
        </motion.div>

        {/* Footer */}
        {allTracks.length > 0 && album.releaseYear && (
          <footer className="mt-16 pt-7 border-t border-border/25 space-y-3 text-[11px] text-muted-foreground/50 font-medium pb-8">
            <p className="font-black text-[10px] uppercase tracking-[0.15em] text-foreground/45">
              {new Date(album.createdAt ?? Date.now()).toLocaleDateString(
                "vi-VN",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )}
            </p>
            <div className="text-[10px] uppercase tracking-wider space-y-1">
              <p>
                © {album.releaseYear} {album.artist?.name ?? "Unknown"}. All
                rights reserved.
              </p>
              <p>
                ℗ {album.releaseYear} {album.artist?.name ?? "Unknown"} Official
                Records.
              </p>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
};

export default AlbumDetailPage;
