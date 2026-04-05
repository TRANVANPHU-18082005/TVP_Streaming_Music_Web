import React, { useCallback, useMemo, memo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Disc3 } from "lucide-react";

import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import AlbumFilter from "@/features/album/components/AlbumFilter";
import { useAlbumParams } from "@/features/album/hooks/useAlbumParams";
import { useAlbumsQuery } from "@/features/album/hooks/useAlbumsQuery";
import albumApi from "@/features/album/api/albumApi";
import { albumKeys } from "@/features/album/utils/albumKeys";
import { useAppDispatch } from "@/store/hooks";
import { Albumpageskeleton, setIsPlaying, setQueue } from "@/features";
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

/** Stagger delay — 45ms/item, capped at 700ms (prevents 16th+ card jank) */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

/** Module-scoped grid constant — zero allocation per render */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — section header matching FeaturedAlbums pattern
// Eyebrow + gradient title + divider-glow + stat badges
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(() => (
  <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-10">
    {/* Eyebrow — matches FeaturedAlbums */}
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
        <Disc3 className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Collection
      </span>
    </div>
    {/* Title */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="album-page-heading"
    >
      Tuyển tập Đĩa nhạc
    </h1>
    {/* Subtitle */}
    <p
      className={cn(
        "text-section-subtitle hidden sm:block mb-5",
        "animate-fade-up animation-fill-both",
      )}
      style={{ animationDelay: "90ms" }}
    >
      Khám phá toàn bộ thư viện âm nhạc được biên tập chọn lọc.
    </p>

    {/* Animated brand divider — .divider-glow token */}
    <div
      className="divider-glow animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM GRID WRAPPER — memo'd, stable identity across data transitions
// ─────────────────────────────────────────────────────────────────────────────
const AlbumGrid = memo(({ children }: { children: React.ReactNode }) => (
  <div className={GRID_LAYOUT}>{children}</div>
));
AlbumGrid.displayName = "AlbumGrid";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — context-aware, matches FeaturedAlbums empty card style
// ─────────────────────────────────────────────────────────────────────────────
const EmptyAlbums = memo(
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
        title={isFiltering ? "Không tìm thấy kết quả" : "Chưa có album nào"}
        description={
          isFiltering && keyword
            ? `Không có album nào phù hợp với "${keyword}". Hãy thử từ khoá khác.`
            : "Hệ thống chưa có đĩa nhạc nào thoả mãn điều kiện này."
        }
      />
    </div>
  ),
);
EmptyAlbums.displayName = "EmptyAlbums";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION STRIP — glass-frosted panel, single wrapper (v3.2 had double)
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
// ALBUM PAGE
// ─────────────────────────────────────────────────────────────────────────────
const AlbumPage: React.FC = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useAlbumParams(24);

  const { data, isLoading, isError } = useAlbumsQuery(filterParams);

  const albums = useMemo(() => data?.albums ?? [], [data?.albums]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );

  /**
   * Play handler — no throw, no artificial delay (v3.2 fixes preserved).
   * useCallback prevents new function reference breaking PublicAlbumCard memo.
   */
  const handlePlayAlbum = useCallback(
    async (albumId: string) => {
      try {
        const res = await queryClient.fetchQuery({
          queryKey: albumKeys.detail(albumId),
          queryFn: () => albumApi.getById(albumId),
          staleTime: 5 * 60 * 1000,
        });

        const tracks = res.data?.tracks;

        if (!tracks?.length) {
          toast.error("Album này hiện chưa có bài hát nào!");
          return;
        }

        dispatch(setQueue({ tracks, startIndex: 0 }));
        dispatch(setIsPlaying(true));
        toast.success(`Đang phát ${tracks.length} bài từ album`);
      } catch {
        toast.error("Không thể tải nhạc. Vui lòng thử lại.");
      }
    },
    [queryClient, dispatch],
  );

  /** Stable handler object — prevents AlbumFilter re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const skeletonCount = meta.pageSize || APP_CONFIG.PAGINATION_LIMIT;
  const hasResults = albums.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 pb-28">
        <div
          className={cn(
            "card-base shadow-elevated p-8 max-w-md w-full text-center",
            "animate-scale-in",
          )}
        >
          <MusicResult
            status="error"
            title="Không thể tải danh sách Album"
            description="Máy chủ gặp sự cố. Vui lòng kiểm tra kết nối và thử lại."
            secondaryAction={{
              label: "Tải lại",
              onClick: () => window.location.reload(),
            }}
          />
        </div>
      </div>
    );
  }
  if (isLoading && albums.length === 0) {
    return <Albumpageskeleton cardCount={meta.pageSize || 18} />;
  }
  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />
      {/* ══ HERO HEADER ══ */}
      <PageHero />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="album-page-heading"
      >
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          {/* ── Filter bar — matches FeaturedAlbums glass-frosted pattern */}
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <AlbumFilter params={filterParams} {...stableFilterHandlers} />
          </div>
        </div>

        {/* ── Album grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách album"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <AlbumGrid>
              <CardSkeleton count={skeletonCount} />
            </AlbumGrid>
          ) : !hasResults ? (
            <EmptyAlbums
              isFiltering={isFiltering}
              keyword={filterParams.keyword}
            />
          ) : (
            <AlbumGrid>
              {albums.map((album, index) => (
                <div
                  key={album._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <PublicAlbumCard
                    album={album}
                    onPlay={() => handlePlayAlbum(album._id)}
                  />
                </div>
              ))}
            </AlbumGrid>
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

export default memo(AlbumPage);
