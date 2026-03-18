import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
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
import { toast } from "sonner";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { SubGenreGrid } from "@/features/genre/components/SubGenreGrid";
import { TrackList } from "@/features/track/components/TrackList";
import { usePublicTracks } from "@/features/track/hooks/useTracksQuery";
import { useAppDispatch } from "@/store/hooks";
import { ITrack, setIsPlaying, setQueue } from "@/features";
import { useGenreDetailQuery } from "@/features/genre/hooks/useGenresQuery";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

dayjs.extend(relativeTime);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}, ${opacity})`
    : `rgba(139,92,246,${opacity})`;
};

const formatCount = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface GenreDetailPageProps {
  /**
   * page     – Full standalone page with hero, sticky bar, gradient backdrop (default)
   * embedded – Compact scrollable panel for drawer / modal / side panel
   */
  variant?: "page" | "embedded";
  /** Override slug (embedded). Falls back to useParams. */
  slugOverride?: string;
  /** Called when closing in embedded mode */
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export const GenreDetailPage: React.FC<GenreDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [scrollY, setScrollY] = useState(0);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);

  const isScrolled = variant === "page" ? scrollY > 260 : scrollY > 130;

  // ── Data
  const {
    data: genre,
    isLoading: loadingGenre,
    isError,
    refetch,
  } = useGenreDetailQuery(slug);

  const { data: tracksRes, isLoading: loadingTracks } = usePublicTracks({
    genreId: genre?._id ?? "",
    limit: 50,
    sort: "popular",
    page: 1,
  });
  const trackIds = useMemo(
    () => tracksRes?.tracks?.map((t: ITrack) => t._id) || [],
    [tracksRes],
  );
  // ── 3. 🚀 ĐỒNG BỘ TRẠNG THÁI LIKE (TỰ ĐỘNG)
  useSyncInteractions(trackIds, "like", !loadingTracks);
  const tracks = useMemo(() => tracksRes?.tracks ?? [], [tracksRes]);
  const themeColor = useMemo(() => genre?.color ?? "#8b5cf6", [genre]);

  // ── Reset scroll on slug change (page mode only)
  useEffect(() => {
    if (variant === "page") window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug, variant]);

  // ── Scroll tracking — window vs container
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
        ? [...tracks].sort(() => Math.random() - 0.5)
        : tracks;
      dispatch(setQueue({ tracks: list, startIndex: 0 }));
      dispatch(setIsPlaying(true));
    },
    [tracks, dispatch],
  );

  const handlePlayGenre = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Thể loại này chưa có bài hát nào.");
      return;
    }
    setIsLoadingPlay(true);
    try {
      dispatchPlay(false);
      toast.success(`Đang phát ${tracks.length} bài hát`, { duration: 2000 });
    } catch {
      toast.error("Không thể phát nhạc. Vui lòng thử lại.");
    } finally {
      setIsLoadingPlay(false);
    }
  }, [tracks, dispatchPlay]);

  const handleShuffleGenre = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Thể loại này chưa có bài hát nào.");
      return;
    }
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
    if (variant === "embedded" && onClose) onClose();
    else navigate(-1);
  }, [variant, onClose, navigate]);

  // ─────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────
  if (loadingGenre) return <GenreDetailSkeleton />;
  if (isError || !genre) {
    return (
      <GenreNotFound
        onBack={() =>
          variant === "embedded" && onClose ? onClose() : navigate("/genres")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ── Shared action buttons
  const ActionButtons = (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {/* Play */}
      <button
        type="button"
        onClick={handlePlayGenre}
        disabled={isLoadingPlay || loadingTracks}
        aria-label="Phát thể loại"
        className={cn(
          variant === "embedded" ? "size-11" : "size-14 sm:size-16",
          "rounded-full flex items-center justify-center shrink-0",
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
        onClick={handleShuffleGenre}
        disabled={isLoadingShuffle || loadingTracks || !tracks.length}
        aria-label="Phát ngẫu nhiên"
      >
        {isLoadingShuffle ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Shuffle className="size-4" />
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
          className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
        >
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <Share2 className="size-4 text-primary shrink-0" /> Chia sẻ thể loại
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
            <ListMusic className="size-4 text-emerald-500 shrink-0" /> Thêm vào
            hàng đợi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // EMBEDDED variant
  // ─────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <div
        ref={scrollContainerRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground custom-scrollbar"
      >
        {/* Gradient cap */}
        <div
          aria-hidden
          className="sticky top-0 h-[160px] -mt-0 shrink-0 pointer-events-none z-0"
          style={{
            background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.38)} 0%, transparent 100%)`,
          }}
        />

        <div className="relative z-10 -mt-[160px] px-4 pb-10">
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
          <div className="flex items-center gap-4 pt-3 pb-5">
            <GenreCover
              image={genre.image}
              name={genre.name}
              themeColor={themeColor}
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
            </div>
          </div>

          {/* Actions */}
          {ActionButtons}

          {/* Description */}
          {genre.description && (
            <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-5 line-clamp-3">
              {genre.description}
            </p>
          )}

          {/* Sub-genres */}
          {genre.subGenres?.length > 0 && (
            <div className="mt-7">
              <EmbeddedSectionHeader label="Phân nhánh" />
              <div className="mt-3">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </div>
          )}

          {/* Tracks */}
          <div className="mt-7">
            <EmbeddedSectionHeader label="Bài hát nổi bật" />
            <div className="mt-3 rounded-xl overflow-hidden border border-border/30 bg-card/40">
              {loadingTracks ? (
                <TrackListSkeleton count={5} />
              ) : tracks.length > 0 ? (
                <TrackList tracks={tracks.slice(0, 10)} isLoading={false} />
              ) : (
                <EmptyTracks compact />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PAGE variant — full standalone
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* ── Backdrop gradient */}
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
        style={{
          background: `linear-gradient(180deg,
            ${hexToRgba(themeColor, 0.62)} 0%,
            ${hexToRgba(themeColor, 0.18)} 50%,
            transparent 100%)`,
        }}
      />
      {/* Noise texture */}
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
      />

      {/* ── Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back nav */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/30"
          >
            <ChevronLeft className="size-4" />
            Quay lại
          </button>
        </div>

        {/* ── Hero */}
        <header className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10">
          {/* Cover art */}
          <GenreCover
            image={genre.image}
            name={genre.name}
            themeColor={themeColor}
            size="lg"
          />

          {/* Info */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
              <Hash className="size-3" />
              Thể loại âm nhạc
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-foreground leading-[1.02] drop-shadow-xl line-clamp-2 w-full">
              {genre.name}
            </h1>

            {genre.description && (
              <p className="text-muted-foreground text-sm md:text-[15px] font-medium line-clamp-2 max-w-xl mt-0.5">
                {genre.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 mt-1.5">
              <GenreStats
                trackCount={genre.trackCount}
                artistCount={genre.artistCount}
              />
            </div>

            {/* Parent genre breadcrumb */}
            {genre.parentId && (
              <button
                type="button"
                onClick={() => navigate(`/genres/${genre.parentId?.slug}`)}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-foreground/55 hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-3" />
                Thuộc dòng nhạc:{" "}
                <span className="underline underline-offset-2">
                  {genre.parentId?.name}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* ── Sticky Action Bar */}
        <div
          className={cn(
            "sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-10",
            "flex items-center justify-between gap-4 transition-all duration-300",
            "top-[var(--navbar-height,64px)]",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
        >
          {ActionButtons}

          {/* Mini title — fades in on scroll */}
          <div
            className={cn(
              "flex items-center gap-2.5 pointer-events-none select-none transition-all duration-400",
              isScrolled
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-3",
            )}
          >
            <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[220px] hidden sm:block">
              {genre.name}
            </span>
            <div className="size-9 sm:size-10 rounded-xl overflow-hidden shadow-sm border border-border/35 shrink-0 bg-muted flex items-center justify-center">
              {genre.image ? (
                <img
                  src={genre.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <Music4 className="size-4 text-muted-foreground/40" />
              )}
            </div>
          </div>
        </div>

        {/* ── Main content */}
        <div className="space-y-16">
          {/* Sub-genres */}
          {genre.subGenres?.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-3 duration-500">
              <PageSectionHeader
                label={`Phân nhánh của ${genre.name}`}
                icon={
                  <ChevronRight className="size-5 text-muted-foreground/50" />
                }
              />
              <div className="mt-6">
                <SubGenreGrid genres={genre.subGenres} />
              </div>
            </section>
          )}

          {/* Tracks */}
          <section className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
            <div className="flex items-center justify-between mb-5">
              <PageSectionHeader label="Bài hát nổi bật" />
              {!loadingTracks && tracks.length > 0 && (
                <span className="text-xs font-bold text-muted-foreground">
                  {formatCount(tracks.length)} bài
                </span>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm -mx-1 sm:mx-0">
              {loadingTracks ? (
                <TrackListSkeleton count={8} />
              ) : tracks.length > 0 ? (
                <TrackList tracks={tracks} isLoading={false} />
              ) : (
                <EmptyTracks />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Reusable icon action button */
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

/** Genre cover art with glow */
const GenreCover: React.FC<{
  image?: string;
  name: string;
  themeColor: string;
  size: "sm" | "lg";
}> = ({ image, name, themeColor, size }) => {
  const dim =
    size === "lg"
      ? "size-[180px] sm:size-[220px] md:size-[260px]"
      : "size-16 sm:size-20";
  const radius = size === "lg" ? "rounded-2xl" : "rounded-xl";

  return (
    <div className="group relative shrink-0">
      {size === "lg" && (
        <div
          aria-hidden
          className="absolute -inset-3 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
          style={{ backgroundColor: themeColor }}
        />
      )}
      <div
        className={cn(
          "relative overflow-hidden bg-muted border border-border/20",
          "shadow-[0_16px_40px_rgba(0,0,0,0.35)]",
          "transition-transform duration-500 group-hover:scale-[1.02]",
          dim,
          radius,
        )}
      >
        {image ? (
          <ImageWithFallback
            src={image}
            alt={name}
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(themeColor, 0.3)} 0%, ${hexToRgba(themeColor, 0.08)} 100%)`,
            }}
          >
            <Music4
              className={cn(
                "text-muted-foreground/30",
                size === "lg" ? "size-16" : "size-7",
              )}
            />
          </div>
        )}
        {/* Inner ring */}
        <div
          aria-hidden
          className="absolute inset-0 ring-1 ring-inset ring-black/15 pointer-events-none rounded-[inherit]"
        />
      </div>
    </div>
  );
};

/** Track + artist count display */
const GenreStats: React.FC<{
  trackCount?: number;
  artistCount?: number;
  className?: string;
}> = ({ trackCount, artistCount, className }) => (
  <div className={cn("flex items-center flex-wrap gap-x-2 gap-y-1", className)}>
    {(trackCount ?? 0) > 0 && (
      <span className="text-[13px] font-bold text-foreground/80 flex items-center gap-1">
        <ListMusic className="size-3.5 text-muted-foreground/50" />
        {formatCount(trackCount!)} bài hát
      </span>
    )}
    {(artistCount ?? 0) > 0 && (
      <>
        <span className="text-muted-foreground/40 text-xs hidden sm:inline">
          •
        </span>
        <span className="text-[13px] font-medium text-muted-foreground flex items-center gap-1">
          <Mic2 className="size-3.5 opacity-50" />
          {formatCount(artistCount!)} nghệ sĩ
        </span>
      </>
    )}
  </div>
);

/** Section header for page mode */
const PageSectionHeader: React.FC<{
  label: string;
  icon?: React.ReactNode;
}> = ({ label, icon }) => (
  <h2 className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-2 text-foreground uppercase">
    {label}
    {icon}
  </h2>
);

/** Section header for embedded mode */
const EmbeddedSectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-1.5">
    <span className="inline-block w-3 h-0.5 rounded-full bg-primary/50" />
    {label}
  </p>
);

/** Empty tracks state */
const EmptyTracks: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-8 px-4" : "py-14 px-6",
    )}
  >
    <div
      className={cn(
        "rounded-full bg-muted/40 border border-dashed border-muted-foreground/20 flex items-center justify-center mb-3.5",
        compact ? "size-12" : "size-16",
      )}
    >
      <Music4
        className={cn(
          "text-muted-foreground/25",
          compact ? "size-5" : "size-7",
        )}
      />
    </div>
    <p
      className={cn(
        "font-black uppercase tracking-widest text-foreground/70 mb-1.5",
        compact ? "text-xs" : "text-sm",
      )}
    >
      Chưa có bài hát
    </p>
    <p
      className={cn(
        "text-muted-foreground font-medium max-w-xs",
        compact ? "text-xs" : "text-sm",
      )}
    >
      Thể loại này chưa có bài hát nào hoặc đang cập nhật.
    </p>
  </div>
);

/** Inline tracklist skeleton */
const TrackListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="p-3 space-y-1">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-2 rounded-xl"
        style={{ animationDelay: `${i * 60}ms` }}
      >
        <div className="size-9 rounded-lg bg-muted/50 animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-muted/60 rounded-full animate-pulse w-2/3" />
          <div className="h-2.5 bg-muted/35 rounded-full animate-pulse w-1/3" />
        </div>
        <div className="h-3 w-10 bg-muted/40 rounded-full animate-pulse shrink-0" />
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Page-level loading & error states
// ─────────────────────────────────────────────────────────────

const GenreDetailSkeleton: React.FC = () => (
  <div className="min-h-screen bg-background pb-32">
    <div className="h-[58vh] w-full bg-muted/15 animate-pulse relative">
      <div className="absolute bottom-10 w-full px-4 sm:px-8 container mx-auto flex flex-col md:flex-row items-center md:items-end gap-8">
        <div className="size-[180px] sm:size-[220px] md:size-[260px] rounded-2xl shrink-0 bg-muted/50 shadow-xl" />
        <div className="flex-1 w-full space-y-4">
          <div className="h-4 w-24 bg-muted/50 rounded-full" />
          <div className="h-16 sm:h-20 w-full max-w-lg bg-muted/50 rounded-xl" />
          <div className="h-4 w-2/3 max-w-sm bg-muted/35 rounded-full" />
          <div className="h-4 w-36 bg-muted/25 rounded-full" />
        </div>
      </div>
    </div>
    <div className="container mx-auto mt-8 space-y-6 px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="size-16 rounded-full bg-muted/40 animate-pulse" />
        <div className="size-11 rounded-full bg-muted/25 animate-pulse" />
        <div className="size-11 rounded-full bg-muted/25 animate-pulse" />
      </div>
      <div className="h-80 w-full rounded-2xl bg-muted/20 animate-pulse" />
    </div>
  </div>
);

const GenreNotFound: React.FC<{
  onBack: () => void;
  onRetry: () => void;
}> = ({ onBack, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in fade-in zoom-in-95 duration-500">
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-primary/8 blur-[80px] rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-3xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <SearchX className="size-10 text-muted-foreground/50" />
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
        Khám phá thể loại khác
      </button>
    </div>
  </div>
);

export default GenreDetailPage;
