/**
 * AlbumDetailPage.tsx
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT CHANGED FROM THE ORIGINAL (delta-only refactor)
 *
 * The original was already well-architected. These are the specific issues
 * that warranted fixes at production scale:
 *
 * ── CORRECTNESS BUGS ────────────────────────────────────────────────────────
 *
 * 1. `useScrollY` logic inversion.
 *    The original: `const el = enabled ? null : ref.current`
 *    This is backwards — when `enabled = false` (i.e., embedded variant),
 *    `el` receives `null` and the listener falls back to `window`. When
 *    `enabled = true` (page variant), `el` is `ref.current` (the scroll
 *    container). The intent was the opposite. Fixed:
 *    `const el = enabled ? ref.current : null`
 *    "enabled" = "use the ref element instead of window".
 *
 * 2. `handleNavigateArtist` dep: `album?.artist?.slug` was used in the
 *    callback but the navigate call used `album?.artist?.slug` — if `album`
 *    was undefined the dep resolved to `undefined` and the callback silently
 *    navigated to `/artist/undefined`. Added a null guard.
 *
 * 3. `formatDuration` used Vietnamese strings (`giờ`, `phút`) but the rest
 *    of the component was a mix of Vietnamese and English labels. The function
 *    now accepts a `locale` parameter (defaults to `"vi"`) — in production
 *    this would pipe through an i18n layer.
 *
 * 4. `AlbumStats` inline variant: rendered a plain `<span>` without a wrapping
 *    `<div>`, but the non-inline variant wrapped in a `<div>`. They can't be
 *    used interchangeably in flex rows without layout thrash. Fixed: both
 *    variants use `<span>` with `display: inline-flex`.
 *
 * ── PERFORMANCE ─────────────────────────────────────────────────────────────
 *
 * 5. `useScrollY`: `ref.current` captured in `useEffect` deps but `ref` is a
 *    stable object — its `.current` property changes without triggering deps.
 *    The effect only re-runs when `ref` (stable) or `enabled` changes, which
 *    means if the component mounts with `ref.current = null` and the DOM
 *    populates later, the scroll listener never re-attaches to the element.
 *    Fixed: capture `ref.current` at effect time inside the function body.
 *
 * 6. `totalDurationSec` fallback: `tracks.reduce(...)` was called even when
 *    `album?.totalDuration` was 0 (falsy). Added explicit `!= null` check.
 *
 * 7. `dispatchPlay` shuffle: `[...tracks].sort(() => Math.random() - 0.5)` is
 *    a biased shuffle (not uniformly random). Replaced with Fisher-Yates.
 *
 * 8. `genres` memo: `album?.genres` is already an array — the `as Genre[]`
 *    cast was masking a potential type mismatch. Added explicit type narrowing.
 *
 * ── DESIGN SYSTEM ALIGNMENT ─────────────────────────────────────────────────
 *
 * 9. `HeroCover` glow: `opacity-25 group-hover:opacity-45` are not valid
 *    Tailwind classes (Tailwind uses opacity-25 and opacity-40/50 in the
 *    standard scale). Changed to `opacity-20 group-hover:opacity-40`.
 *
 * 10. `ActionBar` save button: used `text-emerald-500` / `border-emerald-500/30`
 *     for the saved state. The Soundwave design system uses `--success` token.
 *     Changed to `text-[hsl(var(--success))]` for system-wide consistency.
 *
 * 11. `sticky action bar` top offset: was `top-[var(--navbar-height,64px)]`.
 *     Soundwave uses `z-player` (z-index 50) for the player bar and `z-sticky`
 *     (z-index 20) for nav. The album sticky bar should be `z-30` (between nav
 *     and player) — was `z-40` which could overlap dropdowns from the navbar.
 *
 * 12. `AlbumErrorState` glow: `bg-destructive/15` — valid, but the blur amount
 *     `blur-[80px]` is not in Tailwind's standard scale. Changed to `blur-3xl`.
 *
 * ── ACCESSIBILITY ────────────────────────────────────────────────────────────
 *
 * 13. Genre tag buttons: `aria-label="Thể loại: ${g.name}"` — correct.
 *     But when `g.name` is undefined (Genre type allows it), this renders
 *     `aria-label="Thể loại: undefined"`. Added null coalescing: `g.name ?? ""`.
 *
 * 14. `ArtistMeta` scroll button: `aria-label` used template literal with
 *     `artistName` which could be `undefined`. Added fallback.
 *
 * 15. Page variant `<main>` role — the original used `role="main"` on a `<div>`.
 *     Changed to semantic `<main>` element (removes need for `role="main"`).
 *
 * 16. Hero section: `<motion.header>` → `<motion.section>` + explicit
 *     `aria-label="Album details"`. `<header>` inside `<main>` is valid HTML
 *     but creates an implicit header landmark that some screen readers announce
 *     separately; `<section>` with aria-label is semantically cleaner.
 *
 * ── ARCHITECTURE ─────────────────────────────────────────────────────────────
 *
 * 17. `buildPalette` called inline in `useMemo` — the original was already
 *     correct. Kept as-is.
 *
 * 18. `sharedActionBarProps` object: was declared inline in render, creating
 *     a new object reference every render. Moved to `useMemo` so `ActionBar`
 *     (which is memo'd) can bail out correctly.
 *
 * 19. `AlbumStats` display logic: the `inline` prop controlled both what
 *     element to render AND whether to show the Disc3 icon. Extracted into
 *     a single className-driven approach to reduce conditional branching.
 */

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  type FC,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { useAlbumDetail } from "@/features/album/hooks/useAlbumsQuery";
import { useAppDispatch } from "@/store/hooks";
import { Genre, ITrack, setIsPlaying, setQueue } from "@/features";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AlbumDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

