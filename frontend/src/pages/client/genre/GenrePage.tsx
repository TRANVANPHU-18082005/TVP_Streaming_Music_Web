import React, { memo, useMemo } from "react";
import { Library, Tag } from "lucide-react";

import { GenreCard } from "@/features/genre/components/GenreCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { useGenresQuery } from "@/features/genre/hooks/useGenresQuery";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";
import { Genrepageskeleton } from "@/features";
import SectionAmbient from "@/components/SectionAmbient";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 40ms/item, capped at 600ms (genre-specific cap) */
const staggerDelay = (i: number) => Math.min(i * 40, 600);

const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12",
);

const DEFAULT_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: 24,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HERO — eyebrow (Tag) + gradient wave title + divider + stat badges
// Genre identity: Tag eyebrow icon + text-gradient-wave (cyan sweep)
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
        <Tag className="size-4" aria-hidden="true" />
      </div>
      <span
        className="text-overline"
        style={{ color: "hsl(var(--brand-glow))" }}
      >
        Genres
      </span>
    </div>

    {/* Title — text-gradient-wave: cyan → pink → purple sweep */}
    <h1
      className="text-display-xl text-gradient-wave mb-2 animate-fade-up animation-fill-both"
      style={{ animationDelay: "60ms" }}
      id="genre-page-heading"
    >
      Thể loại & Tâm trạng
    </h1>
    {/* Subtitle */}
    <p
      className="text-section-subtitle hidden sm:block mb-5 animate-fade-up animation-fill-both"
      style={{ animationDelay: "90ms" }}
    >
      Khám phá thế giới âm nhạc qua từng thể loại và cảm xúc.
    </p>
    {/* Animated divider — .divider-glow token */}
    <div
      className="divider-glow  animate-fade-up animation-fill-both"
      style={{ animationDelay: "100ms", maxWidth: "32rem" }}
    />
  </header>
));
PageHero.displayName = "PageHero";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY GENRES — context-aware, matches AlbumPage + ArtistPage v4.0
// ─────────────────────────────────────────────────────────────────────────────
const EmptyGenres = memo(
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
        title={isFiltering ? "Không tìm thấy kết quả" : "Chưa có thể loại nào"}
        description={
          isFiltering && keyword
            ? `Không có thể loại nào phù hợp với "${keyword}". Hãy thử từ khoá khác.`
            : "Hãy thử thay đổi từ khóa tìm kiếm hoặc các tiêu chí lọc."
        }
        icon={<Library className="size-10 text-muted-foreground/30" />}
      />
    </div>
  ),
);
EmptyGenres.displayName = "EmptyGenres";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION STRIP — single glass-frosted wrapper, no double-wrap anti-pattern
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
        " rounded-2xl",
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
// GENRE PAGE
// ─────────────────────────────────────────────────────────────────────────────
const GenrePage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useGenreParams(24);

  const { data, isLoading, isError } = useGenresQuery(filterParams);

  // Granular derived slices — avoids full object diff
  const genres = useMemo(() => data?.genres ?? [], [data?.genres]);
  const meta = useMemo(
    () => ({ ...DEFAULT_META, ...data?.meta }),
    [data?.meta],
  );

  /** Stable handler object — prevents GenreFilters re-render on grid updates */
  const stableFilterHandlers = useMemo(
    () => ({
      onSearch: handleSearch,
      onFilterChange: handleFilterChange,
      onReset: clearFilters,
    }),
    [handleSearch, handleFilterChange, clearFilters],
  );

  const hasResults = genres.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 pb-28">
        <div className="card-base shadow-elevated p-8 max-w-md w-full text-center animate-scale-in">
          <MusicResult
            status="error"
            title="Không thể tải danh sách Thể loại"
            description="Máy chủ gặp sự cố hoặc kết nối không ổn định. Vui lòng thử lại."
            secondaryAction={{
              label: "Tải lại trang",
              onClick: () => window.location.reload(),
            }}
          />
        </div>
      </div>
    );
  }
  if (isLoading && genres.length === 0) {
    return <Genrepageskeleton cardCount={meta.pageSize} />;
  }
  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />

      {/* ══ HERO HEADER ══ */}
      <PageHero />

      {/* ══ MAIN CONTENT ══ */}
      <main
        className="section-container space-y-6 sm:space-y-8"
        aria-labelledby="genre-page-heading"
      >
        {/* ── Filter bar */}
        <div
          className={cn(
            "rounded-2xl",
            "border border-border/50 dark:border-primary/15",
            "shadow-brand ",
            "animate-fade-up animation-fill-both",
          )}
          style={{ animationDelay: "80ms" }}
        >
          <div
            className="animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <GenreFilters params={filterParams} {...stableFilterHandlers} />
          </div>
        </div>

        {/* ── Genre grid — aria-busy signals loading to AT */}
        <section
          className="min-h-[50vh]"
          aria-label="Danh sách thể loại"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className={GRID_LAYOUT}>
              <CardSkeleton count={meta.pageSize} />
            </div>
          ) : !hasResults ? (
            <EmptyGenres
              isFiltering={isFiltering}
              keyword={filterParams.keyword}
            />
          ) : (
            <div className={GRID_LAYOUT}>
              {genres.map((genre, index) => (
                <div
                  key={genre._id}
                  className="animate-fade-up animation-fill-both"
                  style={{ animationDelay: `${staggerDelay(index)}ms` }}
                >
                  <GenreCard genre={genre} />
                </div>
              ))}
            </div>
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

export default memo(GenrePage);
