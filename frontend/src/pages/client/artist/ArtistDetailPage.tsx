import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
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
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// UI Components
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
import { Album } from "@/features/album/types";
import { useArtistDetail } from "@/features/artist/hooks/useArtistsQuery";
import { useAppDispatch } from "@/store/hooks";
import { Genre, ITrack, setIsPlaying, setQueue } from "@/features";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${opacity})`
    : `rgba(59,130,246,${opacity})`;
};

const artistNameSizeClass = (name: string): string => {
  const len = name.length;
  if (len > 28) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 18) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  if (len > 10) return "text-5xl sm:text-6xl md:text-7xl lg:text-8xl";
  return "text-6xl sm:text-7xl md:text-8xl lg:text-[6.5rem] xl:text-[8rem]";
};

const formatListeners = (n: number): string =>
  new Intl.NumberFormat("vi-VN").format(n);

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface ArtistDetailPageProps {
  /**
   * page     – Full standalone page with immersive hero, sticky bar, 2-col layout (default)
   * embedded – Compact scrollable view for drawer / modal / side panel
   */
  variant?: "page" | "embedded";
  /** Override slug (for embedded). Falls back to useParams. */
  slugOverride?: string;
  /** Called when closing in embedded mode */
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const ArtistDetailPage: React.FC<ArtistDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ── UI state
  const [scrollY, setScrollY] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isScrolled = variant === "page" ? scrollY > 340 : scrollY > 150;

  // ── Data
  const {
    data: artistData,
    isLoading,
    isError,
    refetch,
  } = useArtistDetail(slug);

  const trackIds = useMemo(
    () => artistData?.topTracks?.map((t: ITrack) => t._id) || [],
    [artistData],
  );
  // ── 3. 🚀 ĐỒNG BỘ TRẠNG THÁI LIKE (TỰ ĐỘNG)
  useSyncInteractions(trackIds, "like", !isLoading);
  const artist = artistData?.artist;
  const topTracks = useMemo(() => artistData?.topTracks ?? [], [artistData]);
  const albums = useMemo(() => artistData?.albums ?? [], [artistData]);
  const themeColor = useMemo(() => artist?.themeColor ?? "#3b82f6", [artist]);

  // ── Scroll tracking — page vs embedded container
  useEffect(() => {
    if (variant === "embedded") {
      const el = scrollContainerRef.current;
      if (!el) return;
      const handler = () => setScrollY(el.scrollTop);
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    }
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [variant]);

  // ── Play dispatch helper
  const dispatchPlay = useCallback(
    (shuffled = false) => {
      const list = shuffled
        ? [...topTracks].sort(() => Math.random() - 0.5)
        : topTracks;
      dispatch(setQueue({ tracks: list, startIndex: 0 }));
      dispatch(setIsPlaying(true));
    },
    [topTracks, dispatch],
  );

  const handlePlayArtist = useCallback(async () => {
    if (!topTracks.length) {
      toast.error("Nghệ sĩ này chưa có bài hát nổi bật nào.");
      return;
    }
    setIsLoadingPlay(true);
    try {
      dispatchPlay(false);
      toast.success(`Đang phát Top ${topTracks.length} bài hát`, {
        duration: 2000,
      });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingPlay(false);
    }
  }, [topTracks, dispatchPlay]);

  const handleShuffle = useCallback(async () => {
    if (!topTracks.length) return;
    setIsLoadingShuffle(true);
    try {
      dispatchPlay(true);
      toast.success("Phát ngẫu nhiên", { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingShuffle(false);
    }
  }, [topTracks, dispatchPlay]);

  const handleBack = useCallback(() => {
    if (variant === "embedded" && onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  }, [variant, onClose, navigate]);

  // ─────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────
  if (isLoading) return <ArtistDetailSkeleton />;
  if (isError || !artist) {
    return (
      <ArtistNotFound
        onBack={() =>
          variant === "embedded" && onClose ? onClose() : navigate("/artists")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Shared: Action buttons (reused in both modes)
  // ─────────────────────────────────────────────────────────────
  const ActionButtons = (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {/* Play */}
      <button
        type="button"
        onClick={handlePlayArtist}
        disabled={isLoadingPlay}
        aria-label="Phát nhạc nghệ sĩ"
        className={cn(
          "size-13 sm:size-15 rounded-full flex items-center justify-center shrink-0",
          variant === "embedded" ? "size-11" : "size-14 sm:size-16",
          "transition-all duration-200 hover:scale-105 active:scale-90",
          "shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
        style={{
          backgroundColor: themeColor,
          boxShadow: `0 8px 28px -6px ${hexToRgba(themeColor, 0.55)}`,
        }}
      >
        {isLoadingPlay ? (
          <Loader2 className="size-6 text-white animate-spin" />
        ) : (
          <Play className="size-6 text-white fill-white ml-0.5" />
        )}
      </button>

      {/* Shuffle */}
      <ActionIconButton
        onClick={handleShuffle}
        disabled={isLoadingShuffle || !topTracks.length}
        aria-label="Phát ngẫu nhiên"
      >
        {isLoadingShuffle ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Shuffle className="size-4" />
        )}
      </ActionIconButton>

      {/* Follow */}
      <button
        type="button"
        onClick={() => setIsFollowing((f) => !f)}
        className={cn(
          "hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-xl border",
          "text-[12px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
          isFollowing
            ? "border-primary/30 text-primary bg-primary/8 hover:bg-primary/15"
            : "border-foreground/30 text-foreground bg-transparent hover:bg-foreground/8",
        )}
      >
        {isFollowing ? (
          <UserCheck className="size-3.5" />
        ) : (
          <UserPlus className="size-3.5" />
        )}
        {isFollowing ? "Đang theo dõi" : "Theo dõi"}
      </button>

      {/* Follow mobile icon */}
      <ActionIconButton
        onClick={() => setIsFollowing((f) => !f)}
        aria-label={isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
        className={cn(
          "sm:hidden",
          isFollowing && "border-primary/30 text-primary bg-primary/8",
        )}
      >
        {isFollowing ? (
          <UserCheck className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
      </ActionIconButton>

      {/* More */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionIconButton aria-label="Thêm tùy chọn">
            <MoreHorizontal className="size-4" />
          </ActionIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-52 rounded-2xl border-border/50 p-1.5 shadow-2xl bg-background/95 backdrop-blur-xl"
        >
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Share2 className="size-4 text-primary shrink-0" /> Chia sẻ trang
            nghệ sĩ
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Music4 className="size-4 text-emerald-500 shrink-0" /> Đài nghệ sĩ
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/40 my-1" />
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-destructive focus:text-destructive focus:bg-destructive/10">
            <AlertCircle className="size-4 shrink-0" /> Báo cáo vi phạm
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // EMBEDDED variant — compact scrollable panel
  // ─────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <div
        ref={scrollContainerRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground custom-scrollbar"
      >
        {/* Gradient header bg */}
        <div
          aria-hidden
          className="sticky top-0 h-[180px] -mt-0 shrink-0 pointer-events-none z-0"
          style={{
            background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.4)} 0%, transparent 100%)`,
          }}
        />

        <div className="relative z-10 -mt-[180px] px-4 pb-10">
          {/* Close */}
          {onClose && (
            <div className="flex items-center pt-4 pb-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-4" />
                Đóng
              </button>
            </div>
          )}

          {/* Compact hero */}
          <div className="flex items-end gap-4 pt-4 pb-5">
            <div className="relative shrink-0">
              <div
                aria-hidden
                className="absolute inset-0 blur-2xl rounded-full scale-125 opacity-35 pointer-events-none"
                style={{ backgroundColor: themeColor }}
              />
              <Avatar className="relative z-10 size-20 rounded-2xl border-2 border-background shadow-xl">
                <AvatarImage src={artist.avatar} className="object-cover" />
                <AvatarFallback className="text-2xl font-black bg-primary/20 text-primary rounded-2xl">
                  {artist.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 min-w-0 pb-1">
              {artist.isVerified && (
                <div className="flex items-center gap-1 mb-1">
                  <BadgeCheck className="size-3.5 fill-blue-500 text-background" />
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
            </div>
          </div>

          {/* Action row */}
          {ActionButtons}

          {/* Top tracks */}
          {topTracks.length > 0 && (
            <div className="mt-7">
              <SectionHeader
                label="Phổ biến"
                icon={<TrendingUp className="size-3.5 text-primary" />}
                compact
              />
              <div className="mt-3 rounded-xl overflow-hidden border border-border/30 bg-card/40">
                <TrackList tracks={topTracks.slice(0, 5)} isLoading={false} />
              </div>
            </div>
          )}

          {/* Albums */}
          {albums.length > 0 && (
            <div className="mt-8">
              <SectionHeader
                label="Đĩa nhạc"
                icon={<Disc3 className="size-3.5 text-primary" />}
                compact
              />
              <div className="grid grid-cols-2 gap-3 mt-3">
                {albums.slice(0, 4).map((album: Album) => (
                  <PublicAlbumCard key={album._id} album={album} />
                ))}
              </div>
            </div>
          )}

          {/* Bio snippet */}
          {artist.bio && (
            <div className="mt-7 p-4 rounded-2xl bg-card/50 border border-border/30">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center gap-1.5">
                <Info className="size-3.5" /> Tiểu sử
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

  // ─────────────────────────────────────────────────────────────
  // PAGE variant — full standalone page
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* ── 1. Immersive Hero ── */}
      <section className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[620px] flex flex-col justify-end overflow-hidden shrink-0 group/hero">
        {/* Dynamic color wash */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000"
          style={{
            background: `linear-gradient(160deg,
              ${hexToRgba(themeColor, 0.55)} 0%,
              ${hexToRgba(themeColor, 0.15)} 55%,
              transparent 100%)`,
          }}
        />

        {/* Cover image parallax layer */}
        {artist.coverImage && (
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 bg-cover bg-center z-0 pointer-events-none",
              "transition-transform duration-[5s] ease-out group-hover/hero:scale-105",
              "opacity-50 dark:opacity-30 mix-blend-overlay",
            )}
            style={{ backgroundImage: `url(${artist.coverImage})` }}
          />
        )}

        {/* Noise texture */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "180px 180px",
          }}
        />

        {/* Bottom fade to background */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent z-0 pointer-events-none"
        />

        {/* Back nav */}
        <div className="absolute top-5 left-4 sm:left-6 lg:left-8 z-20">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/30 backdrop-blur-sm"
          >
            <ChevronLeft className="size-4" />
            Quay lại
          </button>
        </div>

        {/* Hero content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 mt-20">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 text-center md:text-left">
            {/* Avatar with glow */}
            <div className="relative shrink-0 group/avatar">
              <div
                aria-hidden
                className="absolute inset-0 blur-[40px] rounded-full scale-125 opacity-45 pointer-events-none transition-opacity duration-700 group-hover/avatar:opacity-60"
                style={{ backgroundColor: themeColor }}
              />
              <Avatar className="relative z-10 size-[160px] sm:size-[210px] md:size-[260px] rounded-full border-[5px] sm:border-[7px] border-background shadow-2xl bg-card transition-transform duration-500 group-hover/avatar:scale-[1.02]">
                <AvatarImage src={artist.avatar} className="object-cover" />
                <AvatarFallback className="text-5xl font-black bg-muted text-muted-foreground">
                  {artist.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name + meta */}
            <div className="flex flex-col items-center md:items-start gap-3 sm:gap-4 flex-1 min-w-0 pb-1">
              {artist.isVerified && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-foreground/90">
                  <BadgeCheck className="size-3.5 sm:size-4 fill-blue-500 text-background" />
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
                    <TrendingUp className="size-3.5 text-primary shrink-0" />
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
                    <MapPin className="size-3.5 shrink-0" />
                    {artist.nationality}
                  </div>
                )}
              </div>

              {/* Genre tags */}
              {artist.genres?.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-0.5">
                  {artist.genres.slice(0, 5).map((g: Genre) => (
                    <span
                      key={g._id ?? g}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-background/25 backdrop-blur-sm border border-white/12 text-foreground/75"
                    >
                      {g.name ?? g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Sticky Action Bar ── */}
      <div
        className={cn(
          "sticky z-40 transition-all duration-300",
          "top-[var(--navbar-height,64px)]",
          isScrolled
            ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
            : "bg-transparent border-b border-transparent",
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          {ActionButtons}

          {/* Mini artist info — fades in on scroll */}
          <div
            className={cn(
              "flex items-center gap-2.5 transition-all duration-400 pointer-events-none select-none",
              isScrolled
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-3",
            )}
          >
            <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] hidden sm:block">
              {artist.name}
            </span>
            <Avatar className="size-9 sm:size-10 rounded-full border border-border/40 shadow-sm shrink-0">
              <AvatarImage src={artist.avatar} className="object-cover" />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {artist.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* ── 3. Main Content ── */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 mt-10 md:mt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14 xl:gap-20">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-16">
            {/* Top Tracks */}
            <section>
              <SectionHeader
                label="Phổ biến"
                icon={<TrendingUp className="size-4.5 text-primary" />}
              />
              <div className="mt-6">
                {topTracks.length > 0 ? (
                  <TrackList tracks={topTracks} isLoading={false} />
                ) : (
                  <EmptySection
                    icon={<Mic2 />}
                    title="Chưa có bài hát nổi bật"
                    message="Nghệ sĩ này chưa đủ lượt nghe để hiển thị bảng xếp hạng."
                  />
                )}
              </div>
            </section>

            {/* Image Gallery */}
            {artist.images?.length > 0 && (
              <section>
                <SectionHeader
                  label="Thư viện ảnh"
                  icon={<Camera className="size-4.5 text-primary" />}
                />
                <div className="mt-5">
                  <DraggableImageGallery
                    images={artist.images}
                    artistName={artist.name}
                  />
                </div>
              </section>
            )}

            {/* Albums */}
            <section>
              <SectionHeader
                label="Đĩa nhạc"
                icon={<Disc3 className="size-4.5 text-primary" />}
                action={
                  albums.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/artists/${slug}/albums`)}
                      className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      Xem tất cả <ChevronRight className="size-3.5" />
                    </button>
                  ) : undefined
                }
              />
              <div className="mt-6">
                {albums.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9">
                    {albums.map((album: Album) => (
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
            </section>
          </div>

          {/* Right column: Bio + Social */}
          <aside className="lg:col-span-4">
            <div className="sticky top-[calc(var(--navbar-height,64px)+4.5rem)] space-y-8">
              {/* Ambient glow */}
              <div
                aria-hidden
                className="absolute -top-12 -right-8 w-[110%] aspect-square rounded-full blur-[100px] opacity-10 pointer-events-none -z-10"
                style={{ backgroundColor: themeColor }}
              />

              {/* Bio card */}
              <section className="bg-card/55 backdrop-blur-md rounded-3xl p-6 border border-border/50 shadow-lg overflow-hidden">
                <h3 className="font-black text-base uppercase tracking-wider mb-5 flex items-center gap-2.5 text-foreground">
                  <Info className="size-4 text-primary shrink-0" />
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
                    <Mic2 className="size-7 text-muted-foreground/25 mx-auto mb-2.5" />
                    <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest italic">
                      Tiểu sử đang cập nhật
                    </p>
                  </div>
                )}

                {/* Genre badges */}
                {artist.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-5 mt-5 border-t border-border/40">
                    {artist.genres.map((g: Genre) => (
                      <Badge
                        key={g._id ?? g}
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border border-border/30 hover:bg-primary/15 hover:text-primary transition-colors cursor-default"
                      >
                        {g.name ?? g}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              {/* Social links */}
              {artist.socialLinks &&
                Object.values(artist.socialLinks).some(Boolean) && (
                  <section className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                      <span
                        className="inline-block w-4 h-0.5 rounded-full"
                        style={{ backgroundColor: themeColor }}
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
                        color={themeColor}
                      />
                    </div>
                  </section>
                )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Generic icon action button */
const ActionIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "size-10 sm:size-11 rounded-full flex items-center justify-center",
      "border border-border/50 bg-background/25 backdrop-blur-sm",
      "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
      "transition-all duration-150 active:scale-90",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
ActionIconButton.displayName = "ActionIconButton";

/** Section heading with optional action button */
const SectionHeader: React.FC<{
  label: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}> = ({ label, icon, action, compact }) => (
  <div className="flex items-center justify-between px-0.5">
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
);

/** Draggable horizontal image gallery — mouse drag + touch scroll */
const DraggableImageGallery: React.FC<{
  images: string[];
  artistName: string;
}> = ({ images, artistName }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragState.current = {
      startX: e.pageX - scrollRef.current.offsetLeft,
      scrollLeft: scrollRef.current.scrollLeft,
    };
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - dragState.current.startX) * 1.6;
      scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
    },
    [isDragging],
  );

  const stopDrag = useCallback(() => setIsDragging(false), []);

  return (
    <div
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      className={cn(
        "flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-0 sm:px-0",
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        isDragging
          ? "cursor-grabbing select-none"
          : "cursor-grab snap-x snap-mandatory scroll-smooth",
      )}
    >
      {images.map((img: string, idx: number) => (
        <div
          key={idx}
          className={cn(
            "shrink-0 snap-center rounded-2xl sm:rounded-3xl overflow-hidden",
            "aspect-[16/10] w-[82vw] sm:w-[360px] md:w-[440px]",
            "border border-border/30 bg-muted shadow-md",
            "group select-none relative",
          )}
        >
          <img
            src={img}
            alt={`${artistName} ${idx + 1}`}
            loading="lazy"
            draggable={false}
            className="size-full object-cover transition-transform duration-[2.5s] group-hover:scale-[1.04] pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-500 pointer-events-none"
          />
        </div>
      ))}
      {/* Trailing spacer to allow last card to center on mobile */}
      <div className="shrink-0 w-4 sm:hidden" />
    </div>
  );
};

/** Social link pill */
const SocialLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  href?: string;
  color: string;
}> = ({ icon, label, href, color }) => {
  if (!href?.trim()) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group flex items-center justify-center sm:justify-start gap-3 h-11",
        "rounded-2xl bg-card border border-border/50 px-4",
        "hover:border-border hover:-translate-y-0.5 hover:shadow-md",
        "transition-all duration-150 active:scale-95",
      )}
    >
      <span
        className="shrink-0 transition-transform duration-150 group-hover:scale-110"
        style={{ color }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
        {label}
      </span>
    </a>
  );
};

/** Empty section placeholder */
const EmptySection: React.FC<{
  icon: React.ReactElement;
  title: string;
  message: string;
}> = ({ icon, title, message }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 bg-muted/10 rounded-3xl border border-dashed border-border/50 text-center gap-4">
    <div className="size-14 rounded-full bg-background border border-border/40 shadow-sm flex items-center justify-center text-muted-foreground/30">
      {React.cloneElement(icon, { size: 24, strokeWidth: 1.5 })}
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
);

/** Skeleton loader */
const ArtistDetailSkeleton: React.FC = () => (
  <div className="w-full min-h-screen bg-background flex flex-col overflow-hidden">
    <div className="h-[460px] sm:h-[560px] w-full bg-muted/20 animate-pulse relative">
      <div className="absolute bottom-10 left-4 sm:left-8 flex items-end gap-7">
        <div className="size-[160px] sm:size-[210px] rounded-full bg-muted border-[6px] border-background shadow-lg" />
        <div className="space-y-3 mb-3">
          <div className="h-3 w-24 bg-muted/60 rounded-full" />
          <div className="h-14 w-72 bg-muted rounded-xl" />
          <div className="h-4 w-44 bg-muted/50 rounded-full" />
        </div>
      </div>
    </div>
    <div className="h-[60px] w-full bg-card border-b border-border/30 mb-12 animate-pulse" />
    <div className="container mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-14">
      <div className="lg:col-span-8 space-y-10">
        <div className="h-7 bg-muted rounded-lg w-44 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 bg-muted/25 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="lg:col-span-4 h-[460px] bg-muted/15 rounded-3xl animate-pulse border border-border/30" />
    </div>
  </div>
);

/** Error / not found state */
const ArtistNotFound: React.FC<{
  onBack: () => void;
  onRetry: () => void;
}> = ({ onBack, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in fade-in zoom-in-95 duration-500">
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-destructive/10 blur-[80px] rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-3xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <AlertCircle className="size-10 text-muted-foreground/50" />
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
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border/60 text-sm font-bold text-foreground/80 hover:bg-muted/60 transition-all active:scale-95"
      >
        <RefreshCw className="size-3.5" />
        Thử lại
      </button>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-95"
      >
        <ChevronLeft className="size-4" />
        Quay lại
      </button>
    </div>
  </div>
);

export default ArtistDetailPage;
