"use client";

/**
 * @file PlaylistPage.tsx — Playlist catalog page (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v4.0-prev — full alignment with AlbumPage + ArtistPage + GenrePage v4.0:
 *
 * ── PageHero extracted as memo:
 *    Eyebrow badge (ListMusic icon + text-overline text-primary) + text-gradient-warm
 *    title (gold → pink = playlist identity) + text-section-subtitle description
 *    + divider-glow + StatBadge chips (total count + updated label).
 *    Playlist identity: ListMusic eyebrow + warm gradient (wave-4 gold primary)
 *    differentiates from Disc3/albums, Mic2/artists, Tag/genres.
 *
 * ── AmbientBackground: `position: fixed` — prevents layout void on short
 *    pages (not-logged-in state). Same fix as AlbumPage/ArtistPage/GenrePage v4.0.
 *    Wave-4 (gold) primary identity preserved from v4.0-prev.
 *
 * ── PlaylistFilter: no external glass-frosted wrapper — v4.0 PlaylistFilter
 *    manages its own card/glass styling internally (matches all other filters).
 *
 * ── PaginationStrip extracted as memo — eliminates the v4.0-prev double
 *    glass-frosted anti-pattern.
 *
 * ── EmptyPlaylists extracted as memo — context-aware copy (filtered vs no-data).
 *
 * ── PlaylistGrid memo'd wrapper with module-scoped GRID_LAYOUT preserved.
 *
 * ── staggerDelay, DEFAULT_META, GRID_LAYOUT all module-scoped constants.
 *
 * ── handlePlayPlaylist: no throw, no artificial delay (v4.0-prev fixes kept).
 *
 * ── stableFilterHandlers via useMemo (v4.0-prev pattern preserved).
 */

import React, { useCallback, useMemo, memo } from "react";
import { ListMusic, Library, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import PlaylistFilter from "@/features/playlist/components/PlaylistFilter";
import { usePlaylistParams } from "@/features/playlist/hooks/usePlaylistParams";
import { usePlaylistsQuery } from "@/features/playlist/hooks/usePlaylistsQuery";
import playlistApi from "@/features/playlist/api/playlistApi";
import { playlistKeys } from "@/features/playlist/utils/playlistKeys";
import { useAppDispatch } from "@/store/hooks";
import { setIsPlaying, setQueue } from "@/features";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: 24,
} as const;

