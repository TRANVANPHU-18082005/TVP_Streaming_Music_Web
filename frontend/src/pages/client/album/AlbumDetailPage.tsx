import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
  Heart,
  MoreHorizontal,
  Share2,
  AlertCircle,
  ListMusic,
  Plus,
  Music4,
  Loader2,
  ChevronLeft,
  Shuffle,
  RefreshCw,
  Disc3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// UI Components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlbumDetailSkeleton } from "@/features/album/components/AlbumDetailSkeleton";
import { TrackList } from "@/features/track/components/TrackList";

// Hooks & Redux
import { useAlbumDetail } from "@/features/album/hooks/useAlbumsQuery";
import { useAppDispatch } from "@/store/hooks";
import { Genre, ITrack, setIsPlaying, setQueue } from "@/features";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${opacity})`
    : `rgba(91,33,182,${opacity})`;
};

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
};

const titleSizeClass = (title: string): string => {
  const len = title.length;
  if (len > 40) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl";
  if (len > 22) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 12) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  return "text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem]";
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface AlbumDetailPageProps {
  /**
   * page     – Full standalone page with back nav, sticky bar, gradient hero (default)
   * embedded – Compact view for use inside a drawer, modal or side panel
   */
  variant?: "page" | "embedded";
  /** Override slug (for embedded mode). Falls back to useParams. */
  slugOverride?: string;
  /** Called when back button is pressed in embedded mode */
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({
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
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isScrolled = variant === "page" ? scrollY > 280 : scrollY > 160;

  // ── 1. Data Fetching
  const { data: album, isLoading, isError, refetch } = useAlbumDetail(slug);

  // ── 2. Trích xuất IDs bài hát
  const trackIds = useMemo(
    () => album?.tracks?.map((t: ITrack) => t._id) || [],
    [album],
  );
  // ── 3. 🚀 ĐỒNG BỘ TRẠNG THÁI LIKE (TỰ ĐỘNG)
  useSyncInteractions(trackIds, "like", !isLoading);

  const themeColor = useMemo(() => album?.themeColor ?? "#5b21b6", [album]);
  const tracks = useMemo(() => album?.tracks || [], [album]);
  const totalDurationSec = useMemo(
    () =>
      album?.totalDuration ?? tracks.reduce((s, t) => s + (t.duration ?? 0), 0),
    [album, tracks],
  );

  // ── Scroll tracking
  useEffect(() => {
    if (variant === "embedded") {
      // Track scroll inside the embedded container
      const el = scrollContainerRef.current;
      if (!el) return;
      const handler = () => setScrollY(el.scrollTop);
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    }
    // page variant: track window scroll
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [variant]);

  // ── Play helpers
  const dispatchPlay = useCallback(
    (shuffled = false) => {
      const ordered = shuffled
        ? [...tracks].sort(() => Math.random() - 0.5)
        : tracks;
      dispatch(setQueue({ tracks: ordered, startIndex: 0 }));
      dispatch(setIsPlaying(true));
    },
    [tracks, dispatch],
  );

  const handlePlayAlbum = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Đĩa nhạc này chưa có bài hát nào.");
      return;
    }
    setIsLoadingPlay(true);
    try {
      dispatchPlay(false);
      toast.success(`Đang phát ${tracks.length} bài`, { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingPlay(false);
    }
  }, [tracks, dispatchPlay]);

  const handleShuffle = useCallback(async () => {
    if (!tracks.length) return;
    setIsLoadingShuffle(true);
    try {
      dispatchPlay(true);
      toast.success("Phát ngẫu nhiên", { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingShuffle(false);
    }
  }, [tracks, dispatchPlay]);

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
  if (isLoading) return <AlbumDetailSkeleton />;

  if (isError || !album) {
    return (
      <AlbumErrorState
        onBack={() =>
          variant === "embedded" && onClose ? onClose() : navigate("/albums")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EMBEDDED variant
  // ─────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <div
        ref={scrollContainerRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground custom-scrollbar"
      >
        {/* Compact gradient */}
        <div
          aria-hidden
          className="sticky top-0 h-[220px] -mt-0 pointer-events-none shrink-0 z-0"
          style={{
            background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.45)} 0%, transparent 100%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 -mt-[220px] px-4 pb-10">
          {/* Close button */}
          {onClose && (
            <div className="flex items-center pt-4 pb-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-4" />
                Đóng
              </button>
            </div>
          )}

          {/* Compact hero */}
          <div className="flex items-center gap-4 pt-2 pb-5">
            <div className="relative shrink-0 size-20 rounded-xl overflow-hidden shadow-lg border border-border/20">
              <img
                src={album.coverImage || "/images/default-album.png"}
                alt={album.title}
                className="size-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Badge
                variant="outline"
                className="text-[9px] font-black uppercase tracking-widest mb-1.5 border-border/40"
              >
                {album.type || "Album"}
              </Badge>
              <h2 className="text-xl font-black tracking-tight leading-tight truncate text-foreground">
                {album.title}
              </h2>
              <div
                className="flex items-center gap-1.5 mt-1 cursor-pointer group"
                onClick={() => navigate(`/artist/${album.artist?.slug}`)}
              >
                <Avatar className="size-4.5 border border-background/80">
                  <AvatarImage src={album.artist?.avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                    {album.artist?.name?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[13px] font-bold text-foreground/80 group-hover:text-foreground group-hover:underline underline-offset-2 truncate">
                  {album.artist?.name ?? "Unknown Artist"}
                </span>
                {album.releaseYear && (
                  <>
                    <span className="text-muted-foreground/40 text-xs">•</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {album.releaseYear}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action row */}
          <EmbeddedActionRow
            themeColor={themeColor}
            isLoadingPlay={isLoadingPlay}
            isLoadingShuffle={isLoadingShuffle}
            isSaved={isSaved}
            hasTracks={tracks.length > 0}
            onPlay={handlePlayAlbum}
            onShuffle={handleShuffle}
            onSave={() => setIsSaved((s) => !s)}
          />

          {/* Stats */}
          <AlbumStats
            trackCount={album.totalTracks ?? tracks.length}
            duration={totalDurationSec}
            className="mb-5"
          />

          {/* Tracklist */}
          <div className="rounded-xl overflow-hidden border border-border/30 bg-card/40">
            {tracks.length > 0 ? (
              <TrackList tracks={tracks} isLoading={false} />
            ) : (
              <AlbumEmptyTracks compact />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PAGE variant (default)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary animate-in fade-in duration-700">
      {/* ── Layer 1: Full-bleed gradient backdrop ── */}
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={{
          background: `linear-gradient(180deg,
            ${hexToRgba(themeColor, 0.65)} 0%,
            ${hexToRgba(themeColor, 0.25)} 45%,
            transparent 100%)`,
          // Blend correctly in dark vs light
        }}
      />
      {/* Noise texture overlay for depth */}
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
      />

      {/* ── Layer 2: Content ── */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Back nav */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-bold transition-all duration-200",
              "text-foreground/60 hover:text-foreground",
              "px-2 py-1 rounded-lg hover:bg-background/40",
            )}
          >
            <ChevronLeft className="size-4" />
            Quay lại
          </button>
        </div>

        {/* ── Hero ── */}
        <header className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10">
          {/* Cover art */}
          <div className="group relative shrink-0">
            {/* Glow shadow behind cover */}
            <div
              aria-hidden
              className="absolute -inset-3 rounded-2xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
              style={{ backgroundColor: themeColor }}
            />
            <div className="relative size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.45)] overflow-hidden border border-white/10 bg-muted transition-transform duration-500 group-hover:scale-[1.015]">
              <img
                src={album.coverImage || "/images/default-album.png"}
                alt={album.title}
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="eager"
              />
              {/* Inner vignette */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/20 pointer-events-none"
              />
            </div>
          </div>

          {/* Text info */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1">
            <Badge
              variant="outline"
              className="text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1 bg-background/30 backdrop-blur-md border-white/20 text-foreground/90 shadow-sm"
            >
              {album.type ?? "Album"}
            </Badge>

            <h1
              className={cn(
                "font-black tracking-tighter leading-[1.02] text-foreground drop-shadow-lg w-full",
                titleSizeClass(album.title),
              )}
            >
              {album.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1.5 mt-1">
              {/* Artist */}
              <button
                type="button"
                onClick={() => navigate(`/artist/${album.artist?.slug}`)}
                className="flex items-center gap-2 group/artist hover:opacity-90 transition-opacity"
              >
                <Avatar className="size-6 border-2 border-background/70 shadow-sm shrink-0">
                  <AvatarImage src={album.artist?.avatar} />
                  <AvatarFallback className="text-[9px] font-black bg-primary/20 text-primary">
                    {album.artist?.name?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-black text-foreground group-hover/artist:underline underline-offset-4 decoration-2">
                  {album.artist?.name ?? "Unknown Artist"}
                </span>
              </button>

              {album.releaseYear && (
                <>
                  <span className="text-foreground/30 text-xs hidden sm:inline">
                    •
                  </span>
                  <span className="text-sm font-semibold text-foreground/75">
                    {album.releaseYear}
                  </span>
                </>
              )}

              <span className="text-foreground/30 text-xs hidden sm:inline">
                •
              </span>
              <AlbumStats
                trackCount={album.totalTracks ?? tracks.length}
                duration={totalDurationSec}
                inline
              />
            </div>

            {/* Genre tags */}
            {album.genres?.length > 0 && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-1">
                {album.genres.slice(0, 4).map((g: Genre) => (
                  <span
                    key={g._id ?? g}
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-background/30 backdrop-blur-sm border border-white/15 text-foreground/80"
                  >
                    {g.name ?? g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ── Sticky Action Bar ── */}
        <div
          className={cn(
            "sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex items-center justify-between gap-4",
            "transition-all duration-300",
            // Sticky offset using CSS variable (set by layout)
            "top-[var(--navbar-height,64px)]",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
        >
          {/* Left: actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play */}
            <button
              type="button"
              onClick={handlePlayAlbum}
              disabled={isLoadingPlay}
              aria-label="Phát album"
              className={cn(
                "relative size-14 sm:size-16 rounded-full flex items-center justify-center shrink-0",
                "shadow-lg transition-all duration-200",
                "hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                "disabled:opacity-70 disabled:cursor-not-allowed",
              )}
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 8px 28px -6px ${hexToRgba(themeColor, 0.55)}`,
              }}
            >
              {isLoadingPlay ? (
                <Loader2 className="size-6 sm:size-7 text-white animate-spin" />
              ) : (
                <Play className="size-6 sm:size-7 text-white fill-white ml-1" />
              )}
            </button>

            {/* Shuffle */}
            <button
              type="button"
              onClick={handleShuffle}
              disabled={isLoadingShuffle || !tracks.length}
              aria-label="Phát ngẫu nhiên"
              className={cn(
                "size-10 sm:size-11 rounded-full flex items-center justify-center",
                "border border-border/50 bg-background/30 backdrop-blur-sm",
                "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
                "transition-all duration-150 active:scale-90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {isLoadingShuffle ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Shuffle className="size-4" />
              )}
            </button>

            {/* Save */}
            <button
              type="button"
              onClick={() => setIsSaved((s) => !s)}
              aria-label={isSaved ? "Đã lưu" : "Lưu album"}
              className={cn(
                "size-10 sm:size-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
                isSaved
                  ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15"
                  : "border border-border/50 bg-background/30 text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
              )}
            >
              <Heart
                className={cn(
                  "size-4 transition-all duration-300",
                  isSaved && "fill-emerald-500 scale-110",
                )}
              />
            </button>

            {/* More */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "size-10 sm:size-11 rounded-full flex items-center justify-center",
                    "border border-border/50 bg-background/30 backdrop-blur-sm",
                    "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
                    "transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
                  )}
                >
                  <MoreHorizontal className="size-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
              >
                <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer">
                  <Plus className="size-4 shrink-0" /> Thêm vào Playlist
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer">
                  <ListMusic className="size-4 shrink-0" /> Thêm vào hàng đợi
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40 my-1" />
                <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer text-primary focus:text-primary focus:bg-primary/10">
                  <Share2 className="size-4 shrink-0" /> Chia sẻ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: mini info (fades in on scroll) */}
          <div
            className={cn(
              "flex items-center gap-2.5 transition-all duration-400 pointer-events-none select-none",
              isScrolled
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-3",
            )}
          >
            <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
              {album.title}
            </span>
            <div className="size-9 sm:size-10 rounded-lg overflow-hidden shadow-sm border border-border/30 shrink-0">
              <img
                src={album.coverImage || "/images/default-album.png"}
                alt=""
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* ── Tracklist ── */}
        <div className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm -mx-1 sm:mx-0 custom-scrollbar">
          {tracks.length > 0 ? (
            <TrackList tracks={tracks} isLoading={false} />
          ) : (
            <AlbumEmptyTracks />
          )}
        </div>

        {/* ── Footer credits ── */}
        {tracks.length > 0 && album.releaseYear && (
          <footer className="mt-16 pt-7 border-t border-border/25 space-y-3 text-[11px] text-muted-foreground/55 font-medium pb-8">
            <p className="font-black text-[10px] uppercase tracking-[0.15em] text-foreground/50">
              {new Date(album.createdAt ?? Date.now()).toLocaleDateString(
                "vi-VN",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                },
              )}
            </p>
            <div className="font-mono text-[10px] uppercase tracking-wider space-y-1">
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Inline or block album stats */
const AlbumStats: React.FC<{
  trackCount: number;
  duration: number;
  inline?: boolean;
  className?: string;
}> = ({ trackCount, duration, inline, className }) => {
  const text = `${trackCount} bài hát${duration > 0 ? ` · ${formatDuration(duration)}` : ""}`;
  if (inline) {
    return (
      <span
        className={cn("text-sm font-semibold text-foreground/70", className)}
      >
        {text}
      </span>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground font-medium",
        className,
      )}
    >
      <Disc3 className="size-3.5 opacity-50 shrink-0" />
      <span>{text}</span>
    </div>
  );
};

