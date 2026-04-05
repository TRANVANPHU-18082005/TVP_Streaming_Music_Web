import React, { useCallback, useMemo, memo } from "react";
import { ListMusic } from "lucide-react";
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
import { Playlistpageskeleton, setIsPlaying, setQueue } from "@/features";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";

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
// PAGE HERO — eyebrow (ListMusic) + gradient-warm title + divider + stats
// Playlist identity: ListMusic eyebrow + text-gradient-warm (gold → pink)
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow */}
    <div
      className="flex items-center gap-2 mb-3 animate-fade-up animation-fill-both"
      style={{ animationDelay: "40ms" }}
    >
      <div
        className="flex items-center justify-center size-6 rounded-md"
        style={{
          background: "hsl(var(--brand-glow) / 0.12)",
          color: "hsl(var(--brand-glow))",
        }}
      >
        <ListMusic className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Playlists
      </span>
    </div>

    {/* Title — text-gradient-warm: gold → pink = playlist identity */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="playlist-page-heading"
    >
      Danh sách phát
    </h1>
    {/* Subtitle */}
    <p
      className="text-section-subtitle hidden sm:block mb-5 animate-fade-up animation-fill-both"
      style={{ animationDelay: "90ms" }}
    >
      Khám phá các playlist được tuyển chọn từ cộng đồng và hệ thống.
    </p>

    {/* Animated divider */}
    <div
      className="divider-glow animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
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
        "rounded-2xl",
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
  if (isLoading && playlists.length === 0) {
    return <Playlistpageskeleton cardCount={meta.pageSize || 24} />;
  }
  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />
      {/* ══ HERO HEADER ══ */}
      <PageHero />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="playlist-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <PlaylistFilter params={filterParams} {...stableFilterHandlers} />
          </div>
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
