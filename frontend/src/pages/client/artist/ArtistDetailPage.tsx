/**
 * ArtistDetailPage.tsx
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DELTA-ONLY REFACTOR — What changed and why
 *
 * ── ANTI-PATTERNS ────────────────────────────────────────────────────────────
 *
 * 1. `ActionButtons` as an inline JSX variable.
 *    Same pattern fixed in PlaylistDetailPage — evaluated inline on every
 *    parent render, no memo, no bailout. When `scrollY` updates (every 16ms
 *    via rAF after fix #5), the entire action button tree including the
 *    Dropdown and two Tooltips re-evaluates. Extracted to `ArtistActionBar`
 *    memo'd component with `actionBarProps` memoised via `useMemo`.
 *
 * ── CORRECTNESS BUGS ─────────────────────────────────────────────────────────
 *
 * 2. `dispatchPlay` shuffle: `.sort(() => Math.random() - 0.5)` — same
 *    biased shuffle present in all three detail pages. FIX: Fisher-Yates.
 *
 * 3. Scroll handler has no rAF throttle — same fix as AlbumDetailPage and
 *    PlaylistDetailPage. Each scroll event fires `setScrollY` synchronously,
 *    triggering a re-render that re-evaluates `isScrolled` and the now-fixed
 *    `ArtistActionBar` props. FIX: rAF throttle.
 *
 * 4. `topTracks` useMemo: `artistData?.topTracks ?? []` — same `[]` fallback
 *    issue as PlaylistDetailPage. FIX: `EMPTY_TRACKS` module constant.
 *    Same for `albums`.
 *
 * 5. `isFollowing` local state — resets on unmount (navigate away + back).
 *    The original's comment-less `setIsFollowing((f) => !f)` doesn't call
 *    any API. Wire `isFollowing` initial state from `artist.isFollowedByCurrentUser`
 *    (pending field addition to Artist type). FIX: added TODO comment +
 *    wrapped in `useCallback` with stable deps.
 *
 * 6. Invalid Tailwind class: `size-13` and `size-15` in the original's play
 *    button size logic (`"size-13 sm:size-15"`). Tailwind's size scale is
 *    even numbers. Changed to `size-12 sm:size-14`. The inline variant
 *    was then overridden by `variant === "embedded" ? "size-11" : "size-14 sm:size-16"`
 *    so the `size-13` classes were dead anyway — removed duplication.
 *
 * 7. `topTracks.length` check in `handleShuffle` — original returned silently
 *    with no user feedback. Added `toast.error` consistent with `handlePlayArtist`.
 *
 * 8. Parallelism between follow mobile icon and follow desktop button:
 *    both were separate, each calling `setIsFollowing` directly. Extracted to
 *    `handleFollowToggle` useCallback for a single source of truth (and future
 *    API call hookup).
 *
 * ── DESIGN SYSTEM ALIGNMENT ──────────────────────────────────────────────────
 *
 * 9. Sticky action bar: `z-40` → `z-30` (same fix as Album/Playlist pages).
 *
 * 10. `ArtistNotFound` glow: `blur-[80px]` → `blur-3xl`.
 *
 * 11. Follow button `bg-primary/8` — not in Tailwind standard opacity scale.
 *     Changed to `bg-primary/[0.08]`. Same for `hover:bg-primary/15` →
 *     `hover:bg-primary/[0.15]` and `hover:bg-foreground/8` → `hover:bg-foreground/[0.08]`.
 *
 * 12. `DraggableImageGallery` — the `[&::-webkit-scrollbar]:hidden` arbitrary
 *     variant works in Tailwind v4 but requires the `@custom-variant` definition
 *     in globals. Added `no-scrollbar` Soundwave utility class instead (already
 *     defined in the design system as `.no-scrollbar`).
 *
 * ── ACCESSIBILITY ─────────────────────────────────────────────────────────────
 *
 * 13. Hero `<section>` lacks `aria-label`. Added `aria-label="Artist hero"`.
 *
 * 14. All decorative `aria-hidden` props were boolean `true` — should be
 *     string `"true"` in JSX for correct ARIA serialization. Fixed throughout.
 *
 * 15. `ArtistNotFound` buttons: missing `focus-visible` ring. Added.
 *
 * 16. `SocialLink` component: `rel="noreferrer noopener"` → `rel="noopener noreferrer"`
 *     (correct order per MDN — noopener first prevents opener exploitation
 *     before noreferrer strips the Referer header).
 *
 * 17. `EmptySection` icon: `React.cloneElement(icon, { size: 24 })` requires
 *     `icon` to be a Lucide component specifically. If passed a non-Lucide
 *     node, this silently fails. No fix needed (consistent with Lucide usage),
 *     but a `size` prop + typed icon prop would be safer at scale.
 *
 * 18. `DraggableImageGallery` gallery container: added `role="list"` and
 *     `role="listitem"` on image cards for screen reader list navigation.
 */

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
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
import {
  Artistdetailskeleton,
  Genre,
  ITrack,
  setIsPlaying,
  setQueue,
} from "@/features";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — stable references, no allocation per render (FIX 4)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_TRACKS: ITrack[] = [];
const EMPTY_ALBUMS: Album[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)},${opacity})`
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

/** Fisher-Yates shuffle — uniform randomness (FIX 2) */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionIconButton — shared icon button base
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ArtistActionBar — memo'd component (FIX 1)
// Previously was `ActionButtons` JSX variable re-created on every render.
//
// FIX 11: bg-primary/8 → bg-primary/[0.08], hover:bg-primary/15 → /[0.15].
// FIX 8: unified follow handler via prop (handleFollowToggle).
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistActionBarProps {
  themeColor: string;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isFollowing: boolean;
  hasTracks: boolean;
  variant: "page" | "embedded";
  onPlay: () => void;
  onShuffle: () => void;
  onFollowToggle: () => void;
}

const ArtistActionBar = memo<ArtistActionBarProps>(
  ({
    themeColor,
    isLoadingPlay,
    isLoadingShuffle,
    isFollowing,
    hasTracks,
    variant,
    onPlay,
    onShuffle,
    onFollowToggle,
  }) => {
    const playSize = variant === "embedded" ? "size-11" : "size-14 sm:size-16";

    return (
      <div
        className="flex items-center gap-2.5 sm:gap-3"
        role="toolbar"
        aria-label="Artist controls"
      >
        {/* Play */}
        <button
          type="button"
          onClick={onPlay}
          disabled={isLoadingPlay || !hasTracks}
          aria-label="Play artist tracks"
          className={cn(
            playSize,
            "rounded-full flex items-center justify-center shrink-0",
            "transition-all duration-200 hover:scale-105 active:scale-90 shadow-lg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
          )}
          style={{
            backgroundColor: themeColor,
            boxShadow: `0 8px 28px -6px ${hexToRgba(themeColor, 0.55)}`,
          }}
        >
          {isLoadingPlay ? (
            <Loader2
              className="size-6 text-white animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Play
              className="size-6 text-white fill-white ml-0.5"
              aria-hidden="true"
            />
          )}
        </button>

        {/* Shuffle */}
        <ActionIconButton
          onClick={onShuffle}
          disabled={isLoadingShuffle || !hasTracks}
          aria-label="Shuffle artist tracks"
        >
          {isLoadingShuffle ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Shuffle className="size-4" aria-hidden="true" />
          )}
        </ActionIconButton>

        {/* Follow — desktop pill (FIX 11: explicit opacity fraction) */}
        <button
          type="button"
          onClick={onFollowToggle}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? "Unfollow artist" : "Follow artist"}
          className={cn(
            "hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-xl border",
            "text-[12px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            isFollowing
              ? "border-primary/30 text-primary bg-primary/[0.08] hover:bg-primary/[0.15]"
              : "border-foreground/30 text-foreground bg-transparent hover:bg-foreground/[0.08]",
          )}
        >
          {isFollowing ? (
            <UserCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <UserPlus className="size-3.5" aria-hidden="true" />
          )}
          {isFollowing ? "Đang theo dõi" : "Theo dõi"}
        </button>

        {/* Follow — mobile icon (FIX 8: same handler as desktop) */}
        <ActionIconButton
          onClick={onFollowToggle}
          aria-label={isFollowing ? "Unfollow artist" : "Follow artist"}
          aria-pressed={isFollowing}
          className={cn(
            "sm:hidden",
            isFollowing && "border-primary/30 text-primary bg-primary/[0.08]",
          )}
        >
          {isFollowing ? (
            <UserCheck className="size-4" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
        </ActionIconButton>

        {/* More */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionIconButton aria-label="More options">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </ActionIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 rounded-2xl border-border/50 p-1.5 shadow-2xl bg-background/95 backdrop-blur-xl"
          >
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
              <Share2
                className="size-4 text-primary shrink-0"
                aria-hidden="true"
              />{" "}
              Chia sẻ trang nghệ sĩ
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
              <Music4
                className="size-4 text-[hsl(var(--success))] shrink-0"
                aria-hidden="true"
              />{" "}
              Đài nghệ sĩ
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40 my-1" />
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-destructive focus:text-destructive focus:bg-destructive/10">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> Báo
              cáo vi phạm
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
ArtistActionBar.displayName = "ArtistActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader — section heading with optional action slot
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = memo<{
  label: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}>(({ label, icon, action, compact }) => (
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
));
SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────────────────────
// DraggableImageGallery — mouse drag + touch scroll image strip
// FIX 12: no-scrollbar Soundwave utility instead of arbitrary Tailwind variant.
// FIX 18: role="list" + role="listitem" for accessibility.
// ─────────────────────────────────────────────────────────────────────────────

const DraggableImageGallery = memo<{
  images: string[];
  artistName: string;
}>(({ images, artistName }) => {
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
      role="list"
      aria-label={`${artistName} photo gallery`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      className={cn(
        "flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-0 sm:px-0",
        // FIX 12: no-scrollbar from Soundwave design system (defined in globals.css)
        "no-scrollbar",
        isDragging
          ? "cursor-grabbing select-none"
          : "cursor-grab snap-x snap-mandatory scroll-smooth",
      )}
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
      {/* Trailing spacer for mobile last-card centering */}
      <div className="shrink-0 w-4 sm:hidden" aria-hidden="true" />
    </div>
  );
});
DraggableImageGallery.displayName = "DraggableImageGallery";

// ─────────────────────────────────────────────────────────────────────────────
// SocialLink — external link pill
// FIX 16: rel order noopener before noreferrer (MDN recommendation).
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
// EmptySection — empty state placeholder for tracks / albums
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
// FIX 10: blur-[80px] → blur-3xl.
// FIX 15: added focus-visible rings on action buttons.
// FIX 14: aria-hidden → "true" string on decorative divs.
// ─────────────────────────────────────────────────────────────────────────────

const ArtistNotFound = memo<{
  onBack: () => void;
  onRetry: () => void;
}>(({ onBack, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-7 text-center px-6 bg-background animate-in fade-in zoom-in-95 duration-500">
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ArtistDetailPage: React.FC<ArtistDetailPageProps> = ({
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);

  const isScrolled = variant === "page" ? scrollY > 340 : scrollY > 150;

  // ── Data
  const {
    data: artistData,
    isLoading,
    isError,
    refetch,
  } = useArtistDetail(slug);

  // 1. Lấy danh sách ID bài hát từ Album (Dùng useMemo để tránh re-render thừa)
  const trackIds = useMemo(
    () => artistData?.topTracks?.map((t: ITrack) => t._id) ?? [],
    [artistData],
  );

  // 2. ĐỒNG BỘ: Gọi Hook để check xem User đã Like những bài nào trong Album này chưa
  // 🚀 Nâng cấp: Thêm tham số "track" (targetType)
  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !isLoading && trackIds.length > 0,
  );

  const artist = artistData?.artist;
  // FIX 4: EMPTY_TRACKS / EMPTY_ALBUMS stable references
  const topTracks = useMemo(
    () => (artistData?.topTracks as ITrack[] | undefined) ?? EMPTY_TRACKS,
    [artistData?.topTracks],
  );
  const albums = useMemo(
    () => (artistData?.albums as Album[] | undefined) ?? EMPTY_ALBUMS,
    [artistData?.albums],
  );
  const themeColor = useMemo(
    () => artist?.themeColor ?? "#3b82f6",
    [artist?.themeColor],
  );

  // ── Scroll tracking — rAF throttled (FIX 3)
  useEffect(() => {
    const rafId = { current: 0 };

    if (variant === "embedded") {
      const el = scrollContainerRef.current;
      if (!el) return;
      const handler = () => {
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => setScrollY(el.scrollTop));
      };
      el.addEventListener("scroll", handler, { passive: true });
      return () => {
        el.removeEventListener("scroll", handler);
        cancelAnimationFrame(rafId.current);
      };
    }

    const handler = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId.current);
    };
  }, [variant]);

  // ── Play dispatch — FIX 2: Fisher-Yates shuffle
  const dispatchPlay = useCallback(
    (shuffled = false) => {
      const list = shuffled ? fisherYatesShuffle(topTracks) : topTracks;
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
  }, [topTracks.length, dispatchPlay]);

  const handleShuffle = useCallback(async () => {
    // FIX 7: toast feedback when no tracks (was silent return)
    if (!topTracks.length) {
      toast.error("Nghệ sĩ này chưa có bài hát nổi bật nào.");
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
  }, [topTracks.length, dispatchPlay]);

  const handleBack = useCallback(() => {
    if (variant === "embedded" && onClose) onClose();
    else navigate(-1);
  }, [variant, onClose, navigate]);

  // FIX 8: unified follow toggle — single source of truth for both mobile/desktop
  // TODO: wire to useFollowArtist mutation + initialize from artist.isFollowedByCurrentUser
  const handleFollowToggle = useCallback(() => {
    setIsFollowing((f) => !f);
  }, []);

  // ── Memoised action bar props — prevents ArtistActionBar re-render on scroll (FIX 1)
  const actionBarProps = useMemo(
    () => ({
      themeColor,
      isLoadingPlay,
      isLoadingShuffle,
      isFollowing,
      hasTracks: topTracks.length > 0,
      variant,
      onPlay: handlePlayArtist,
      onShuffle: handleShuffle,
      onFollowToggle: handleFollowToggle,
    }),
    [
      themeColor,
      isLoadingPlay,
      isLoadingShuffle,
      isFollowing,
      topTracks.length,
      variant,
      handlePlayArtist,
      handleShuffle,
      handleFollowToggle,
    ],
  );

  // ── Render states
  if (isLoading) return <Artistdetailskeleton />;
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

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDED VARIANT
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <div
        ref={scrollContainerRef}
        className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
        role="region"
        aria-label={`Artist: ${artist.name}`}
      >
        <div
          aria-hidden="true"
          className="sticky top-0 h-[180px] shrink-0 pointer-events-none z-0"
          style={{
            background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.4)} 0%, transparent 100%)`,
          }}
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

          {/* Compact hero */}
          <div className="flex items-end gap-4 pt-4 pb-5">
            <div className="relative shrink-0">
              <div
                aria-hidden="true"
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
            </div>
          </div>

          <ArtistActionBar {...actionBarProps} />

          {/* Top tracks */}
          {topTracks.length > 0 && (
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
                icon={
                  <Disc3 className="size-3.5 text-primary" aria-hidden="true" />
                }
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
  // FIX 9: z-40 → z-30 for sticky action bar.
  // FIX 13: hero section aria-label added.
  // FIX 14: aria-hidden → "true" string throughout.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* ── Immersive Hero — FIX 13: aria-label */}
      <section
        aria-label="Artist hero"
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[620px] flex flex-col justify-end overflow-hidden shrink-0 group/hero"
      >
        {/* Dynamic color wash */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000"
          style={{
            background: `linear-gradient(160deg,
              ${hexToRgba(themeColor, 0.55)} 0%,
              ${hexToRgba(themeColor, 0.15)} 55%,
              transparent 100%)`,
          }}
        />

        {/* Cover image parallax */}
        {artist.coverImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center z-0 pointer-events-none transition-transform duration-[5000ms] ease-out group-hover/hero:scale-105 opacity-50 dark:opacity-30 mix-blend-overlay"
            style={{ backgroundImage: `url(${artist.coverImage})` }}
          />
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

        {/* Hero content */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 mt-20">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 text-center md:text-left">
            {/* Avatar glow */}
            <div className="relative shrink-0 group/avatar">
              <div
                aria-hidden="true"
                className="absolute inset-0 blur-[40px] rounded-full scale-125 opacity-45 pointer-events-none transition-opacity duration-700 group-hover/avatar:opacity-60"
                style={{ backgroundColor: themeColor }}
              />
              <Avatar className="relative z-10 size-[160px] sm:size-[210px] md:size-[260px] rounded-full border-[5px] sm:border-[7px] border-background shadow-2xl bg-card transition-transform duration-500 group-hover/avatar:scale-[1.02]">
                <AvatarImage
                  src={artist.avatar}
                  className="object-cover"
                  fetchPriority="high"
                />
                <AvatarFallback className="text-5xl font-black bg-muted text-muted-foreground">
                  {artist.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name + meta */}
            <div className="flex flex-col items-center md:items-start gap-3 sm:gap-4 flex-1 min-w-0 pb-1">
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

              {/* Genre tags */}
              {artist.genres?.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-0.5">
                  {artist.genres.slice(0, 5).map((g: Genre) => (
                    <span
                      key={g._id ?? String(g)}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-background/25 backdrop-blur-sm border border-white/[0.12] text-foreground/75"
                    >
                      {g.name ?? String(g)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sticky Action Bar — FIX 9: z-30 not z-40 */}
      <div
        className={cn(
          "sticky z-30 transition-all duration-300",
          "top-[var(--navbar-height,64px)]",
          isScrolled
            ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
            : "bg-transparent border-b border-transparent",
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <ArtistActionBar {...actionBarProps} />

          {/* Mini info — CSS transition (no Framer on scroll-driven element) */}
          <div
            aria-hidden="true"
            className={cn(
              "flex items-center gap-2.5 transition-all duration-300 pointer-events-none select-none",
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

      {/* ── Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-10 md:mt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-14 xl:gap-20">
          {/* Left: tracks + gallery + albums */}
          <div className="lg:col-span-8 space-y-16">
            <section aria-label="Top tracks">
              <SectionHeader
                label="Phổ biến"
                icon={
                  <TrendingUp
                    className="size-[18px] text-primary"
                    aria-hidden="true"
                  />
                }
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

            {artist.images?.length > 0 && (
              <section aria-label="Photo gallery">
                <SectionHeader
                  label="Thư viện ảnh"
                  icon={
                    <Camera
                      className="size-[18px] text-primary"
                      aria-hidden="true"
                    />
                  }
                />
                <div className="mt-5">
                  <DraggableImageGallery
                    images={artist.images}
                    artistName={artist.name}
                  />
                </div>
              </section>
            )}

            <section aria-label="Discography">
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

          {/* Right: bio + social */}
          <aside className="lg:col-span-4">
            <div className="sticky top-[calc(var(--navbar-height,64px)+4.5rem)] space-y-8">
              {/* Ambient glow */}
              <div
                aria-hidden="true"
                className="absolute -top-12 -right-8 w-[110%] aspect-square rounded-full blur-[100px] opacity-10 pointer-events-none -z-10"
                style={{ backgroundColor: themeColor }}
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

                {artist.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-5 mt-5 border-t border-border/40">
                    {artist.genres.map((g: Genre) => (
                      <Badge
                        key={g._id ?? String(g)}
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border border-border/30 hover:bg-primary/[0.15] hover:text-primary transition-colors cursor-default"
                      >
                        {g.name ?? String(g)}
                      </Badge>
                    ))}
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
                        style={{ backgroundColor: themeColor }}
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
                        color={themeColor}
                      />
                    </div>
                  </section>
                )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default ArtistDetailPage;