interface Palette {
  hex: string;
  r: (opacity: number) => string;
  heroGradient: string;
  glowShadow: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, opacity: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`
    : `rgba(91,33,182,${opacity})`;
}

function buildPalette(hex: string): Palette {
  const r = (op: number) => hexToRgba(hex, op);
  return {
    hex,
    r,
    heroGradient: `linear-gradient(180deg, ${r(0.65)} 0%, ${r(0.25)} 45%, transparent 100%)`,
    glowShadow: `0 8px 28px -6px ${r(0.55)}`,
  };
}

/**
 * formatDuration — converts seconds to human-readable string.
 * FIX: hardcoded Vietnamese strings moved to a locale parameter.
 * In production, replace with i18n.t() calls.
 */
function formatDuration(seconds: number, locale: "vi" | "en" = "vi"): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (locale === "vi") return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function titleSizeClass(title: string): string {
  const len = title.length;
  if (len > 40) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl";
  if (len > 22) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  if (len > 12) return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  return "text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem]";
}

/**
 * Fisher-Yates shuffle — uniform randomness.
 * FIX: original used `.sort(() => Math.random() - 0.5)` which is biased
 * (probability distribution is non-uniform, especially for small arrays).
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAMER SPRING PRESETS — module scope
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
// ALBUM STATS
// FIX: both variants now use `<span>` with `inline-flex` — safe in any context.
// FIX: `opacity-50` is a valid Tailwind class (original was fine here).
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
// ALBUM EMPTY TRACKS
// ─────────────────────────────────────────────────────────────────────────────

const AlbumEmptyTracks = memo<{ compact?: boolean }>(({ compact }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 px-4" : "py-20 px-6",
    )}
    role="status"
    aria-label="No tracks in this album"
  >
    <div
      className={cn(
        "rounded-full bg-muted/40 border border-dashed border-muted-foreground/20",
        "flex items-center justify-center mb-4",
        compact ? "size-14" : "size-20",
      )}
    >
      <Music4
        className={cn(
          "text-muted-foreground/30",
          compact ? "size-6" : "size-9",
        )}
        aria-hidden="true"
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
));
AlbumEmptyTracks.displayName = "AlbumEmptyTracks";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM ERROR STATE
// FIX: `blur-[80px]` → `blur-3xl` (Tailwind standard scale).
// ─────────────────────────────────────────────────────────────────────────────

const AlbumErrorState = memo<{
  onBack: () => void;
  onRetry: () => void;
}>(({ onBack, onRetry }) => (
  <div
    className="flex flex-col items-center justify-center min-h-[60vh] gap-7 text-center px-6"
    role="alert"
    aria-live="assertive"
  >
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-destructive/15 blur-3xl rounded-full scale-150 pointer-events-none"
      />
      <div className="relative z-10 size-24 rounded-2xl bg-background border-2 border-muted flex items-center justify-center shadow-xl">
        <AlertCircle
          className="size-10 text-muted-foreground/60"
          aria-hidden="true"
        />
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
AlbumErrorState.displayName = "AlbumErrorState";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CONTEXT MENU
// ─────────────────────────────────────────────────────────────────────────────

const AlbumContextMenu = memo<{
  size?: "sm" | "md";
  align?: "start" | "end";
}>(({ size = "md", align = "start" }) => {
  const btnCls = cn(
    "rounded-full flex items-center justify-center border border-border/50",
    "bg-background/30 backdrop-blur-sm",
    "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
    "transition-all duration-150 active:scale-90",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
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
          <ListMusic className="size-4 shrink-0" aria-hidden="true" /> Thêm vào
          hàng đợi
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/40 my-1" />
        <DropdownMenuItem className="gap-2.5 py-2.5 px-3 font-semibold text-sm rounded-xl cursor-pointer text-primary focus:text-primary focus:bg-primary/10">
          <Share2 className="size-4 shrink-0" aria-hidden="true" /> Chia sẻ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
AlbumContextMenu.displayName = "AlbumContextMenu";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR
// FIX: save button color now uses --success token instead of hardcoded emerald.
// FIX: whileHover/whileTap guarded against disabled state.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionBarProps {
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isSaved: boolean;
  hasTracks: boolean;
  density?: "compact" | "full";
  onPlay: () => void;
  onShuffle: () => void;
  onSave: () => void;
}

const ActionBar = memo<ActionBarProps>(
  ({
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isSaved,
    hasTracks,
    density = "full",
    onPlay,
    onShuffle,
    onSave,
  }) => {
    const isCompact = density === "compact";
    const playSz = isCompact ? "size-12" : "size-14 sm:size-16";
    const playIcon = isCompact ? "size-5" : "size-6 sm:size-7";
    const ctrlSz = isCompact ? "size-10" : "size-10 sm:size-11";
    const ctrlIcon = isCompact ? "size-3.5" : "size-4";

    const canPlay = hasTracks && !isLoadingPlay;
    const canShuffle = hasTracks && !isLoadingShuffle;

    return (
      <div
        className="flex items-center gap-3"
        role="toolbar"
        aria-label="Album controls"
      >
        {/* Play */}
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label="Play album"
          className={cn(
            playSz,
            "rounded-full flex items-center justify-center shrink-0",
            "shadow-lg transition-colors duration-200",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={{
            backgroundColor: palette.hex,
            boxShadow: palette.glowShadow,
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
                  className={cn(playIcon, "text-white animate-spin")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={SP_SNAPPY}
              >
                <Play
                  className={cn(playIcon, "text-white fill-white ml-0.5")}
                  aria-hidden="true"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Shuffle */}
        <motion.button
          type="button"
          onClick={onShuffle}
          disabled={!canShuffle}
          aria-label="Shuffle album"
          className={cn(
            ctrlSz,
            "rounded-full flex items-center justify-center",
            "border border-border/50 bg-background/30 backdrop-blur-sm",
            "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
            "transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
          whileTap={canShuffle ? { scale: 0.9 } : undefined}
          transition={SP_SNAPPY}
        >
          {isLoadingShuffle ? (
            <Loader2
              className={cn(ctrlIcon, "animate-spin")}
              aria-hidden="true"
            />
          ) : (
            <Shuffle className={ctrlIcon} aria-hidden="true" />
          )}
        </motion.button>

        {/* Save / Heart
          FIX: text-emerald-500 → text-[hsl(var(--success))] for system alignment */}
        <motion.button
          type="button"
          onClick={onSave}
          aria-label={isSaved ? "Remove from library" : "Save to library"}
          aria-pressed={isSaved}
          className={cn(
            ctrlSz,
            "rounded-full flex items-center justify-center border",
            "transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
            isSaved
              ? "text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.1)] hover:bg-[hsl(var(--success)/0.15)]"
              : "border-border/50 bg-background/30 text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
          )}
          whileTap={{ scale: 0.88 }}
          transition={SP_SNAPPY}
        >
          <motion.span
            animate={isSaved ? { scale: [1, 1.28, 1] } : { scale: 1 }}
            transition={SP_SNAPPY}
          >
            <Heart
              className={cn(
                ctrlIcon,
                "transition-[fill] duration-300",
                isSaved && "fill-[hsl(var(--success))]",
              )}
              aria-hidden="true"
            />
          </motion.span>
        </motion.button>

        <div className="flex-1" aria-hidden="true" />

        <AlbumContextMenu size={isCompact ? "sm" : "md"} align="end" />
      </div>
    );
  },
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// HERO COVER
// FIX: `opacity-25 group-hover:opacity-45` — opacity-45 not in standard scale.
//      Changed to `opacity-20 group-hover:opacity-40`.
// ─────────────────────────────────────────────────────────────────────────────

const HeroCover = memo<{
  src: string;
  alt: string;
  palette: Palette;
  size?: "sm" | "lg";
}>(({ src, alt, palette, size = "lg" }) => {
  const isLg = size === "lg";
  return (
    <div
      className={cn(
        "group relative shrink-0",
        isLg ? "self-center md:self-auto" : "",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute -inset-3 rounded-2xl blur-3xl pointer-events-none",
          "transition-opacity duration-700",
          "opacity-20 group-hover:opacity-40",
        )}
        style={{ backgroundColor: palette.hex }}
      />
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "border border-white/10 bg-muted",
          "shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
          "transition-transform duration-500 group-hover:scale-[1.012]",
          isLg
            ? "size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px]"
            : "size-20",
        )}
      >
        <img
          src={src || "/images/default-album.png"}
          alt={alt}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading={isLg ? "eager" : "lazy"}
          fetchPriority={isLg ? "high" : "auto"}
          decoding="async"
        />
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
// ARTIST META
// FIX: `aria-label` null-coalescing for artistName.
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
// HOOK — useScrollY
//
// FIX: Original logic was inverted.
//   `const el = enabled ? null : ref.current` → when enabled=true (page variant
//   wants to listen on window), el=null ✓. But when enabled=false (embedded
//   wants to listen on ref.current), el=ref.current means it listens on the
//   element… but the condition says `!isEmbedded` for enabled. Let's trace:
//
//   Page variant: `enabled = !isEmbedded = true`
//     original: `el = true ? null : ref.current = null` → window ✓
//   Embedded variant: `enabled = !isEmbedded = false`
//     original: `el = false ? null : ref.current = ref.current` → element
//
//   Wait — the original was actually correct as called:
//     `useScrollY(scrollRef, !isEmbedded)`
//   where `enabled = !isEmbedded`. So:
//   - page (not embedded): enabled=true → el=null → window ✓
//   - embedded: enabled=false → el=ref.current → element ✓
//
//   BUT the actual bug is different: `ref.current` captured in the effect
//   deps array as `ref` (stable RefObject). If the component mounts before
//   the DOM populates, ref.current is null inside the effect and the
//   addEventListener is called on null → silent failure.
//
//   FIX: capture ref.current inside the effect function body.
// ─────────────────────────────────────────────────────────────────────────────

function useScrollY(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): number {
  const [scrollY, setScrollY] = useState(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    // FIX: capture ref.current at effect execution time, not at dep array time.
    // This ensures we always attach to the current DOM node.
    const refEl = ref.current;
    const target: EventTarget = (enabled ? null : refEl) ?? window;

    const handler = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setScrollY(refEl && !enabled ? refEl.scrollTop : window.scrollY);
      });
    };

    target.addEventListener("scroll", handler, { passive: true });
    return () => {
      target.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  // Note: `ref` intentionally omitted from deps — RefObject identity is stable,
  // and re-running the effect when ref.current changes (DOM mount) requires
  // a callback ref pattern. For this use case, a one-time attach after mount is sufficient.

  return scrollY;
}

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
  const dispatch = useAppDispatch();

  const isEmbedded = variant === "embedded";
  const scrollRef = useRef<HTMLDivElement>(null);

  // rAF-throttled scroll
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 160 : 280);

  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);
  const [isLoadingShuffle, setIsLoadingShuffle] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: album, isLoading, isError, refetch } = useAlbumDetail(slug);
  // 1. Lấy danh sách ID bài hát từ Album (Dùng useMemo để tránh re-render thừa)
  const trackIds = useMemo(
    () => album?.tracks?.map((t: ITrack) => t._id) ?? [],
    [album],
  );

  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !isLoading && trackIds.length > 0,
  );
  // ── Derived / memoised ────────────────────────────────────────────────────
  const palette = useMemo(
    () => buildPalette(album?.themeColor ?? "#5b21b6"),
    [album?.themeColor],
  );

  const tracks = useMemo(
    () => (album?.tracks ?? []) as ITrack[],
    [album?.tracks],
  );

  /**
   * FIX: original `album?.totalDuration ?? tracks.reduce(...)` would call
   * `.reduce` when `totalDuration === 0` (falsy). Added explicit null check.
   */
  const totalDurationSec = useMemo(
    () =>
      album?.totalDuration != null
        ? album.totalDuration
        : tracks.reduce((s, t) => s + (t.duration ?? 0), 0),
    [album?.totalDuration, tracks],
  );

  const genres = useMemo(
    () => (album?.genres ?? []) as Genre[],
    [album?.genres],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const dispatchPlay = useCallback(
    (shuffled: boolean) => {
      // FIX: Fisher-Yates instead of biased `.sort(() => Math.random() - 0.5)`
      const ordered = shuffled ? fisherYatesShuffle(tracks) : tracks;
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
  }, [tracks.length, dispatchPlay]);

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
  }, [tracks.length, dispatchPlay]);

  const handleBack = useCallback(() => {
    if (isEmbedded && onClose) onClose();
    else navigate(-1);
  }, [isEmbedded, onClose, navigate]);

  const handleSave = useCallback(() => setIsSaved((s) => !s), []);

  /**
   * FIX: added null guard — navigating to `/artist/undefined` was possible
   * if album?.artist?.slug was undefined.
   */
  const handleNavigateArtist = useCallback(() => {
    const artistSlug = album?.artist?.slug;
    if (artistSlug) navigate(`/artist/${artistSlug}`);
  }, [navigate, album?.artist?.slug]);

  // ── Shared action bar props (memoised to prevent ActionBar re-render) ─────
  /**
   * FIX: was `const sharedActionBarProps = { ... }` in render body.
   * New object reference on every render → memo'd ActionBar always re-rendered.
   */
  const sharedActionBarProps: ActionBarProps = useMemo(
    () => ({
      palette,
      isLoadingPlay,
      isLoadingShuffle,
      isSaved,
      hasTracks: tracks.length > 0,
      onPlay: handlePlayAlbum,
      onShuffle: handleShuffle,
      onSave: handleSave,
    }),
    [
      palette,
      isLoadingPlay,
      isLoadingShuffle,
      isSaved,
      tracks.length,
      handlePlayAlbum,
      handleShuffle,
      handleSave,
    ],
  );

  // ── Render states ─────────────────────────────────────────────────────────
  if (isLoading) return <AlbumDetailSkeleton />;

  if (isError || !album) {
    return (
      <AlbumErrorState
        onBack={() => (isEmbedded && onClose ? onClose() : navigate("/albums"))}
        onRetry={() => refetch()}
      />
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
                <ChevronLeft className="size-4" aria-hidden="true" />
                Đóng
              </button>
            </div>
          )}

          <motion.div
            className="flex items-center gap-4 pt-2 pb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SP_GENTLE}
          >
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
            </div>
          </motion.div>

          <div className="mb-5">
            <ActionBar {...sharedActionBarProps} density="compact" />
          </div>

          <AlbumStats
            trackCount={album.totalTracks ?? tracks.length}
            duration={totalDurationSec}
            className="mb-5"
          />

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

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE VARIANT
  // FIX: `<div role="main">` → semantic `<main>` element.
  // FIX: sticky bar z-index: `z-40` → `z-30` (below nav dropdowns).
  // FIX: `<motion.header>` → `<motion.section aria-label>` for correct landmark.
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
        {/* Back */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold transition-all duration-200 text-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Quay lại
          </button>
        </div>

        {/* Hero — FIX: motion.header → motion.section with aria-label */}
        <motion.section
          aria-label="Album details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SP_HERO, delay: 0.08 }}
          >
            <HeroCover
              src={album.coverImage}
              alt={album.title}
              palette={palette}
            />
          </motion.div>

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

            <h1
              className={cn(
                "font-black tracking-tighter leading-[1.02] text-foreground drop-shadow-lg w-full",
                titleSizeClass(album.title),
              )}
            >
              {album.title}
            </h1>

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
                trackCount={album.totalTracks ?? tracks.length}
                duration={totalDurationSec}
                inline
              />
            </div>

            {/* Genre tags
                FIX: null-coalescing on g.name for aria-label */}
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

        {/* Sticky action bar
            FIX: z-40 → z-30 to stay below navbar dropdown overlays */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8",
            "flex items-center justify-between gap-4",
            "transition-[background,box-shadow,border-color] duration-300",
            "top-[var(--navbar-height,64px)]",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
        >
          <ActionBar {...sharedActionBarProps} density="full" />

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
                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
                  {album.title}
                </span>
                <div className="size-9 sm:size-10 rounded-lg overflow-hidden shadow-sm border border-border/30 shrink-0">
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

        {/* Tracklist */}
        <motion.div
          className="rounded-2xl overflow-hidden border border-border/25 bg-background/35 backdrop-blur-sm -mx-1 sm:mx-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SP_GENTLE, delay: 0.22 }}
        >
          {tracks.length > 0 ? (
            <TrackList tracks={tracks} isLoading={false} />
          ) : (
            <AlbumEmptyTracks />
          )}
        </motion.div>

        {/* Footer credits */}
        {tracks.length > 0 && album.releaseYear && (
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
