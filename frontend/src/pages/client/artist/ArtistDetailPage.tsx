import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  memo,
  lazy,
  Suspense,
  useState,
  type FC,
  type CSSProperties,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  Globe,
  Instagram,
  Youtube,
  Disc3,
  TrendingUp,
  MapPin,
  ChevronRight,
  Info,
  Facebook,
  Mic2,
  Camera,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ArtistAvatarProps } from "./components/ArtistAvatar";
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";

// ─── Lazy imports ─────────────────────────────────────────────────────────────

const TrackList = lazy(() =>
  import("@/features/track/components/TrackList").then((m) => ({
    default: m.TrackList,
  })),
);

const ArtistActionBarLazy = lazy(() =>
  import("./components/ArtistActionBar").then((m) => ({
    default: m.ArtistActionBar,
  })),
);

const ArtistAvatarLazy = lazy(() =>
  import("./components/ArtistAvatar").then((m) => ({
    default: m.ArtistAvatar,
  })),
);

// Wrapper components with Suspense
const ArtistActionBar = (props: ArtistActionBarProps) => (
  <Suspense fallback={<div className="h-11 w-full" />}>
    <ArtistActionBarLazy {...props} />
  </Suspense>
);

const ArtistAvatar = (props: ArtistAvatarProps) => (
  <Suspense fallback={<AvatarSkeleton size={props.size} />}>
    <ArtistAvatarLazy {...props} />
  </Suspense>
);

import {
  useArtistDetail,
  useArtistTracksInfinite,
} from "@/features/artist/hooks/useArtistsQuery";

import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";
import { useArtistPlayback } from "@/features/player/hooks/useArtistPlayback";
import { buildPalette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTheme } from "@/hooks/useTheme";
import MusicResult from "@/components/ui/Result";
import { formatListeners } from "@/utils/track-helper";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { APP_CONFIG, SP_GENTLE, SP_HERO, SP_SNAPPY } from "@/config/constants";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { ArtistActionBarProps } from "./components/ArtistActionBar";
import { WaveformBars } from "@/components/MusicVisualizer";
import { useTitleStyle } from "@/hooks/useTitleStyle";
import { useSmartBack } from "@/hooks/useSmartBack";
import type { QueueSourceType } from "@/features/player/slice/playerSlice";
import {
  Artistdetailskeleton,
  IArtist,
  IArtistDetail,
} from "@/features/artist";
import { ITrack } from "@/features/track";
import { IAlbum } from "@/features/album";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** EQ bar indices — static, never re-created */

/** Spring presets for motion */
const FADE_UP = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

type PaletteType = ReturnType<typeof buildPalette>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSystemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

function getCSSVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Skeleton for AvatarSuspense fallback */
const AvatarSkeleton: FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const cls =
    size === "lg"
      ? "size-36 md:size-44 lg:size-52"
      : size === "sm"
        ? "size-16"
        : "size-24";
  return (
    <div
      className={cn("rounded-full bg-muted/60 animate-pulse shrink-0", cls)}
    />
  );
};

// ─── SectionHeader ─────────────────────────────────────────────────────────────

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

// ─── DraggableImageGallery ──────────────────────────────────────────────────────

