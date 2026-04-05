/**
 * PlaylistDetailPage.tsx
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DELTA-ONLY REFACTOR — What changed and why
 *
 * The original was well-structured. These are the specific production issues:
 *
 * ── ANTI-PATTERNS ────────────────────────────────────────────────────────────
 *
 * 1. `CoverImage` as an inline function that returns JSX.
 *    Called as `{CoverImage("sm")}` and `{CoverImage("lg")}` — NOT as a React
 *    component. React cannot optimize this: no memo, no identity, no bail-out.
 *    Every parent render creates a new element tree for the cover. Worse: since
 *    it closes over `playlist`, `themeColor`, `isOwner`, `setIsEditMetaOpen`
 *    from the parent scope, it is an implicit dependency on ALL of those.
 *    FIX: Extracted to a proper `memo()`'d component `PlaylistCover`.
 *
 * 2. `ActionButtons` as a JSX variable (not a component).
 *    Same anti-pattern. `const ActionButtons = (<div>...</div>)` is evaluated
 *    inline on every render — it's equivalent to calling a render function with
 *    no memoization. When `isLoadingPlay` changes, the ENTIRE action buttons
 *    tree re-evaluates even though only the play button icon changes.
 *    FIX: Extracted to `PlaylistActionBar` memo'd component.
 *
 * 3. `VisibilityBadge` as a JSX variable.
 *    Same pattern — moved to `VisibilityBadge` memo'd component.
 *
 * ── CORRECTNESS BUGS ─────────────────────────────────────────────────────────
 *
 * 4. `dispatchPlay` shuffle uses `.sort(() => Math.random() - 0.5)` — same
 *    biased shuffle as AlbumDetailPage. FIX: Fisher-Yates.
 *
 * 5. Scroll handler `useEffect` has no `requestAnimationFrame` throttle.
 *    Original: fires `setScrollY` on every scroll event (potentially
 *    60+ times per frame on trackpad). Each call triggers a re-render which
 *    re-evaluates `isScrolled`, `ActionButtons` (inline variable), and the
 *    sticky bar. FIX: rAF throttle (same pattern as AlbumDetailPage).
 *
 * 6. `handleSubmitForm` closes `isManageTracksOpen` setter but was called
 *    from `PlaylistModals` which doesn't need to know about `setIsManageTracksOpen`.
 *    After the form submits, the modal should close via `onCloseManageTracks`.
 *    The original called `setIsManageTracksOpen(false)` inside `handleSubmitForm`
 *    — creating a hidden cross-concern coupling. FIX: `handleSubmitForm` only
 *    handles the mutation; the `onCloseEditMeta`/`onCloseManageTracks` callbacks
 *    on the modal components handle their own close lifecycle.
 *
 * 7. `console.error("Failed to save playlist", error)` in `handleSubmitForm`.
 *    Debug log removed. The original comment said "Giữ modal mở để user sửa lỗi"
 *    (keep modal open for user to fix error) — correct behavior, but logging
 *    raw errors to console in production is a security risk (stack traces can
 *    reveal internal paths). The try/catch already keeps the modal open by not
 *    throwing. Error is surfaced to the user via the mutation hook's error state.
 *
 * 8. `handleConfirmDelete` + `onConfirmDelete` callback:
 *    - Embedded variant: `onConfirmDelete: () => handleConfirmDelete()`
 *    - Page variant: `onConfirmDelete: () => { setIsDeleteOpen(false); navigate("/playlists") }`
 *    The page variant closed the modal AND navigated. The embedded variant
 *    called `handleConfirmDelete()` but didn't close the modal or navigate.
 *    FIX: Unified `handleConfirmDelete` callback handles close + navigation
 *    consistently for both variants.
 *
 * ── PERFORMANCE ──────────────────────────────────────────────────────────────
 *
 * 9. `tracks` useMemo: `playlist?.tracks ?? []` — the `[]` fallback creates
 *    a new array reference on every render when `playlist` is undefined.
 *    `useMemo` still recalculates when `playlist` changes identity (which
 *    react-query does on refetch). This is acceptable. But the fallback `[]`
 *    being inline means two renders with `playlist = undefined` still produce
 *    different `tracks` references. FIX: module-scope `EMPTY_TRACKS` constant.
 *
 * 10. `totalDurationSec` useMemo depends on `[tracks]`. Since `tracks` is
 *     itself memoised, this is correct. No change needed.
 *
 * 11. `isOwner` useMemo: `[playlist, user]` — correct deps. No change.
 *
 * 12. `sharedActionBarProps` analog: the `ActionButtons` JSX variable
 *     was re-created inline. Now that `PlaylistActionBar` is a memo'd component,
 *     its props need a `useMemo` to prevent reference churn (same fix as
 *     AlbumDetailPage's `sharedActionBarProps`).
 *
 * ── DESIGN SYSTEM ALIGNMENT ──────────────────────────────────────────────────
 *
 * 13. Sticky bar: `z-40` → `z-30` (same fix as AlbumDetailPage — stays below
 *     navbar dropdowns which are z-30 in Soundwave's z-index system).
 *
 * 14. `EmptyPlaylistState` glow: `blur-[60px]` → `blur-2xl` (Tailwind standard).
 *
 * 15. `PlaylistNotFound` glow: `blur-[80px]` → `blur-3xl`.
 *
 * 16. Save/Heart button: `text-emerald-500` → `text-[hsl(var(--success))]`.
 *     Same token alignment fix as AlbumDetailPage.
 *
 * ── ACCESSIBILITY ─────────────────────────────────────────────────────────────
 *
 * 17. `<header>` in page variant: should be `<section aria-label="Playlist details">`.
 *     `<header>` inside the main content creates a page header landmark,
 *     but this is album/playlist metadata — better as a labeled section.
 *
 * 18. `<div role="main">` analog — page variant used `<div className="relative min-h-screen">`.
 *     Wrapped in `<main>` semantic element.
 *
 * 19. H1 click target: `onClick={() => isOwner && setIsEditMetaOpen(true)}` on
 *     an `<h1>` with no role/tabIndex is not keyboard-accessible. FIX: wrapped
 *     in a proper `<button>` when `isOwner` is true.
 *
 * 20. `ActionIconButton` missing `aria-hidden` on icon children. FIX: all icons
 *     inside buttons get `aria-hidden="true"`.
 */

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
  Heart,
  MoreHorizontal,
  Lock,
  Globe,
  PenSquare,
  ListMusic,
  Trash2,
  PlusCircle,
  Share2,
  Music2,
  SearchX,
  Loader2,
  ChevronLeft,
  Shuffle,
  Clock,
  RefreshCw,
  Users,
  Sparkles,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import {
  ITrack,
  Playlist,
  setIsPlaying,
  setQueue,
  usePlaylistMutations,
  useSyncInteractions,
  usePlaylistDetail,
  TrackList,
  EditPlaylistTracksModal,
  PlaylistModal,
  PlaylistDetailSkeleton,
} from "@/features";

