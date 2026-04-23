import React, { useMemo, useCallback, useRef, memo, type FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  BadgeCheck,
  MoreHorizontal,
  Globe,
  Instagram,
  Youtube,
  Disc3,
  TrendingUp,
  MapPin,
  Share2,
  ChevronRight,
  Info,
  AlertCircle,
  Facebook,
  Mic2,
  Camera,
  Music4,
  Loader2,
  ChevronLeft,
  Shuffle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import { TrackList } from "@/features/track/components/TrackList";
import {
  useArtistDetail,
  useArtistTracksInfinite,
} from "@/features/artist/hooks/useArtistsQuery";
import { Artistdetailskeleton, FollowButton, IAlbum, ITrack } from "@/features";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import { buildPalette, Palette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";

import MusicResult from "@/components/ui/Result";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — same as AlbumDetailPage
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

interface ArtistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const artistNameSizeClass = (name: string): string => {
  const len = name.length;
  if (len > 28) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 18) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  if (len > 10) return "text-5xl sm:text-6xl md:text-7xl lg:text-8xl";
  return "text-6xl sm:text-7xl md:text-8xl lg:text-[6.5rem] xl:text-[8rem]";
};

const formatListeners = (n: number): string =>
  new Intl.NumberFormat("vi-VN").format(n);

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = memo<{
  label: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}>(({ label, icon, action, compact }) => (
  <div className="flex items-center justify-between px-0.5 mb-3">
    <h2
      className={cn(
        "font-black tracking-tighter flex items-center gap-2.5 uppercase text-foreground",
        compact ? "text-sm" : "text-xl sm:text-2xl",
      )}
    >
      {icon}
      {label}
    </h2>
    {action && <div className="shrink-0">{action}</div>}
  </div>
));
SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────────────────────
// DraggableImageGallery
// ─────────────────────────────────────────────────────────────────────────────

const DraggableImageGallery = memo<{
  images: string[];
  artistName: string;
}>(({ images, artistName }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    dragState.current = {
      startX: e.pageX - scrollRef.current.offsetLeft,
      scrollLeft: scrollRef.current.scrollLeft,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.6;
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
  }, []);

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      ref={scrollRef}
      role="list"
      aria-label={`${artistName} photo gallery`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-0 sm:px-0 no-scrollbar cursor-grab snap-x snap-mandatory scroll-smooth active:cursor-grabbing"
    >
      {images.map((img: string, idx: number) => (
        <div
          key={idx}
          role="listitem"
          className={cn(
            "shrink-0 snap-center rounded-2xl sm:rounded-3xl overflow-hidden",
            "aspect-[16/10] w-[82vw] sm:w-[360px] md:w-[440px]",
            "border border-border/30 bg-muted shadow-md",
            "group select-none relative",
          )}
        >
          <img
            src={img}
            alt={`${artistName} photo ${idx + 1}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover transition-transform duration-[2500ms] group-hover:scale-[1.04] pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.08] transition-colors duration-500 pointer-events-none"
          />
        </div>
      ))}
      <div className="shrink-0 w-4 sm:hidden" aria-hidden="true" />
    </div>
  );
});
DraggableImageGallery.displayName = "DraggableImageGallery";

// ─────────────────────────────────────────────────────────────────────────────
// SocialLink
// ─────────────────────────────────────────────────────────────────────────────

const SocialLink = memo<{
  icon: React.ReactNode;
  label: string;
  href?: string;
  color: string;
}>(({ icon, label, href, color }) => {
  if (!href?.trim()) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center justify-center sm:justify-start gap-3 h-11",
        "rounded-2xl bg-card border border-border/50 px-4",
        "hover:border-border hover:-translate-y-0.5 hover:shadow-md",
        "transition-all duration-150 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      )}
      aria-label={`Visit ${label} profile`}
    >
      <span
        className="shrink-0 transition-transform duration-150 group-hover:scale-110"
        style={{ color }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </a>
  );
});
SocialLink.displayName = "SocialLink";

// ─────────────────────────────────────────────────────────────────────────────
// EmptySection
// ─────────────────────────────────────────────────────────────────────────────

const EmptySection = memo<{
  icon: React.ReactElement;
  title: string;
  message: string;
}>(({ icon, title, message }) => (
  <div
    className="flex flex-col items-center justify-center py-16 px-6 bg-muted/10 rounded-3xl border border-dashed border-border/50 text-center gap-4"
    role="status"
  >
    <div className="size-14 rounded-full bg-background border border-border/40 shadow-sm flex items-center justify-center text-muted-foreground/30">
      {React.cloneElement(icon)}
    </div>
    <div className="space-y-1.5">
      <p className="font-black text-sm text-foreground/75 uppercase tracking-widest">
        {title}
      </p>
      <p className="text-sm text-muted-foreground font-medium max-w-xs">
        {message}
      </p>
    </div>
  </div>
));
EmptySection.displayName = "EmptySection";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistNotFound
// ─────────────────────────────────────────────────────────────────────────────

const ArtistNotFound = memo<{
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
        className="absolute inset-0 bg-destructive/10 blur-3xl rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-3xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <AlertCircle
          className="size-10 text-muted-foreground/50"
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground uppercase">
        Không tìm thấy nghệ sĩ
      </h2>
      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
        Hồ sơ có thể đã bị xóa, chuyển về riêng tư, hoặc đường dẫn không đúng.
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
        Quay lại
      </button>
    </div>
  </div>
));
ArtistNotFound.displayName = "ArtistNotFound";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistContextMenu
// ─────────────────────────────────────────────────────────────────────────────

const ArtistContextMenu = memo<{ size?: "sm" | "md"; align?: "start" | "end" }>(
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
          className="w-52 rounded-2xl border-border/50 p-1.5 shadow-2xl bg-background/95 backdrop-blur-xl"
        >
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Share2
              className="size-4 text-primary shrink-0"
              aria-hidden="true"
            />
            Chia sẻ trang nghệ sĩ
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Music4
              className="size-4 text-[hsl(var(--success))] shrink-0"
              aria-hidden="true"
            />
            Đài nghệ sĩ
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/40 my-1" />
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-destructive focus:text-destructive focus:bg-destructive/10">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Báo cáo vi phạm
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
ArtistContextMenu.displayName = "ArtistContextMenu";

// ─────────────────────────────────────────────────────────────────────────────
// ActionBar — mirrors AlbumDetailPage's ActionBar
// Play/Pause toggle, isPlaying state, motion animations, glow shadow
// ─────────────────────────────────────────────────────────────────────────────

interface ActionBarProps {
  artistId: string;
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
    artistId,
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
        aria-label="Artist controls"
      >
        {/* ── PLAY / PAUSE ── */}
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause artist" : "Play artist"}
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
          aria-label="Shuffle artist tracks"
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

        <FollowButton artistId={artistId} />
        <div className="flex-1" aria-hidden="true" />
        <ArtistContextMenu size={isCompact ? "sm" : "md"} align="end" />
      </div>
    );
  },
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// ArtistAvatar — mirrors HeroCover, avatar circle with playing ring + EQ
// ─────────────────────────────────────────────────────────────────────────────

const ArtistAvatar = memo<{
  src?: string;
  name: string;
  palette: Palette;
  isPlaying?: boolean;
  size?: "sm" | "lg";
}>(({ src, name, palette, isPlaying = false, size = "lg" }) => {
  const isLg = size === "lg";

  return (
    <div
      className={cn(
        "group/avatar relative shrink-0",
        isLg ? "self-center md:self-auto" : "",
      )}
    >
      {/* Glow halo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-[40px] pointer-events-none transition-opacity duration-700"
        style={{
          backgroundColor: palette.hex,
          opacity: isPlaying ? 0.55 : 0.35,
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
            className="absolute -inset-[5px] rounded-full pointer-events-none"
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

      {/* Avatar shell */}
      <Avatar
        className={cn(
          "relative z-10 border-background bg-card transition-[transform,box-shadow] duration-500 group-hover/avatar:scale-[1.02]",
          isLg
            ? "size-[160px] sm:size-[210px] md:size-[260px] rounded-full border-[5px] sm:border-[7px] shadow-2xl"
            : "size-20 rounded-2xl border-2 shadow-xl",
        )}
        style={
          isPlaying && isLg
            ? {
                boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
              }
            : undefined
        }
      >
        <AvatarImage
          src={src}
          className={cn(
            "object-cover transition-[filter] duration-700",
            isPlaying && isLg && "saturate-[1.12] brightness-[0.9]",
          )}
          fetchPriority={isLg ? "high" : undefined}
        />
        <AvatarFallback
          className={cn(
            "font-black bg-primary/20 text-primary",
            isLg ? "text-5xl rounded-full" : "text-2xl rounded-2xl",
          )}
        >
          {name[0]}
        </AvatarFallback>

        {/* Now Playing overlay — EQ bars + gradient tint (lg only) */}
        <AnimatePresence>
          {isPlaying && isLg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 rounded-full flex flex-col items-center justify-end pb-5 gap-2"
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
      </Avatar>
    </div>
  );
});
ArtistAvatar.displayName = "ArtistAvatar";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ArtistDetailPage: FC<ArtistDetailPageProps> = ({
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
  const isScrolled = scrollY > (isEmbedded ? 150 : 340);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError, refetch } = useArtistDetail(slug);
  const artist = data?.artist;
  const albums = data?.albums || [];

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = useArtistTracksInfinite(artist?._id);
  const {
    togglePlayArtist,
    shuffleArtist,
    isThisAristActive,
    isThisartistPlaying,
    isFetching,
  } = useArtistPlayback(artist);
  // ── Derived ───────────────────────────────────────────────────────────────

  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const totalItems = useMemo(
    () => artist?.trackIds.length ?? tracksData?.totalItems ?? 0,
    [artist?.trackIds.length, tracksData?.totalItems],
  );

  const artistIds = useMemo(
    () => (artist?._id ? [artist._id] : []),
    [artist?._id],
  );
  useSyncInteractions(artistIds, "follow", "artist", !!artist?._id);

  const syncTracksEnabled = useMemo(
    () => !isLoadingTracks && !!artist?._id,
    [isLoadingTracks, artist?._id],
  );
  useSyncInteractionsPaged(
    tracksData?.allTracks,
    "like",
    "track",
    syncTracksEnabled,
  );

  // buildPalette — same as AlbumDetailPage
  const palette = useMemo(
    () => buildPalette(artist?.themeColor ?? "#3b82f6"),
    [artist?.themeColor],
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

  // ── Shared props ──────────────────────────────────────────────────────────

  const sharedActionBarProps: ActionBarProps = useMemo(
    () => ({
      artistId: artist?._id || "",
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisartistPlaying,
      hasTracks: totalItems > 0,
      onPlay: togglePlayArtist,
      onShuffle: shuffleArtist,
    }),
    [
      artist?._id,
      palette,
      isFetching,
      isThisartistPlaying,
      totalItems,
      togglePlayArtist,
      shuffleArtist,
    ],
  );

  const trackListProps = useMemo(
    () => ({
      allTrackIds: artist?.trackIds,
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
      artist?.trackIds,
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
  if (isLoading && !artist) {
    return <Artistdetailskeleton />;
  }
  // Switching
  if (isLoading && artist) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (isError || !artist) {
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
        aria-label={`Artist: ${artist.name}`}
      >
        <div
          aria-hidden="true"
          className="sticky top-0 h-[200px] shrink-0 pointer-events-none z-0"
          style={{ background: palette.heroGradient }}
        />

        <div className="relative z-10 -mt-[200px] px-4 pb-10">
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

          <motion.div
            className="flex items-end gap-4 pt-4 pb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SP_GENTLE}
          >
            <ArtistAvatar
              src={artist.avatar}
              name={artist.name}
              palette={palette}
              size="sm"
            />
            <div className="flex-1 min-w-0 pb-1">
              {artist.isVerified && (
                <div className="flex items-center gap-1 mb-1">
                  <BadgeCheck
                    className="size-3.5 fill-blue-500 text-background"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                    Xác thực
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-black tracking-tight leading-tight truncate text-foreground">
                {artist.name}
              </h2>
              {artist.monthlyListeners > 0 && (
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {formatListeners(artist.monthlyListeners)} người nghe / tháng
                </p>
              )}
              {/* Playing indicator in embedded */}
              <AnimatePresence>
                {isThisartistPlaying && (
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

          {/* Top tracks */}
          {totalItems > 0 && (
            <div className="mt-7">
              <SectionHeader
                label="Phổ biến"
                icon={
                  <TrendingUp
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
                }
                compact
              />

              <TrackList
                {...trackListProps}
                maxHeight={400}
                moodColor={palette.hex}
                skeletonCount={7}
                staggerAnimation={false}
              />
            </div>
          )}

          {/* Albums */}
          {albums.length > 0 && (
            <div className="mt-8">
              <SectionHeader
                label="Đĩa nhạc"
                icon={
                  <Disc3 className="size-3.5 text-primary" aria-hidden="true" />
                }
                compact
              />
              <div className="grid grid-cols-2 gap-3 ">
                {albums.slice(0, 4).map((album: IAlbum) => (
                  <PublicAlbumCard key={album._id} album={album} />
                ))}
              </div>
            </div>
          )}

          {/* Bio snippet */}
          {artist.bio && (
            <div className="mt-7 p-4 rounded-2xl bg-card/50 border border-border/30">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center gap-1.5">
                <Info className="size-3.5" aria-hidden="true" /> Tiểu sử
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 font-medium">
                {artist.bio}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* ── Immersive Hero */}
      <section
        aria-label="Artist hero"
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[620px] flex flex-col justify-end overflow-hidden shrink-0 group/hero"
      >
        {/* Dynamic color wash — uses palette.heroGradient */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000"
          style={{ background: palette.heroGradient }}
        />

        {/* Cover image */}
        {artist.coverImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center z-0 pointer-events-none transition-transform duration-[5000ms] ease-out group-hover/hero:scale-105 opacity-50 dark:opacity-30 mix-blend-overlay"
            style={{ backgroundImage: `url(${artist.coverImage})` }}
          />
        )}

        {/* Noise texture — matches AlbumDetailPage */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "180px 180px",
          }}
        />

        {/* Bottom fade */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent z-0 pointer-events-none"
        />

        {/* Back nav */}
        <div className="absolute top-5 left-4 sm:left-6 lg:left-8 z-20">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/30 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* Hero content — motion entrance */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 mt-20">
          <motion.div
            className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 text-center md:text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Avatar with playing ring + EQ overlay */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SP_HERO, delay: 0.08 }}
            >
              <ArtistAvatar
                src={artist.avatar}
                name={artist.name}
                palette={palette}
                isPlaying={isThisartistPlaying}
                size="lg"
              />
            </motion.div>

            {/* Name + meta */}
            <motion.div
              className="flex flex-col items-center md:items-start gap-3 sm:gap-4 flex-1 min-w-0 pb-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_HERO, delay: 0.14 }}
            >
              {artist.isVerified && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-foreground/90">
                  <BadgeCheck
                    className="size-3.5 sm:size-4 fill-blue-500 text-background"
                    aria-hidden="true"
                  />
                  Nghệ sĩ xác thực
                </div>
              )}

              <h1
                className={cn(
                  "font-black tracking-tighter leading-[0.88] drop-shadow-xl text-foreground w-full",
                  artistNameSizeClass(artist.name),
                )}
              >
                {artist.name}
              </h1>

              {/* Stats pills */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 mt-1.5">
                {artist.monthlyListeners > 0 && (
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-background/35 backdrop-blur-md border border-white/10 text-[12px] sm:text-[13px] font-bold text-foreground/90">
                    <TrendingUp
                      className="size-3.5 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {formatListeners(artist.monthlyListeners)}
                      <span className="text-foreground/50 font-medium ml-1 text-[11px]">
                        người nghe / tháng
                      </span>
                    </span>
                  </div>
                )}
                {artist.nationality && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-background/25 backdrop-blur-sm border border-white/10 text-[12px] font-bold text-foreground/80">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {artist.nationality}
                  </div>
                )}
              </div>

              {/* Playing status pill — mirrors AlbumDetailPage */}
              <AnimatePresence>
                {isThisAristActive && (
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
                        !isThisartistPlaying && "paused opacity-40",
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
                      {isThisartistPlaying ? "Đang phát" : "Đã tạm dừng"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Sticky Action Bar */}
      <div
        className={cn(
          "sticky z-30 transition-[background,box-shadow,border-color] duration-300",
          "top-[var(--navbar-height,64px)]",
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <ActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled artist identity — AnimatePresence like AlbumDetailPage */}
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
                  {isThisartistPlaying && (
                    <div
                      aria-hidden="true"
                      className="eq-bars shrink-0 flex items-end gap-[2px] h-4 transition-opacity duration-300"
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

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">
                  {artist.name}
                </span>

                {/* Avatar thumbnail — ring when playing */}
                <Avatar
                  className={cn(
                    "size-9 sm:size-10 rounded-full border shrink-0 transition-all duration-300",
                    isThisartistPlaying
                      ? "border-transparent"
                      : "border-border/40",
                  )}
                  style={
                    isThisartistPlaying
                      ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` }
                      : undefined
                  }
                >
                  <AvatarImage src={artist.avatar} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {artist.name[0]}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-10 md:mt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14 xl:gap-20">
          {/* Left: tracks + gallery + albums */}
          <div className="lg:col-span-8 space-y-16">
            <motion.section
              aria-label="Top tracks"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_GENTLE, delay: 0.18 }}
            >
              <SectionHeader
                label="Phổ biến"
                icon={
                  <TrendingUp
                    className="size-[18px] text-primary"
                    aria-hidden="true"
                  />
                }
              />
              <TrackList
                {...trackListProps}
                maxHeight={400}
                moodColor={palette.hslChannels}
                skeletonCount={7}
                staggerAnimation={true}
              />
            </motion.section>

            {artist.images?.length > 0 && (
              <motion.section
                aria-label="Photo gallery"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SP_GENTLE, delay: 0.22 }}
              >
                <SectionHeader
                  label="Thư viện ảnh"
                  icon={
                    <Camera
                      className="size-[18px] text-primary"
                      aria-hidden="true"
                    />
                  }
                />
                <div>
                  <DraggableImageGallery
                    images={artist.images}
                    artistName={artist.name}
                  />
                </div>
              </motion.section>
            )}

            <motion.section
              aria-label="Discography"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP_GENTLE, delay: 0.26 }}
            >
              <SectionHeader
                label="Đĩa nhạc"
                icon={
                  <Disc3
                    className="size-[18px] text-primary"
                    aria-hidden="true"
                  />
                }
                action={
                  albums.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/artists/${slug}/albums`)}
                      className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                    >
                      Xem tất cả{" "}
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
              <div>
                {albums.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9">
                    {albums.map((album: IAlbum) => (
                      <PublicAlbumCard key={album._id} album={album} />
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<Disc3 />}
                    title="Chưa có đĩa nhạc"
                    message="Nghệ sĩ này chưa phát hành album hay đĩa đơn nào."
                  />
                )}
              </div>
            </motion.section>
          </div>

          {/* Right: bio + social */}
          <motion.aside
            className="lg:col-span-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SP_GENTLE, delay: 0.3 }}
          >
            <div className="sticky top-[calc(var(--navbar-height,64px)+4.5rem)] space-y-8">
              {/* Ambient glow */}
              <div
                aria-hidden="true"
                className="absolute -top-12 -right-8 w-[110%] aspect-square rounded-full blur-[100px] opacity-10 pointer-events-none -z-10"
                style={{ backgroundColor: palette.hex }}
              />

              {/* Bio card */}
              <section
                aria-label="Artist biography"
                className="bg-card/55 backdrop-blur-md rounded-3xl p-6 border border-border/50 shadow-lg overflow-hidden"
              >
                <h3 className="font-black text-base uppercase tracking-wider mb-5 flex items-center gap-2.5 text-foreground">
                  <Info
                    className="size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  Tiểu sử
                </h3>

                <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/40">
                  <Avatar className="size-14 rounded-2xl border border-border/50 shadow-sm shrink-0">
                    <AvatarImage src={artist.avatar} />
                    <AvatarFallback className="rounded-2xl bg-primary/15 text-primary font-black text-lg">
                      {artist.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-foreground truncate uppercase tracking-tight">
                      {artist.name}
                    </p>
                    <Badge className="mt-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none px-2 py-0.5">
                      Hồ sơ chính thức
                    </Badge>
                  </div>
                </div>

                {artist.bio ? (
                  <p className="text-[13px] sm:text-sm text-muted-foreground leading-[1.85] font-medium line-clamp-[14] border-l-2 border-primary/30 pl-3.5">
                    {artist.bio}
                  </p>
                ) : (
                  <div className="py-8 text-center bg-muted/25 rounded-2xl border border-dashed border-border/40">
                    <Mic2
                      className="size-7 text-muted-foreground/25 mx-auto mb-2.5"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest italic">
                      Tiểu sử đang cập nhật
                    </p>
                  </div>
                )}
              </section>

              {/* Social links */}
              {artist.socialLinks &&
                Object.values(artist.socialLinks).some(Boolean) && (
                  <section
                    aria-label="Social media links"
                    className="space-y-3"
                  >
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                      <span
                        className="inline-block w-4 h-0.5 rounded-full"
                        style={{ backgroundColor: palette.hex }}
                        aria-hidden="true"
                      />
                      Mạng xã hội
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <SocialLink
                        icon={<Instagram size={18} />}
                        label="Instagram"
                        href={artist.socialLinks.instagram}
                        color="#E4405F"
                      />
                      <SocialLink
                        icon={<Facebook size={18} />}
                        label="Facebook"
                        href={artist.socialLinks.facebook}
                        color="#1877F2"
                      />
                      <SocialLink
                        icon={<Youtube size={18} />}
                        label="YouTube"
                        href={artist.socialLinks.youtube}
                        color="#FF0000"
                      />
                      <SocialLink
                        icon={<Globe size={18} />}
                        label="Website"
                        href={artist.socialLinks.website}
                        color={palette.hex}
                      />
                    </div>
                  </section>
                )}
            </div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
};

export default ArtistDetailPage;
