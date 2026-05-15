import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Search,
  XCircle,
  ListFilter,
  Mic2,
  Music,
  FilterX,
  Disc3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

// Components UI
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterDropdown from "@/components/ui/FilterDropdown";

import { TrackFilterParams } from "@/features/track/types";
import { Button } from "@/components/ui/button";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const ArtistSelector = lazy(() =>
  import("@/features/artist/components/ArtistSelector").then((m) => ({
    default: m.ArtistSelector,
  })),
);

const AlbumSelector = lazy(() =>
  import("@/features/album/components/AlbumSelector").then((m) => ({
    default: m.AlbumSelector,
  })),
);

const GenreSelector = lazy(() =>
  import("@/features/genre/components/GenreSelector").then((m) => ({
    default: m.GenreSelector,
  })),
);

interface ModalTrackFilterProps {
  params: TrackFilterParams;
  onChange: React.Dispatch<React.SetStateAction<TrackFilterParams>>;
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Phổ biến nhất", value: "popular" },
  { label: "Tên (A–Z)", value: "name" },
  { label: "Xu hướng", value: "trending" },
] as const;

/** Tiện ích: trả về label ngắn cho sort (hiển thị trên mobile) */
const SORT_SHORT: Record<string, string> = {
  newest: "Mới",
  oldest: "Cũ",
  popular: "Hot",
  name: "A–Z",
  trending: "Trend",
};