dayjs.extend(relativeTime);

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — module scope
// ─────────────────────────────────────────────────────────────────────────────

// FIX 9: stable empty array reference — prevents new reference on every render
const EMPTY_TRACKS: ITrack[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)},${opacity})`
    : `rgba(139,92,246,${opacity})`;
};

const playlistTitleSizeClass = (title: string): string => {
  const len = title.length;
  if (len > 38) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 20) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  return "text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] xl:text-[7rem]";
};

const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
};

/** Fisher-Yates shuffle — uniform randomness (FIX 4) */
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

interface PlaylistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionIconButton — forwardRef, accessible
// FIX 20: aria-hidden on icons should be applied at callsite, not here.
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
// TooltipAction — owner action with accessible tooltip
// ─────────────────────────────────────────────────────────────────────────────

const TooltipAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <TooltipProvider>
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <ActionIconButton onClick={onClick} aria-label={label}>
          {icon}
        </ActionIconButton>
      </TooltipTrigger>
      <TooltipContent className="font-bold text-[10px] uppercase tracking-widest bg-foreground text-background border-none shadow-xl px-3 py-1.5 rounded-full">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ─────────────────────────────────────────────────────────────────────────────
// VisibilityBadge — memo'd (FIX 3)
// ─────────────────────────────────────────────────────────────────────────────

const VisibilityBadge = memo<{ visibility?: string }>(({ visibility }) => {
  if (visibility === "private") {
    return (
      <Badge
        variant="destructive"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 shrink-0"
      >
        <Lock className="size-2.5" aria-hidden="true" /> Riêng tư
      </Badge>
    );
  }
  if (visibility === "public") {
    return (
      <Badge
        variant="outline"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 border-border/40 shrink-0"
      >
        <Globe className="size-2.5" aria-hidden="true" /> Công khai
      </Badge>
    );
  }
  return null;
});
VisibilityBadge.displayName = "VisibilityBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistMeta — track count, duration, created date
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistMeta = memo<{
  trackCount: number;
  durationSec: number;
  createdAt?: string;
  className?: string;
  compact?: boolean;
}>(({ trackCount, durationSec, createdAt, className, compact }) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-muted-foreground",
      compact ? "text-[11px]" : "text-[13px]",
      className,
    )}
  >
    <span className="font-bold text-foreground/80">{trackCount} bài hát</span>
    {durationSec > 0 && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>{formatDuration(durationSec)}</span>
      </>
    )}
    {createdAt && !compact && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>{dayjs(createdAt).fromNow()}</span>
      </>
    )}
  </div>
));
PlaylistMeta.displayName = "PlaylistMeta";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistCover — memo'd proper component (FIX 1)
// Previously was `CoverImage` inline function called as `{CoverImage("sm")}`.
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistCoverProps {
  playlist: Playlist;
  themeColor: string;
  isOwner: boolean;
  size: "sm" | "lg";
  onEditCover: () => void;
}

const PlaylistCover = memo<PlaylistCoverProps>(
  ({ playlist, themeColor, isOwner, size, onEditCover }) => {
    const isLg = size === "lg";
    const dim = isLg
      ? "size-[200px] sm:size-[240px] md:size-[290px]"
      : "size-[68px] sm:size-20";
    const radius = isLg ? "rounded-2xl" : "rounded-xl";

    return (
      <div
        className={cn(
          "relative overflow-hidden border border-border/15 bg-muted",
          "shadow-[0_16px_40px_rgba(0,0,0,0.38)] transition-transform duration-500",
          isLg && "group-hover:scale-[1.02]",
          dim,
          radius,
        )}
      >
        {playlist.coverImage ? (
          <img
            src={playlist.coverImage}
            alt={playlist.title}
            className={cn(
              "size-full object-cover transition-transform duration-700",
              isLg && "group-hover:scale-105",
            )}
            loading={isLg ? "eager" : "lazy"}
            fetchPriority={isLg ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(themeColor, 0.3)} 0%, ${hexToRgba(themeColor, 0.08)} 100%)`,
            }}
          >
            <ListMusic
              className={cn(
                "text-muted-foreground/25",
                isLg ? "size-14" : "size-6",
              )}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Inner vignette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-tr from-black/15 to-transparent pointer-events-none ring-1 ring-inset ring-black/10 rounded-[inherit]"
        />

        {/* Owner edit overlay (lg only) */}
        {isLg && isOwner && (
          <button
            type="button"
            onClick={onEditCover}
            aria-label="Edit cover image"
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2",
              "bg-black/55 backdrop-blur-sm opacity-0 group-hover:opacity-100",
              "transition-opacity duration-250 cursor-pointer",
              "focus-visible:opacity-100 focus-visible:outline-none",
            )}
          >
            <PenSquare className="size-7 text-white" aria-hidden="true" />
            <span className="text-white text-[9px] font-black uppercase tracking-widest">
              Chỉnh sửa
            </span>
          </button>
        )}
      </div>
    );
  },
);
PlaylistCover.displayName = "PlaylistCover";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistActionBar — memo'd proper component (FIX 2)
// Previously was `ActionButtons` JSX variable re-created on every parent render.
//
// FIX 16: save button color tokens use --success instead of emerald-500.
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistActionBarProps {
  themeColor: string;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isSaved: boolean;
  hasTracks: boolean;
  isOwner: boolean;
  variant: "page" | "embedded";
  onPlay: () => void;
  onShuffle: () => void;
  onSave: () => void;
  onManageTracks: () => void;
  onEditMeta: () => void;
  onDelete: () => void;
  navigateToPlaylist?: () => void;
}