/** 45ms/item, capped at 700ms */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND — position: fixed prevents layout void on short pages.
// Wave-4 (gold) primary identity, full 4-orb spectrum.
// GPU-composited via .orb-float CSS token classes; reduced-motion handled by
// index.css @media rule.
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = memo(() => (
  <div
    className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-background" />

    {/* Wave-4 gold — top-left PRIMARY orb (Playlist identity) */}
    <div
      className="absolute rounded-full orb-float orb-float--gold orb-float--lg"
      style={{ width: 640, height: 640, top: -200, left: -140, opacity: 0.32 }}
    />

    {/* Wave-2 pink — top-right secondary orb */}
    <div
      className="absolute rounded-full orb-float orb-float--wave orb-float--slow orb-float--lg"
      style={{
        width: 520,
        height: 520,
        top: "12%",
        right: -120,
        opacity: 0.24,
      }}
    />

    {/* Wave-3 cyan — bottom-center tertiary */}
    <div
      className="absolute rounded-full orb-float orb-float--cyan orb-float--fast"
      style={{
        width: 380,
        height: 380,
        bottom: "10%",
        left: "38%",
        filter: "blur(70px)",
        opacity: 0.18,
      }}
    />

    {/* Brand-500 violet — bottom-left accent */}
    <div
      className="absolute rounded-full orb-float orb-float--brand orb-float--slow"
      style={{
        width: 260,
        height: 260,
        bottom: "22%",
        left: -50,
        filter: "blur(60px)",
        opacity: 0.14,
      }}
    />

    {/* Aurora bands — reduced opacity for gold harmony */}
    <div className="aurora-band aurora-band--1" style={{ opacity: 0.09 }} />
    <div className="aurora-band aurora-band--2" style={{ opacity: 0.06 }} />

    {/* Grain texture */}
    <div
      className="absolute inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />

    {/* Hero tint — wave-4 gold identity */}
    <div
      className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--wave-4)/0.06) 0%, hsl(var(--wave-2)/0.03) 40%, transparent 100%)",
      }}
    />

    {/* Player bar clearance */}
    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
  </div>
));
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BADGE — matches all v4.0 catalog pages
// ─────────────────────────────────────────────────────────────────────────────
const StatBadge = memo(
  ({
    icon: Icon,
    label,
    className,
  }: {
    icon: React.ElementType;
    label: string;
    className?: string;
  }) => (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full",
        "border border-border/60 bg-card/50 backdrop-blur-sm shadow-raised",
        "text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3 text-primary/60" aria-hidden="true" />
      {label}
    </div>
  ),
);
StatBadge.displayName = "StatBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — eyebrow (ListMusic) + gradient-warm title + divider + stats
// Playlist identity: ListMusic eyebrow + text-gradient-warm (gold → pink)
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(
  ({ totalItems, isLoading }: { totalItems: number; isLoading: boolean }) => (
    <header className="section-container pt-12 pb-8 sm:pt-14 sm:pb-10">
      {/* Eyebrow */}
      <div
        className="flex items-center gap-2 mb-3 animate-fade-up animation-fill-both"
        style={{ animationDelay: "40ms" }}
      >
        <div
          className={cn(
            "flex items-center justify-center size-7 rounded-lg",
            "bg-primary/10 text-primary shadow-glow-xs",
          )}
        >
          <ListMusic className="size-4" aria-hidden="true" />
        </div>
        <span className="text-overline text-primary">Playlists</span>
      </div>

      {/* Title — text-gradient-warm: gold → pink = playlist identity */}
      <h1
        className="text-display-xl text-gradient-warm mb-2 animate-fade-up animation-fill-both"
        style={{ animationDelay: "60ms" }}
        id="playlist-page-heading"
      >
        Danh sách phát
      </h1>

      {/* Subtitle */}
      <p
        className="text-section-subtitle mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "90ms" }}
      >
        Khám phá các playlist được tuyển chọn từ cộng đồng và hệ thống.
      </p>

      {/* Animated divider */}
      <div
        className="divider-glow mb-5 animate-fade-up animation-fill-both"
        style={{ animationDelay: "100ms", maxWidth: "32rem" }}
      />

      {/* Stat badges */}
      {!isLoading && totalItems > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 animate-fade-up animation-fill-both"
          style={{ animationDelay: "130ms" }}
        >
          <StatBadge icon={Library} label={`${totalItems} Playlists`} />
          <StatBadge icon={TrendingUp} label="Cập nhật liên tục" />
        </div>
      )}
    </header>
  ),
);
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST GRID — memo'd wrapper, stable across data transitions
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistGrid = memo(({ children }: { children: React.ReactNode }) => (
  <div className={GRID_LAYOUT}>{children}</div>
));
PlaylistGrid.displayName = "PlaylistGrid";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY PLAYLISTS — context-aware, matches all v4.0 catalog pages
// ─────────────────────────────────────────────────────────────────────────────
const EmptyPlaylists = memo(
  ({ isFiltering, keyword }: { isFiltering: boolean; keyword?: string }) => (
    <div
      className={cn(
        "card-base border-dashed shadow-none",
        "flex items-center justify-center min-h-[380px]",
        "animate-fade-in",
      )}
    >
      <MusicResult
        status="empty"
        title={isFiltering ? "Không tìm thấy kết quả" : "Chưa có playlist nào"}
        description={
          isFiltering && keyword
            ? `Không có playlist nào phù hợp với "${keyword}". Hãy thử từ khoá khác.`
            : "Chưa có playlist nào phù hợp với điều kiện hiện tại."
        }
        icon={
          <ListMusic
            className="size-10 text-muted-foreground/30"
            aria-hidden="true"
          />
        }
      />
    </div>
  ),
);
EmptyPlaylists.displayName = "EmptyPlaylists";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION STRIP — single glass-frosted wrapper (no double-wrap anti-pattern)
// ─────────────────────────────────────────────────────────────────────────────
const PaginationStrip = memo(
  ({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  }) => (
    <div
      className={cn(
        "glass-frosted rounded-2xl",
        "border border-border/50 dark:border-primary/15",
        "shadow-brand p-4",
        "animate-fade-up animation-fill-both",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={totalItems}
        itemsPerPage={pageSize || APP_CONFIG.PAGINATION_LIMIT}
      />
    </div>
  ),
);
PaginationStrip.displayName = "PaginationStrip";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistPage: React.FC = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = usePlaylistParams(24);

  const { data, isLoading, isError } = usePlaylistsQuery(filterParams);

  const playlists = useMemo(() => data?.playlists ?? [], [data?.playlists]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );

  /**
   * Play handler — no throw, no artificial delay (v4.0-prev fixes preserved).
   * useCallback prevents new ref breaking PublicPlaylistCard memo.
   */
  const handlePlayPlaylist = useCallback(
    async (playlistId: string) => {
      try {
        const res = await queryClient.fetchQuery({
          queryKey: playlistKeys.detail(playlistId),
          queryFn: () => playlistApi.getById(playlistId),
          staleTime: 5 * 60 * 1000,
        });

        const tracks = res.data?.tracks;

        if (!tracks?.length) {
          toast.error("This playlist has no tracks yet!");
          return;
        }

        dispatch(setQueue({ tracks, startIndex: 0 }));
        dispatch(setIsPlaying(true));
        toast.success(`Playing ${tracks.length} tracks from playlist`);
      } catch {
        toast.error("Could not load tracks. Please try again.");
      }
    },
    [queryClient, dispatch],
  );

  /** Stable handler object — prevents PlaylistFilter re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const skeletonCount = meta.pageSize || APP_CONFIG.PAGINATION_LIMIT;
  const hasResults = playlists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 pb-28">
        <AmbientBackground />
        <div className="card-base shadow-elevated p-8 max-w-md w-full text-center animate-scale-in">
          <MusicResult
            status="error"
            title="Could not load playlists"
            description="The server encountered an error. Please check your connection and try again."
            secondaryAction={{
              label: "Reload",
              onClick: () => window.location.reload(),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-28">
      <AmbientBackground />

      {/* ══ HERO HEADER ══ */}
      <PageHero totalItems={meta.totalItems} isLoading={isLoading} />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="playlist-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: "80ms" }}
        >
          <PlaylistFilter params={filterParams} {...stableFilterHandlers} />
        </div>

        {/* ── Playlist grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Playlist catalog"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <PlaylistGrid>
              <CardSkeleton count={skeletonCount} />
            </PlaylistGrid>
          ) : !hasResults ? (
            <EmptyPlaylists
              isFiltering={isFiltering}
              keyword={filterParams.keyword}
            />
          ) : (
            <PlaylistGrid>
              {playlists.map((playlist, index) => (
                <div
                  key={playlist._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <PublicPlaylistCard
                    playlist={playlist}
                    onPlay={() => handlePlayPlaylist(playlist._id)}
                  />
                </div>
              ))}
            </PlaylistGrid>
          )}
        </section>

        {/* ── Pagination */}
        {!isLoading && hasResults && (
          <PaginationStrip
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.totalItems}
            pageSize={meta.pageSize}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
};

export default memo(PlaylistPage);
