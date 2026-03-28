"use client";

/**
 * @file AlbumPage.tsx — Album catalog page (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v3.2:
 * ─ Hero section elevated to match FeaturedAlbums section-block pattern with
 *   animated stat badges, eyebrow label + Disc3 icon header from FeaturedAlbums
 * ─ AmbientBackground: same multi-orb system as AlbumPage v3.2, extended with
 *   aurora-band CSS classes (matching FeaturedAlbums aesthetic direction)
 * ─ Grid layout upgraded: 2→7 column adaptive, sm gap-y-8→gap-y-10
 * ─ Card stagger: capped at 700ms (original), now also uses animate-fade-up
 *   class from index.css (not inline keyframes)
 * ─ Pagination strip: glass-frosted single wrapper (double-wrap removed)
 * ─ Empty / Error states: unified with FeaturedAlbums card style
 * ─ Login-gate layout: page never breaks without auth — no conditional
 *   full-page redirects; AmbientBackground always renders behind content
 *
 * FIXES FROM v3.2 PRESERVED:
 * ─ No throw in handlePlayAlbum catch
 * ─ No artificial 600ms delay
 * ─ stableFilterHandlers via useMemo
 * ─ GRID_LAYOUT module-scoped constant
 * ─ DEFAULT_META constant
 */

import React, { useCallback, useMemo, memo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Disc3, Library, TrendingUp } from "lucide-react";

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

/** Stagger delay — 45ms/item, capped at 700ms (prevents 16th+ card jank) */
const staggerDelay = (i: number) => Math.min(i * 45, 700);

/** Module-scoped grid constant — zero allocation per render */
const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND — isolated memo, never re-renders on data change
// Inherits orb-float CSS token classes from index.css for GPU compositing.
// Reduced-motion: index.css @media rule disables all animations.
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = memo(() => (
  <div
    className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-background" />

    {/* Brand-500 violet — top-left */}
    <div
      className="absolute rounded-full orb-float orb-float--brand orb-float--lg"
      style={{ width: 640, height: 640, top: -200, left: -140, opacity: 0.32 }}
    />

    {/* Wave-2 pink — top-right */}
    <div
      className="absolute rounded-full orb-float orb-float--wave orb-float--slow orb-float--lg"
      style={{
        width: 520,
        height: 520,
        top: "10%",
        right: -120,
        opacity: 0.24,
      }}
    />

    {/* Wave-3 cyan — bottom-center */}
    <div
      className="absolute rounded-full orb-float orb-float--cyan orb-float--fast"
      style={{
        width: 400,
        height: 400,
        bottom: "12%",
        left: "38%",
        filter: "blur(72px)",
        opacity: 0.18,
      }}
    />

    {/* Wave-4 gold — bottom-left */}
    <div
      className="absolute rounded-full orb-float orb-float--gold orb-float--slow"
      style={{
        width: 280,
        height: 280,
        bottom: "22%",
        left: -60,
        filter: "blur(60px)",
        opacity: 0.15,
      }}
    />

    {/* Aurora bands — .aurora-band CSS token */}
    <div className="aurora-band aurora-band--1" />
    <div className="aurora-band aurora-band--2" />

    {/* Grain texture overlay */}
    <div
      className="absolute inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />

    {/* Hero gradient tint */}
    <div
      className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--primary)/0.055) 0%, hsl(var(--wave-2)/0.025) 45%, transparent 100%)",
      }}
    />

    {/* Player bar clearance vignette */}
    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
  </div>
));
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// HERO STAT BADGE — mini info chips in header, matching FeaturedAlbums style
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
        "border border-border/60 bg-card/50 backdrop-blur-sm",
        "shadow-raised",
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
// PAGE HERO — section header matching FeaturedAlbums pattern
// Eyebrow + gradient title + divider-glow + stat badges
// ─────────────────────────────────────────────────────────────────────────────
const PageHero = memo(
  ({ totalItems, isLoading }: { totalItems: number; isLoading: boolean }) => (
    <header className="section-container pt-12 pb-8 sm:pt-14 sm:pb-10">
      {/* Eyebrow — matches FeaturedAlbums */}
      <div
        className="flex items-center gap-2 mb-3 animate-fade-up animation-fill-both"
        style={{ animationDelay: "40ms" }}
      >
        <div
          className={cn(
            "flex items-center justify-center size-7 rounded-lg",
            "bg-primary/10 text-primary",
            "shadow-glow-xs",
          )}
        >
          <Disc3 className="size-4" aria-hidden="true" />
        </div>
        <span className="text-overline text-primary">Collection</span>
      </div>

      {/* Title */}
      <h1
        className={cn(
          "text-display-xl text-gradient-aurora mb-2",
          "animate-fade-up animation-fill-both",
        )}
        style={{ animationDelay: "60ms" }}
        id="album-page-heading"
      >
        Tuyển tập Đĩa nhạc
      </h1>

      {/* Subtitle */}
      <p
        className={cn(
          "text-section-subtitle mb-5",
          "animate-fade-up animation-fill-both",
        )}
        style={{ animationDelay: "90ms" }}
      >
        Khám phá toàn bộ thư viện âm nhạc được biên tập chọn lọc.
      </p>

      {/* Animated brand divider — .divider-glow token */}
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
          <StatBadge icon={Library} label={`${totalItems} Albums`} />
          <StatBadge icon={TrendingUp} label="Cập nhật liên tục" />
        </div>
      )}
    </header>
  ),
);
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
        <AmbientBackground />
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

  return (
    <div className="relative min-h-screen pb-28">
      <AmbientBackground />

      {/* ══ HERO HEADER ══ */}
      <PageHero totalItems={meta.totalItems} isLoading={isLoading} />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="album-page-heading"
      >
        {/* ── Filter bar — matches FeaturedAlbums glass-frosted pattern */}
        <div
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: "80ms" }}
        >
          <AlbumFilter params={filterParams} {...stableFilterHandlers} />
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