const PlaylistActionBar = memo<PlaylistActionBarProps>(
  ({
    themeColor,
    isLoadingPlay,
    isLoadingShuffle,
    isSaved,
    hasTracks,
    isOwner,
    variant,
    onPlay,
    onShuffle,
    onSave,
    onManageTracks,
    onEditMeta,
    onDelete,
  }) => {
    const playSize = variant === "embedded" ? "size-11" : "size-14 sm:size-16";

    return (
      <div
        className="flex items-center gap-2.5 sm:gap-3"
        role="toolbar"
        aria-label="Playlist controls"
      >
        {/* Play */}
        <button
          type="button"
          onClick={onPlay}
          disabled={isLoadingPlay || !hasTracks}
          aria-label="Play playlist"
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
          aria-label="Shuffle playlist"
        >
          {isLoadingShuffle ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Shuffle className="size-4" aria-hidden="true" />
          )}
        </ActionIconButton>

        {/* Save / Heart — FIX 16: --success token */}
        <ActionIconButton
          onClick={onSave}
          aria-label={isSaved ? "Remove from library" : "Save to library"}
          aria-pressed={isSaved}
          className={cn(
            isSaved &&
              "border-[hsl(var(--success)/0.25)] text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] hover:bg-[hsl(var(--success)/0.15)]",
          )}
        >
          <Heart
            className={cn(
              "size-4 transition-all duration-300",
              isSaved && "fill-[hsl(var(--success))] scale-110",
            )}
            aria-hidden="true"
          />
        </ActionIconButton>

        {/* Owner tools */}
        {isOwner && (
          <>
            <TooltipAction
              label="Add tracks"
              icon={<ListMusic className="size-4" aria-hidden="true" />}
              onClick={onManageTracks}
            />
            <TooltipAction
              label="Edit info"
              icon={<PenSquare className="size-4" aria-hidden="true" />}
              onClick={onEditMeta}
            />
          </>
        )}

        {/* More / overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionIconButton aria-label="More options">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </ActionIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 rounded-2xl p-1.5 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl"
          >
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm">
              <PlusCircle className="size-4 shrink-0" aria-hidden="true" /> Thêm
              vào danh sách khác
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-semibold text-sm text-primary focus:text-primary focus:bg-primary/10">
              <Share2 className="size-4 shrink-0" aria-hidden="true" /> Chia sẻ
              Playlist
            </DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuSeparator className="bg-border/40 my-1" />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer font-bold text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" /> Xóa
                  Playlist
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
PlaylistActionBar.displayName = "PlaylistActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// EmptyPlaylistState
// FIX 14: blur-[60px] → blur-2xl (Tailwind standard scale).
// ─────────────────────────────────────────────────────────────────────────────

const EmptyPlaylistState = memo<{
  isOwner: boolean;
  onAdd: () => void;
  compact?: boolean;
}>(({ isOwner, onAdd, compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4 gap-4" : "py-20 px-6 gap-6",
    )}
    role="status"
    aria-label="Empty playlist"
  >
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-primary/15 blur-2xl rounded-full scale-150 pointer-events-none"
      />
      <div
        className={cn(
          "relative rounded-full bg-card border-2 border-dashed border-border/50 flex items-center justify-center shadow-sm",
          compact ? "size-16" : "size-28",
        )}
      >
        <Music2
          className={cn(
            "text-muted-foreground/30",
            compact ? "size-6" : "size-11",
          )}
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="space-y-1.5 max-w-xs">
      <h3
        className={cn(
          "font-black tracking-tight text-foreground",
          compact ? "text-base" : "text-xl",
        )}
      >
        Ở đây hơi vắng lặng
      </h3>
      <p
        className={cn(
          "text-muted-foreground font-medium leading-relaxed",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {isOwner
          ? "Thêm bài hát để xây dựng bộ sưu tập giai điệu riêng của bạn."
          : "Danh sách phát này chưa có bài hát nào."}
      </p>
    </div>
    {isOwner && (
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest",
          "bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-md",
          compact ? "h-9 px-5 text-[10px]" : "h-11 px-8 text-[11px] mt-1",
        )}
      >
        <PlusCircle className="size-4" aria-hidden="true" />
        Tìm bài hát
      </button>
    )}
  </div>
));
EmptyPlaylistState.displayName = "EmptyPlaylistState";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistNotFound
// FIX 15: blur-[80px] → blur-3xl.
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistNotFound = memo<{
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
        <SearchX
          className="size-10 text-muted-foreground/50"
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="space-y-2 max-w-sm">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground uppercase">
        Không tìm thấy Playlist
      </h2>
      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
        Danh sách phát đã bị xóa, đặt về riêng tư, hoặc đường dẫn không hợp lệ.
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
        Quay lại thư viện
      </button>
    </div>
  </div>
));
PlaylistNotFound.displayName = "PlaylistNotFound";

// ─────────────────────────────────────────────────────────────────────────────
// PlaylistModals — centralized, no duplication between page/embedded
// FIX 6: `handleSubmitForm` no longer directly calls `setIsManageTracksOpen(false)`.
//        Modal lifecycle is owned by the parent via `onCloseEditMeta` / `onCloseManageTracks`.
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistModals = memo<{
  playlist: Playlist;
  isEditMetaOpen: boolean;
  isManageTracksOpen: boolean;
  isDeleteOpen: boolean;
  isMutating: boolean;
  handleSubmitForm: (data: FormData) => Promise<void>;
  onCloseEditMeta: () => void;
  onCloseManageTracks: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}>(
  ({
    playlist,
    isEditMetaOpen,
    isManageTracksOpen,
    isDeleteOpen,
    isMutating,
    handleSubmitForm,
    onCloseEditMeta,
    onCloseManageTracks,
    onCloseDelete,
    onConfirmDelete,
  }) => (
    <>
      <PlaylistModal
        isOpen={isEditMetaOpen}
        onClose={onCloseEditMeta}
        playlistToEdit={playlist}
        onSubmit={handleSubmitForm}
        isPending={isMutating}
      />
      <EditPlaylistTracksModal
        isOpen={isManageTracksOpen}
        onClose={onCloseManageTracks}
        playlistId={playlist?._id}
      />
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onCancel={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Xóa danh sách phát?"
        description={`Hành động này không thể hoàn tác. "${playlist?.title}" sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa vĩnh viễn"
        isDestructive
      />
    </>
  ),
);
PlaylistModals.displayName = "PlaylistModals";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistDetailPage: React.FC<PlaylistDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride ?? paramSlug ?? "";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── UI state
  const [scrollY, setScrollY] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [isManageTracksOpen, setIsManageTracksOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isScrolled = variant === "page" ? scrollY > 285 : scrollY > 140;

  // ── Data
  const {
    data: playlist,
    isLoading,
    isError,
    refetch,
  } = usePlaylistDetail(slug);

  // 1. Lấy danh sách ID bài hát từ Album (Dùng useMemo để tránh re-render thừa)
  const trackIds = useMemo(
    () => playlist?.tracks?.map((t: ITrack) => t._id) ?? [],
    [playlist],
  );

  // 2. ĐỒNG BỘ: Gọi Hook để check xem User đã Like những bài nào trong Album này chưa
  // 🚀 Nâng cấp: Thêm tham số "track" (targetType)
  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !isLoading && trackIds.length > 0,
  );
  // FIX 9: EMPTY_TRACKS stable reference prevents new array on each render
  const tracks = useMemo(
    () => (playlist?.tracks as ITrack[] | undefined) ?? EMPTY_TRACKS,
    [playlist?.tracks],
  );

  const themeColor = useMemo(
    () => playlist?.themeColor ?? "#8b5cf6",
    [playlist?.themeColor],
  );

  const { updatePlaylistAsync, deletePlaylist, isMutating } =
    usePlaylistMutations();

  const isOwner = useMemo(
    () => playlist?.user?._id === user?._id || user?.role === "admin",
    [playlist?.user?._id, user?._id, user?.role],
  );

  const totalDurationSec = useMemo(
    () => tracks.reduce((acc: number, t: ITrack) => acc + (t.duration ?? 0), 0),
    [tracks],
  );

  // ── Scroll tracking — rAF throttled (FIX 5)
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

  // ── Play dispatch — FIX 4: Fisher-Yates shuffle
  const dispatchPlay = useCallback(
    (shuffled = false) => {
      const list = shuffled ? fisherYatesShuffle(tracks) : tracks;
      dispatch(setQueue({ tracks: list, startIndex: 0 }));
      dispatch(setIsPlaying(true));
    },
    [tracks, dispatch],
  );

  const handlePlayPlaylist = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Danh sách phát này chưa có bài hát nào.");
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
  }, [tracks.length, dispatchPlay]);

  const handleShuffle = useCallback(async () => {
    if (!tracks.length) {
      toast.error("Danh sách phát này chưa có bài hát nào.");
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
  }, [tracks.length, dispatchPlay]);

  const handleBack = useCallback(() => {
    if (variant === "embedded" && onClose) onClose();
    else navigate(-1);
  }, [variant, onClose, navigate]);

  // FIX 6: mutation handler no longer manages modal close state
  const handleSubmitForm = useCallback(
    async (formData: FormData) => {
      if (!playlist) return;
      try {
        await updatePlaylistAsync(playlist._id, formData);
        setIsEditMetaOpen(false);
        // Note: EditPlaylistTracksModal manages its own close via onCloseManageTracks
      } catch {
        // Keep modal open for user to fix — no console.error in production (FIX 7)
      }
    },
    [playlist, updatePlaylistAsync],
  );

  // FIX 8: unified delete handler — consistent for both page and embedded variants
  const handleConfirmDelete = useCallback(() => {
    if (!playlist) return;
    deletePlaylist(playlist._id);
    setIsDeleteOpen(false);
    if (variant === "embedded" && onClose) onClose();
    else navigate("/playlists");
  }, [playlist, deletePlaylist, variant, onClose, navigate]);

  const handleSave = useCallback(() => setIsSaved((s) => !s), []);

  // FIX 12: memoised action bar props — prevents PlaylistActionBar re-render on scroll
  const actionBarProps = useMemo(
    () => ({
      themeColor,
      isLoadingPlay,
      isLoadingShuffle,
      isSaved,
      hasTracks: tracks.length > 0,
      isOwner,
      variant,
      onPlay: handlePlayPlaylist,
      onShuffle: handleShuffle,
      onSave: handleSave,
      onManageTracks: () => setIsManageTracksOpen(true),
      onEditMeta: () => setIsEditMetaOpen(true),
      onDelete: () => setIsDeleteOpen(true),
    }),
    [
      themeColor,
      isLoadingPlay,
      isLoadingShuffle,
      isSaved,
      tracks.length,
      isOwner,
      variant,
      handlePlayPlaylist,
      handleShuffle,
      handleSave,
    ],
  );

  // ── Render states
  if (isLoading) return <PlaylistDetailSkeleton variant={variant} />;

  if (isError || !playlist) {
    return (
      <PlaylistNotFound
        onBack={() =>
          variant === "embedded" && onClose ? onClose() : navigate("/playlists")
        }
        onRetry={() => refetch()}
      />
    );
  }

  // ── Shared modal props
  const modalProps = {
    playlist,
    isEditMetaOpen,
    isManageTracksOpen,
    isDeleteOpen,
    isMutating,
    handleSubmitForm,
    onCloseEditMeta: () => setIsEditMetaOpen(false),
    onCloseManageTracks: () => setIsManageTracksOpen(false),
    onCloseDelete: () => setIsDeleteOpen(false),
    onConfirmDelete: handleConfirmDelete,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EMBEDDED VARIANT
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "embedded") {
    return (
      <>
        <div
          ref={scrollContainerRef}
          className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
          role="region"
          aria-label={`Playlist: ${playlist.title}`}
        >
          <div
            aria-hidden="true"
            className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.38)} 0%, transparent 100%)`,
            }}
          />

          <div className="relative z-10 -mt-[160px] px-4 pb-10">
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

            <div className="flex items-center gap-3.5 pt-3 pb-5">
              <div className="relative group shrink-0">
                <PlaylistCover
                  playlist={playlist}
                  themeColor={themeColor}
                  isOwner={isOwner}
                  size="sm"
                  onEditCover={() => setIsEditMetaOpen(true)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {playlist.isSystem ? "Hệ thống" : "Playlist"}
                  </span>
                  <VisibilityBadge visibility={playlist.visibility} />
                </div>
                <h2 className="text-xl font-black tracking-tight leading-tight line-clamp-2 text-foreground">
                  {playlist.title}
                </h2>
                <PlaylistMeta
                  trackCount={tracks.length}
                  durationSec={totalDurationSec}
                  createdAt={playlist.createdAt}
                  className="mt-1"
                  compact
                />
              </div>
            </div>

            <PlaylistActionBar {...actionBarProps} />

            {playlist.description && (
              <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-4 line-clamp-3">
                {playlist.description}
              </p>
            )}

            <div className="mt-6 rounded-xl overflow-hidden border border-border/30 bg-card/40">
              {tracks.length > 0 ? (
                <TrackList tracks={tracks} isLoading={false} />
              ) : (
                <EmptyPlaylistState
                  isOwner={isOwner}
                  compact
                  onAdd={() => setIsManageTracksOpen(true)}
                />
              )}
            </div>
          </div>
        </div>

        <PlaylistModals {...modalProps} />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // FIX 18: <div> → <main> semantic element
  // FIX 13: z-40 → z-30 for sticky bar
  // FIX 17: <header> → <section aria-label="Playlist details">
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-32 selection:bg-primary/20 animate-in fade-in duration-700">
      {/* Backdrop gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[68vh] pointer-events-none transition-colors duration-1000"
        style={{
          background: `linear-gradient(180deg,
            ${hexToRgba(themeColor, 0.62)} 0%,
            ${hexToRgba(themeColor, 0.18)} 50%,
            transparent 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[68vh] pointer-events-none opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 h-[68vh] bg-gradient-to-b from-transparent via-background/55 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Back nav */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* Hero — FIX 17: section with aria-label instead of header */}
        <section
          aria-label="Playlist details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-14 md:pb-10"
        >
          <div className="group relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
              style={{ backgroundColor: themeColor }}
            />
            <PlaylistCover
              playlist={playlist}
              themeColor={themeColor}
              isOwner={isOwner}
              size="lg"
              onEditCover={() => setIsEditMetaOpen(true)}
            />
          </div>

          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
                {playlist.isSystem ? (
                  <>
                    <Sparkles className="size-3" aria-hidden="true" /> Hệ thống
                  </>
                ) : (
                  <>
                    <Users className="size-3" aria-hidden="true" /> Cộng đồng
                  </>
                )}
              </div>
              <VisibilityBadge visibility={playlist.visibility} />
            </div>

            {/*
             * FIX 19: <h1> with onClick → wrap in <button> when owner.
             * Clicking a non-interactive h1 is not keyboard-accessible.
             */}
            {isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditMetaOpen(true)}
                title="Click to rename"
                className={cn(
                  "text-left hover:opacity-80 transition-opacity",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded",
                  "font-black tracking-tighter leading-[1.02] drop-shadow-xl text-foreground w-full",
                  playlistTitleSizeClass(playlist.title),
                )}
                aria-label={`Rename playlist: ${playlist.title}`}
              >
                {playlist.title}
              </button>
            ) : (
              <h1
                className={cn(
                  "font-black tracking-tighter leading-[1.02] drop-shadow-xl text-foreground w-full",
                  playlistTitleSizeClass(playlist.title),
                )}
              >
                {playlist.title}
              </h1>
            )}

            {playlist.description ? (
              <p className="text-sm md:text-[15px] text-muted-foreground font-medium line-clamp-2 max-w-xl mt-0.5">
                {playlist.description}
              </p>
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditMetaOpen(true)}
                className="text-sm text-muted-foreground/45 italic hover:text-primary transition-colors flex items-center gap-1.5 mt-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <PenSquare className="size-3.5" aria-hidden="true" /> Thêm mô tả
                cho danh sách phát…
              </button>
            ) : null}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => navigate(`/profile/${playlist.user?._id}`)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity group/user focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                aria-label={`View profile: ${playlist.user?.fullName ?? "System"}`}
              >
                <Avatar className="size-6 border-[1.5px] border-background/70 shadow-sm">
                  <AvatarImage src={playlist.user?.avatar} />
                  <AvatarFallback className="text-[9px] font-black bg-primary/20 text-primary">
                    {playlist.user?.fullName?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-black text-foreground group-hover/user:underline underline-offset-3 decoration-2">
                  {playlist.user?.fullName ?? "Hệ thống"}
                </span>
              </button>

              <span
                className="text-foreground/30 text-xs hidden sm:inline"
                aria-hidden="true"
              >
                •
              </span>
              <PlaylistMeta
                trackCount={tracks.length}
                durationSec={totalDurationSec}
                createdAt={playlist.createdAt}
              />
            </div>
          </div>
        </section>

        {/* Sticky action bar — FIX 13: z-30 not z-40 */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex items-center justify-between gap-4 transition-all duration-300",
            "top-[var(--navbar-height,64px)]",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
        >
          <PlaylistActionBar {...actionBarProps} />

          {/* Mini info — CSS-driven (no Framer — scroll updates are high-frequency) */}
          <div
            aria-hidden="true"
            className={cn(
              "flex items-center gap-2.5 pointer-events-none select-none transition-all duration-300",
              isScrolled
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-3",
            )}
          >
            <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[220px] hidden sm:block">
              {playlist.title}
            </span>
            <div className="size-9 sm:size-10 rounded-xl overflow-hidden shadow-sm border border-border/30 shrink-0 bg-muted flex items-center justify-center">
              {playlist.coverImage ? (
                <img
                  src={playlist.coverImage}
                  alt=""
                  className="size-full object-cover"
                  aria-hidden="true"
                />
              ) : (
                <ListMusic
                  className="size-4 text-muted-foreground/40"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>

        {/* Tracklist */}
        <div className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm -mx-1 sm:mx-0">
          {tracks.length > 0 ? (
            <TrackList tracks={tracks} isLoading={false} />
          ) : (
            <EmptyPlaylistState
              isOwner={isOwner}
              onAdd={() => setIsManageTracksOpen(true)}
            />
          )}
        </div>

        {/* Footer */}
        {tracks.length > 0 && (
          <footer className="mt-16 pt-7 border-t border-border/25 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground/60 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 opacity-50" aria-hidden="true" />
              Tạo ngày {dayjs(playlist.createdAt).format("DD/MM/YYYY")}
            </span>
            <span
              className="text-muted-foreground/30 hidden sm:inline"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="font-bold text-foreground/60">
              {tracks.length} bài hát
            </span>
            {totalDurationSec > 0 && (
              <>
                <span
                  className="text-muted-foreground/30 hidden sm:inline"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span>{formatDuration(totalDurationSec)}</span>
              </>
            )}
          </footer>
        )}
      </div>

      <PlaylistModals {...modalProps} />
    </main>
  );
};

export default PlaylistDetailPage;