const DraggableImageGallery = memo<{ images: string[]; artistName: string }>(
  ({ images, artistName }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      dragRef.current = {
        active: true,
        startX: e.pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
      const { active, startX, scrollLeft } = dragRef.current;
      if (!active || !scrollRef.current) return;
      e.preventDefault();
      scrollRef.current.scrollLeft =
        scrollLeft - (e.pageX - scrollRef.current.offsetLeft - startX) * 1.6;
    }, []);

    const stopDrag = useCallback(() => {
      dragRef.current.active = false;
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
        {images.map((img, idx) => (
          <div
            key={img + idx}
            role="listitem"
            className="shrink-0 snap-center rounded-2xl sm:rounded-3xl overflow-hidden aspect-[16/10] w-[82vw] sm:w-[360px] md:w-[440px] border border-border/30 bg-muted shadow-md group select-none relative"
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
  },
);
DraggableImageGallery.displayName = "DraggableImageGallery";

// ─── SocialLink ────────────────────────────────────────────────────────────────

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
      className="group flex items-center justify-center sm:justify-start gap-3 h-11 rounded-2xl bg-card border border-border/50 px-4 hover:border-border hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      aria-label={`${label} profile`}
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

// ─── PlayingPill ───────────────────────────────────────────────────────────────

const PlayingPill: FC<{
  isPlaying: boolean;
  palette: PaletteType;
}> = memo(({ isPlaying, palette }) => (
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
    <WaveformBars color={palette.hex} active={isPlaying} />
    <span
      className="text-[10px] font-black uppercase tracking-widest"
      style={{ color: palette.hex }}
    >
      {isPlaying ? "Đang phát" : "Đã tạm dừng"}
    </span>
  </motion.div>
));
PlayingPill.displayName = "PlayingPill";

// ─── HeroCoverImage ────────────────────────────────────────────────────────────

/** Cover image with blur-up loading */
const HeroCoverImage: FC<{ src: string; isDark: boolean }> = memo(
  ({ src, isDark }) => {
    const [loaded, setLoaded] = useState(false);

    return (
      <>
        {/* Blurred placeholder */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-cover bg-center z-0 pointer-events-none scale-105 blur-xl transition-opacity duration-700",
            loaded ? "opacity-0" : "opacity-100",
          )}
          style={{ backgroundImage: `url(${src})` }}
        />
        {/* Full image */}
        <img
          src={src}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 size-full object-cover z-0 pointer-events-none transition-all duration-[5000ms] ease-out group-hover/hero:scale-105",
            loaded ? "opacity-100 blur-0" : "opacity-0 blur-xl",
            isDark ? "mix-blend-overlay" : "",
          )}
          style={{
            opacity: loaded ? (isDark ? 0.32 : 0.92) : 0,
            filter: !isDark ? "saturate(1.06) brightness(1)" : undefined,
          }}
        />
      </>
    );
  },
);
HeroCoverImage.displayName = "HeroCoverImage";

// ─── BiographyCard ────────────────────────────────────────────────────────────

const BiographyCard: FC<{
  artist: IArtist;
  palette: PaletteType;
}> = memo(({ artist }) => (
  <section
    aria-label="Artist biography"
    className="bg-card/55 backdrop-blur-md rounded-3xl p-6 border border-border/50 shadow-lg overflow-hidden"
  >
    <h3 className="font-black text-base uppercase tracking-wider mb-5 flex items-center gap-2.5 text-foreground">
      <Info className="size-4 text-primary shrink-0" aria-hidden="true" />
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
));
BiographyCard.displayName = "BiographyCard";

// ─── SocialLinksSection ────────────────────────────────────────────────────────

const SocialLinksSection: FC<{
  socialLinks: IArtist["socialLinks"];
  accentColor: string;
}> = memo(({ socialLinks, accentColor }) => {
  if (!socialLinks || !Object.values(socialLinks).some(Boolean)) return null;
  return (
    <section aria-label="Social media links" className="space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
        <span
          className="inline-block w-4 h-0.5 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        Mạng xã hội
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <SocialLink
          icon={<Instagram size={18} />}
          label="Instagram"
          href={socialLinks.instagram}
          color="#E4405F"
        />
        <SocialLink
          icon={<Facebook size={18} />}
          label="Facebook"
          href={socialLinks.facebook}
          color="#1877F2"
        />
        <SocialLink
          icon={<Youtube size={18} />}
          label="YouTube"
          href={socialLinks.youtube}
          color="#FF0000"
        />
        <SocialLink
          icon={<Globe size={18} />}
          label="Website"
          href={socialLinks.website}
          color={accentColor}
        />
      </div>
    </section>
  );
});
SocialLinksSection.displayName = "SocialLinksSection";

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

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 150 : 340);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: artist, isLoading, isError, refetch } = useArtistDetail(slug);

  const albums = artist?.albums ?? [];

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = useArtistTracksInfinite(artist?._id);
  console.log(artist, tracksData);
  const {
    togglePlayArtist,
    shuffleArtist,
    isThisArtistActive,
    isThisArtistPlaying,
    isFetching: isPlaybackFetching,
  } = useArtistPlayback(artist);

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Flat track list — stable reference when pages haven't changed */
  const allTracks = useMemo(
    () => tracksData?.allTracks ?? ([] as ITrack[]),
    [tracksData?.allTracks],
  );
  const totalItems = artist?.trackIds.length ?? tracksData?.totalItems ?? 0;

  // Sync interactions
  const artistIds = useMemo(
    () => (artist?._id ? [artist._id] : []),
    [artist?._id],
  );
  useSyncInteractions(artistIds, "follow", "artist", !!artist?._id);

  // ── Palette ───────────────────────────────────────────────────────────────
  /** buildPalette is only called when themeColor changes */
  const palette = useMemo(() => {
    const fallback = getCSSVar("--primary", "#3b82f6");
    return buildPalette(artist?.themeColor ?? fallback);
  }, [artist?.themeColor]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { theme } = useTheme();
  const isDark = useMemo(
    () =>
      theme === "dark" ? true : theme === "light" ? false : getSystemDark(),
    [theme],
  );

  // ── Memoized styles ───────────────────────────────────────────────────────
  /** CSS styles used by multiple children — stable objects */
  const accentBg = useMemo<CSSProperties>(
    () => ({ backgroundColor: palette.hex }),
    [palette.hex],
  );
  const accentColor = useMemo<CSSProperties>(
    () => ({ color: palette.hex }),
    [palette.hex],
  );

  // ── Prefetch lazy chunks ───────────────────────────────────────────────────
  useEffect(() => {
    void import("@/features/track/components/TrackList");
    void import("./components/ArtistActionBar");
    void import("./components/ArtistAvatar");
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleBack = useSmartBack();
  // ── Artist name size — computed once ──────────────────────────────────────
  const { className: titleCls } = useTitleStyle(artist?.name ?? "");
  const { openArtistSheet } = useContextSheet();
  const handleMoreOptions = useCallback(
    (a: IArtistDetail) => openArtistSheet(a),
    [openArtistSheet],
  );

  // ── Shared props (stable references) ─────────────────────────────────────
  /** Avoid re-rendering ActionBar by keeping a stable prop bag */
  const sharedActionBarProps = useMemo<ArtistActionBarProps>(
    () => ({
      artist: artist!,
      handleMoreOptions,
      palette,
      isLoadingPlay: isPlaybackFetching,
      isLoadingShuffle: isPlaybackFetching,
      isPlaying: isThisArtistPlaying,
      hasTracks: totalItems > 0,
      onPlay: togglePlayArtist,
      onShuffle: shuffleArtist,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      artist?._id, // identity, not full object
      isPlaybackFetching,
      isThisArtistPlaying,
      totalItems,
      // functions are stable from their own hooks
      togglePlayArtist,
      shuffleArtist,
      handleMoreOptions,
      palette,
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
      source: {
        id: artist?._id ?? "",
        type: "artist" as QueueSourceType,
        title: artist?.name,
        url: `/artists/${artist?.slug}`,
      },
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
      artist?._id,
      artist?.name,
      artist?.slug,
    ],
  );

  const isOnline = useOnlineStatus();

  // ── Early returns ──────────────────────────────────────────────────────────

  if (!isOnline) {
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

  if (isLoading && !artist) {
    return <Artistdetailskeleton />;
  }

  if (isError || !artist) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
    );
  }

  // Switching between artists — keep layout, show inline loader
  if (isLoading) {
    return <WaveformLoader glass={false} text="Đang tải" />;
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
        {/* Color wash strip */}
        <div
          aria-hidden="true"
          className="sticky top-0 h-[200px] shrink-0 pointer-events-none z-0"
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

          {/* Avatar + meta */}
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

              <AnimatePresence>
                {isThisArtistPlaying && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1.5"
                  >
                    <WaveformBars
                      color={palette.hex}
                      active={isThisArtistPlaying}
                    />
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={accentColor}
                    >
                      Đang phát
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <div className="mb-5">
            <ArtistActionBar {...sharedActionBarProps} density="full" />
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
              <Suspense fallback={<WaveformLoader />}>
                <TrackList
                  {...trackListProps}
                  maxHeight="auto"
                  moodColor={palette.hex}
                  skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
                  staggerAnimation={false}
                />
              </Suspense>
            </div>
          )}

          {/* Albums */}
          <div className="mt-8">
            <SectionHeader
              label="Đĩa nhạc"
              icon={
                <Disc3 className="size-3.5 text-primary" aria-hidden="true" />
              }
              compact
            />
            {albums.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {albums.slice(0, 4).map((album: IAlbum) => (
                  <PublicAlbumCard key={album._id} album={album} />
                ))}
              </div>
            ) : (
              <MusicResult
                variant="empty-artists"
                description="Artist hiện đang trống"
              />
            )}
          </div>

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
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        aria-label="Artist hero"
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[620px] flex flex-col justify-end overflow-hidden shrink-0 group/hero"
      >
        {/* Color wash */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000"
          style={{ background: palette.heroGradient }}
        />

        {/* Cover image with blur-up */}
        {artist.coverImage && (
          <HeroCoverImage src={artist.coverImage} isDark={isDark} />
        )}

        {/* Noise texture */}
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

        {/* Back button */}
        <div className="absolute top-5 left-4 sm:left-6 lg:left-8 z-20">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/70 transition-colors px-2 py-1 rounded-lg   backdrop-blur-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* Hero content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 mt-20">
          <motion.div
            className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 text-center md:text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Avatar */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SP_HERO, delay: 0.08 }}
            >
              <ArtistAvatar
                src={artist.avatar}
                name={artist.name}
                palette={palette}
                isPlaying={isThisArtistPlaying}
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
                  titleCls,
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

              {/* Playing pill */}
              <AnimatePresence>
                {isThisArtistActive && (
                  <PlayingPill
                    isPlaying={isThisArtistPlaying}
                    palette={palette}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Sticky Action Bar ────────────────────────────────────────────────── */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
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
              "--local-shadow-color": palette.hslChannels || "var(--primary)",
            } as CSSProperties
          }
        >
          <ArtistActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled identity badge */}
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
                <AnimatePresence>
                  {isThisArtistPlaying && (
                    <WaveformBars
                      color={palette.hex}
                      active={isThisArtistPlaying}
                    />
                  )}
                </AnimatePresence>

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">
                  {artist.name}
                </span>

                <Avatar
                  className={cn(
                    "size-9 sm:size-10 rounded-full border shrink-0 transition-all duration-300",
                    isThisArtistPlaying
                      ? "border-transparent"
                      : "border-border/40",
                  )}
                  style={
                    isThisArtistPlaying
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

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-10 md:mt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14 xl:gap-20">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-16">
            {/* Top tracks */}
            <motion.section
              aria-label="Top tracks"
              {...FADE_UP}
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
              <Suspense fallback={<WaveformLoader />}>
                <TrackList
                  {...trackListProps}
                  maxHeight="auto"
                  moodColor={palette.hslChannels}
                  skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
                  staggerAnimation
                />
              </Suspense>
            </motion.section>

            {/* Photo gallery */}
            {artist.images?.length > 0 && (
              <motion.section
                aria-label="Photo gallery"
                {...FADE_UP}
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
                <DraggableImageGallery
                  images={artist.images}
                  artistName={artist.name}
                />
              </motion.section>
            )}

            {/* Discography */}
            <motion.section
              aria-label="Discography"
              {...FADE_UP}
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
                      Xem tất cả
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
              {albums.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9">
                  {albums.map((album: IAlbum) => (
                    <PublicAlbumCard key={album._id} album={album} />
                  ))}
                </div>
              ) : (
                <MusicResult
                  variant="empty-albums"
                  description="Album hiện đang trống"
                />
              )}
            </motion.section>
          </div>

          {/* Right column — sticky sidebar */}
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
                style={accentBg}
              />

              <BiographyCard artist={artist} palette={palette} />
              <SocialLinksSection
                socialLinks={artist.socialLinks}
                accentColor={palette.hex}
              />
            </div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
};

export default ArtistDetailPage;