export const ModalTrackFilter: React.FC<ModalTrackFilterProps> = ({
  params,
  onChange,
  className,
}) => {
  // --- LOCAL SEARCH LOGIC ---
  const [localSearch, setLocalSearch] = useState(params.keyword || "");
  const debouncedSearch = useDebounce(localSearch, 400);

  useEffect(() => {
    if (debouncedSearch !== (params.keyword || "")) {
      onChange((prev) => ({
        ...prev,
        keyword: debouncedSearch || undefined,
        page: 1,
      }));
    }
  }, [debouncedSearch, onChange, params.keyword]);

  useEffect(() => {
    if (params.keyword === undefined && localSearch !== "") {
      setLocalSearch("");
    }
  }, [params.keyword]);

  // --- HANDLERS ---
  const handleClearSearch = () => {
    setLocalSearch("");
    onChange((prev) => ({ ...prev, keyword: undefined, page: 1 }));
  };

  const updateFilter = (key: keyof TrackFilterParams, value: any) => {
    onChange((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleClearAll = () => {
    setLocalSearch("");
    onChange({ sort: "newest", page: 1 });
  };

  const currentSort = params.sort || "newest";

  const isFiltering =
    !!params.artistId ||
    !!params.albumId ||
    !!params.genreId ||
    currentSort !== "newest";

  // Đếm tổng số filter đang active (không tính sort mặc định)
  const activeFilterCount = [
    params.artistId,
    params.albumId,
    params.genreId,
    currentSort !== "newest" ? currentSort : null,
  ].filter(Boolean).length;

  return (
    <div className={cn("w-full space-y-2 sm:space-y-3.5", className)}>
      {/* ================= 1. SEARCH BAR ================= */}
      <div className="relative w-full group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-300 group-focus-within:text-primary z-10">
          <Search className="size-3.5 sm:size-4" />
        </div>

        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Tìm bài hát, ca sĩ..."
          autoComplete="off"
          spellCheck="false"
          className={cn(
            // Mobile: thấp + chữ nhỏ hơn; Desktop: giữ nguyên
            "pl-9 sm:pl-10 pr-9 h-9 sm:h-11",
            "rounded-xl bg-card border-border/50 shadow-sm",
            "focus-visible:bg-background focus-visible:ring-2",
            "focus-visible:ring-primary/20 focus-visible:border-primary",
            "transition-all duration-300",
            "text-[13px] sm:text-[14px] font-semibold",
            "placeholder:font-medium placeholder:text-muted-foreground/60",
          )}
        />

        {localSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-all duration-200 z-10 animate-in fade-in zoom-in-95"
          >
            <XCircle className="size-4 sm:size-4.5" />
          </button>
        )}
      </div>

      {/* ================= 2. FILTER PILLS ================= */}
      <div
        className={cn(
          "flex items-center gap-1.5 sm:gap-2 w-full",
          "overflow-x-auto",
          // Ẩn scrollbar
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Chừa fade-out bên phải để user biết còn nội dung
          "pb-1 pr-4 sm:pr-6",
          "scroll-smooth",
        )}
      >
        {/* ---- A. SORT ---- */}
        <Select
          value={currentSort}
          onValueChange={(val) => updateFilter("sort", val)}
        >
          <SelectTrigger
            className={cn(
              // Mobile: nhỏ gọn, chỉ hiện text ngắn
              "h-8 sm:h-9 rounded-[8px] sm:rounded-[10px]",
              "px-2.5 sm:px-3.5",
              "text-[11px] sm:text-[13px]",
              "transition-all duration-200 shrink-0 w-fit border shadow-sm",
              "focus:ring-0 focus:ring-offset-0",
              currentSort !== "newest"
                ? "bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15"
                : "bg-card border-border/50 text-foreground/80 font-medium hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <ListFilter
                className={cn(
                  "size-3 sm:size-3.5",
                  currentSort !== "newest"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              {/* Mobile: hiện tên ngắn; Desktop: hiện SelectValue đầy đủ */}
              <span className="sm:hidden">{SORT_SHORT[currentSort]}</span>
              <span className="hidden sm:block">
                <SelectValue />
              </span>
            </div>
          </SelectTrigger>

          <SelectContent className="rounded-xl border-border/60 shadow-xl min-w-[130px] z-[9999]">
            {SORT_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[13px] font-bold py-2 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ---- B. NGHỆ SĨ ---- */}
        <FilterDropdown
          isActive={!!params.artistId}
          onClear={() => updateFilter("artistId", undefined)}
          label={
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <Mic2
                className={cn(
                  "size-3 sm:size-3.5 shrink-0",
                  params.artistId ? "text-primary" : "text-muted-foreground",
                )}
              />
              {/* Mobile: icon-only khi chưa chọn; hiện "Đã chọn" khi active */}
              <span
                className={cn(params.artistId ? "block" : "hidden sm:block")}
              >
                {params.artistId ? "Nghệ sĩ" : "Nghệ sĩ"}
              </span>
            </div>
          }
          contentClassName="w-[300px] sm:w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-8 sm:h-9 rounded-[8px] sm:rounded-[10px]",
            "px-2.5 sm:px-3.5",
            "text-[11px] sm:text-[13px]",
            "transition-all duration-200 shrink-0 border shadow-sm",
            params.artistId
              ? "bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15"
              : "bg-card border-border/50 text-foreground/80 font-medium hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <div className="p-2.5 bg-background rounded-2xl">
            <Suspense fallback={<WaveformLoader />}>
              <ArtistSelector
                singleSelect
                value={params.artistId ? [params.artistId] : []}
                onChange={(ids) => updateFilter("artistId", ids[0])}
              />
            </Suspense>
          </div>
        </FilterDropdown>

        {/* ---- C. ALBUM ---- */}
        <FilterDropdown
          isActive={!!params.albumId}
          onClear={() => updateFilter("albumId", undefined)}
          label={
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <Disc3
                className={cn(
                  "size-3 sm:size-3.5 shrink-0",
                  params.albumId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(params.albumId ? "block" : "hidden sm:block")}
              >
                {params.albumId ? "Album" : "Album"}
              </span>
            </div>
          }
          contentClassName="w-[300px] sm:w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-8 sm:h-9 rounded-[8px] sm:rounded-[10px]",
            "px-2.5 sm:px-3.5",
            "text-[11px] sm:text-[13px]",
            "transition-all duration-200 shrink-0 border shadow-sm",
            params.albumId
              ? "bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15"
              : "bg-card border-border/50 text-foreground/80 font-medium hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <div className="p-2.5 bg-background rounded-2xl">
            <Suspense fallback={<WaveformLoader />}>
              <AlbumSelector
                value={params.albumId || ""}
                onChange={(val) => updateFilter("albumId", val)}
              />
            </Suspense>
          </div>
        </FilterDropdown>

        {/* ---- D. THỂ LOẠI ---- */}
        <FilterDropdown
          isActive={!!params.genreId}
          onClear={() => updateFilter("genreId", undefined)}
          label={
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <Music
                className={cn(
                  "size-3 sm:size-3.5 shrink-0",
                  params.genreId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(params.genreId ? "block" : "hidden sm:block")}
              >
                {params.genreId ? "Thể loại" : "Thể loại"}
              </span>
            </div>
          }
          contentClassName="w-[280px] sm:w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-8 sm:h-9 rounded-[8px] sm:rounded-[10px]",
            "px-2.5 sm:px-3.5",
            "text-[11px] sm:text-[13px]",
            "transition-all duration-200 shrink-0 border shadow-sm",
            params.genreId
              ? "bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15"
              : "bg-card border-border/50 text-foreground/80 font-medium hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <div className="p-2 bg-background rounded-2xl">
            <Suspense fallback={<WaveformLoader />}>
              <GenreSelector
                variant="filter"
                singleSelect={true}
                value={params.genreId}
                onChange={(val) => updateFilter("genreId", val)}
                placeholder="Tìm thể loại (Pop, Ballad...)"
              />
            </Suspense>
          </div>
        </FilterDropdown>

        {/* ---- E. CLEAR ALL (có badge đếm số filter) ---- */}
        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className={cn(
              "h-8 sm:h-9 px-2 sm:px-3 shrink-0",
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "rounded-[8px] sm:rounded-[10px] transition-all",
              "animate-in fade-in slide-in-from-left-2",
              "relative",
            )}
          >
            <FilterX className="size-3.5 sm:size-4" />
            {/* Badge đếm filter – chỉ hiện trên mobile thay cho chữ */}
            {activeFilterCount > 0 && (
              <span className="sm:hidden absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
                {activeFilterCount}
              </span>
            )}
            {/* Text chỉ hiện trên sm+ */}
            <span className="hidden sm:inline ml-1.5 text-xs font-bold uppercase tracking-wider">
              Xóa bộ lọc
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default ModalTrackFilter;