/** Action row for embedded variant */
const EmbeddedActionRow: React.FC<{
  themeColor: string;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isSaved: boolean;
  hasTracks: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  onSave: () => void;
}> = ({
  themeColor,
  isLoadingPlay,
  isLoadingShuffle,
  isSaved,
  hasTracks,
  onPlay,
  onShuffle,
  onSave,
}) => (
  <div className="flex items-center gap-3 mb-5">
    {/* Play */}
    <button
      type="button"
      onClick={onPlay}
      disabled={isLoadingPlay || !hasTracks}
      className={cn(
        "size-12 rounded-full flex items-center justify-center shrink-0",
        "transition-all duration-200 hover:scale-105 active:scale-90",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      )}
      style={{
        backgroundColor: themeColor,
        boxShadow: `0 6px 20px -4px ${hexToRgba(themeColor, 0.5)}`,
      }}
    >
      {isLoadingPlay ? (
        <Loader2 className="size-5 text-white animate-spin" />
      ) : (
        <Play className="size-5 text-white fill-white ml-0.5" />
      )}
    </button>

    {/* Shuffle */}
    <button
      type="button"
      onClick={onShuffle}
      disabled={isLoadingShuffle || !hasTracks}
      className={cn(
        "size-10 rounded-full flex items-center justify-center border border-border/50",
        "text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-all duration-150 active:scale-90",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    >
      {isLoadingShuffle ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Shuffle className="size-3.5" />
      )}
    </button>

    {/* Save */}
    <button
      type="button"
      onClick={onSave}
      className={cn(
        "size-10 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90",
        isSaved
          ? "text-emerald-500 border-emerald-500/25 bg-emerald-500/10"
          : "border-border/50 text-foreground/70 hover:text-foreground hover:bg-muted/60",
      )}
    >
      <Heart
        className={cn(
          "size-3.5 transition-all duration-300",
          isSaved && "fill-emerald-500 scale-110",
        )}
      />
    </button>

    <div className="flex-1" />

    {/* More */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="size-9 rounded-full flex items-center justify-center border border-border/50 text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-all duration-150 active:scale-90 focus-visible:outline-none"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-xl"
      >
        <DropdownMenuItem className="gap-2 py-2 px-3 text-sm font-semibold rounded-lg cursor-pointer">
          <Plus className="size-3.5" /> Thêm vào Playlist
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2 px-3 text-sm font-semibold rounded-lg cursor-pointer">
          <ListMusic className="size-3.5" /> Thêm vào hàng đợi
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/40 my-1" />
        <DropdownMenuItem className="gap-2 py-2 px-3 text-sm font-semibold rounded-lg cursor-pointer text-primary focus:text-primary focus:bg-primary/10">
          <Share2 className="size-3.5" /> Chia sẻ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

/** Empty tracklist state */
const AlbumEmptyTracks: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4" : "py-16 px-6",
    )}
  >
    <div
      className={cn(
        "rounded-full bg-muted/40 border border-dashed border-muted-foreground/20 flex items-center justify-center mb-4",
        compact ? "size-14" : "size-20",
      )}
    >
      <Music4
        className={cn(
          "text-muted-foreground/30",
          compact ? "size-6" : "size-9",
        )}
      />
    </div>
    <h3
      className={cn(
        "font-black uppercase tracking-widest text-foreground/80 mb-2",
        compact ? "text-sm" : "text-base",
      )}
    >
      Chưa có bài hát
    </h3>
    <p
      className={cn(
        "text-muted-foreground font-medium leading-relaxed max-w-xs",
        compact ? "text-xs" : "text-sm",
      )}
    >
      Đĩa nhạc này chưa có bài hát nào. Nghệ sĩ có thể đang cập nhật.
    </p>
  </div>
);

/** Error / not found state */
const AlbumErrorState: React.FC<{
  onBack: () => void;
  onRetry: () => void;
}> = ({ onBack, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in zoom-in-95 fade-in duration-500">
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-destructive/15 blur-[80px] rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-2xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <AlertCircle className="size-10 text-muted-foreground/60" />
      </div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground">
        Không tìm thấy đĩa nhạc
      </h2>
      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
        Đĩa nhạc không tồn tại, đã bị xóa, hoặc chuyển về chế độ riêng tư.
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

export default AlbumDetailPage;
