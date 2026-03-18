import React, { useState, useEffect } from "react";
import {
  Search,
  ListFilter,
  Music,
  Sparkles,
  XCircle,
  Disc3,
  Calendar,
  Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import type { AlbumFilterParams } from "@/features/album/types";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { ArtistSelector } from "@/features/artist/components/ArtistSelector";
import { YearPicker } from "@/components/ui/YearPicker";
import { PublicGenreSelector } from "@/features/genre/components/PublicGenreSelector";

interface PublicAlbumFiltersProps {
  params: AlbumFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof AlbumFilterParams, value: any) => void;
  onReset: () => void;
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Mới phát hành", value: "newest", icon: Sparkles },
  { label: "Cũ nhất", value: "oldest", icon: null },
  { label: "Phổ biến", value: "popular", icon: null },
  { label: "Tên (A-Z)", value: "name", icon: null },
] as const;

const TYPE_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Album", value: "album" },
  { label: "Single", value: "single" },
  { label: "EP", value: "ep" },
  { label: "Compilation", value: "compilation" },
] as const;

// Giá trị mặc định
const DEFAULT_SORT = "newest";
const DEFAULT_TYPE = "all";

export const PublicAlbumFilters: React.FC<PublicAlbumFiltersProps> = ({
  params,
  onSearch,
  onFilterChange,
  onReset,
  className,
}) => {
  // --- SEARCH LOGIC ---
  const [localSearch, setLocalSearch] = useState(params.keyword || "");
  const debouncedSearch = useDebounce(localSearch, 400);

  useEffect(() => {
    setLocalSearch(params.keyword || "");
  }, [params.keyword]);

  useEffect(() => {
    if (debouncedSearch !== (params.keyword || "")) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, params.keyword, onSearch]);

  const handleClearSearch = () => {
    setLocalSearch("");
  };

  // --- FILTER STATE CHECK ---
  const isFiltering =
    !!params.genreId ||
    !!params.artistId ||
    !!params.year ||
    (params.type && params.type !== DEFAULT_TYPE) ||
    !!params.keyword;

  const currentSort = params.sort || DEFAULT_SORT;
  const currentType = params.type || DEFAULT_TYPE;

  return (
    <div className={cn("w-full p-2 lg:p-4", className)}>
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center w-full">
        {/* ================= 1. HERO SEARCH BAR ================= */}
        <div className="relative w-full lg:max-w-[380px] xl:max-w-[450px] shrink-0 group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/60 group-focus-within:text-primary transition-colors z-10">
            <Search className="size-5" />
          </div>
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm album, đĩa đơn..."
            autoComplete="off"
            spellCheck="false"
            className="pl-12 pr-11 h-12 lg:h-14 rounded-full bg-background border-border/80 shadow-sm hover:border-primary/50 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary transition-all text-base font-medium placeholder:text-muted-foreground/80 placeholder:font-normal"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all z-10"
            >
              <XCircle className="size-5" />
            </button>
          )}
        </div>

        {/* Dấu gạch dọc chia cách trên Desktop */}
        <div className="hidden lg:block w-[1px] h-8 bg-border/80 mx-1 shrink-0" />

        {/* ================= 2. SCROLLABLE FILTER PILLS ================= */}
        <div className="flex items-center gap-2.5 w-full overflow-x-auto pb-2 lg:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* A. LOẠI ĐĨA (Type) */}
          <Select
            value={currentType}
            onValueChange={(val) =>
              onFilterChange("type", val === DEFAULT_TYPE ? undefined : val)
            }
          >
            <SelectTrigger
              className={cn(
                "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 w-fit border shadow-sm focus:ring-0 focus:ring-offset-0",
                currentType !== DEFAULT_TYPE
                  ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                  : "bg-background/90 backdrop-blur-md border-border/80 text-foreground/90 hover:bg-secondary",
              )}
            >
              <div className="flex items-center gap-2 whitespace-nowrap font-semibold">
                <Disc3
                  className={cn(
                    "size-4",
                    currentType !== DEFAULT_TYPE
                      ? "text-primary"
                      : "text-foreground/70",
                  )}
                />
                <span className="capitalize">
                  <SelectValue />
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/80 shadow-lg">
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="rounded-lg cursor-pointer py-2.5 font-medium"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* B. THỂ LOẠI (Genre) */}
          <FilterDropdown
            isActive={!!params.genreId}
            onClear={() => onFilterChange("genreId", undefined)}
            label={
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Music
                  className={cn(
                    "size-4",
                    params.genreId ? "text-primary" : "text-foreground/70",
                  )}
                />
                <span className="font-semibold">
                  {params.genreId ? "Đã chọn Thể loại" : "Thể loại"}
                </span>
              </div>
            }
            contentClassName="w-[320px] rounded-2xl"
            className={cn(
              "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 border shadow-sm",
              params.genreId
                ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                : "bg-background/90 backdrop-blur-md border-border/80 text-foreground/90 hover:bg-secondary",
            )}
          >
            <div className="p-2">
              <PublicGenreSelector
                variant="filter"
                singleSelect={true}
                value={params.genreId}
                onChange={(val) => onFilterChange("genreId", val)}
                placeholder="Tìm thể loại..."
              />
            </div>
          </FilterDropdown>

          {/* C. NGHỆ SĨ (Artist) */}
          <FilterDropdown
            isActive={!!params.artistId}
            onClear={() => onFilterChange("artistId", undefined)}
            label={
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Mic2
                  className={cn(
                    "size-4",
                    params.artistId ? "text-primary" : "text-foreground/70",
                  )}
                />
                <span className="font-semibold">
                  {params.artistId ? "Đã chọn Nghệ sĩ" : "Nghệ sĩ"}
                </span>
              </div>
            }
            contentClassName="w-[300px] rounded-2xl"
            className={cn(
              "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 border shadow-sm",
              params.artistId
                ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                : "bg-background/90 backdrop-blur-md border-border/80 text-foreground/90 hover:bg-secondary",
            )}
          >
            <div className="p-2">
              <ArtistSelector
                singleSelect
                value={params.artistId ? [params.artistId] : []}
                onChange={(ids) => onFilterChange("artistId", ids[0])}
              />
            </div>
          </FilterDropdown>

          {/* D. NĂM (Year) - ĐÃ FIX LỖI VỠ LAYOUT */}
          <FilterDropdown
            isActive={!!params.year}
            onClear={() => onFilterChange("year", undefined)}
            label={
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Calendar
                  className={cn(
                    "size-4",
                    params.year
                      ? "text-background opacity-90"
                      : "text-foreground/70",
                  )}
                />
                <span className="font-semibold">
                  {params.year ? `Năm: ${params.year}` : "Năm phát hành"}
                </span>
              </div>
            }
            contentClassName="w-auto rounded-2xl p-3"
            className={cn(
              "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 border shadow-sm",
              params.year
                ? "bg-foreground text-background border-transparent hover:bg-foreground/90"
                : "bg-background border-border text-foreground hover:bg-accent",
            )}
          >
            <YearPicker
              value={params.year}
              onChange={(val) => onFilterChange("year", val)}
            />
          </FilterDropdown>

          {/* E. SẮP XẾP (Sort) */}
          <Select
            value={currentSort}
            onValueChange={(val) => onFilterChange("sort", val)}
          >
            <SelectTrigger
              className={cn(
                "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 w-fit border shadow-sm focus:ring-0 focus:ring-offset-0",
                currentSort !== DEFAULT_SORT
                  ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                  : "bg-background/90 backdrop-blur-md border-border/80 text-foreground/90 hover:bg-secondary",
              )}
            >
              <div className="flex items-center gap-2 whitespace-nowrap font-semibold">
                <ListFilter
                  className={cn(
                    "size-4",
                    currentSort !== DEFAULT_SORT
                      ? "text-primary"
                      : "text-foreground/70",
                  )}
                />
                <span>
                  <span className="hidden sm:inline-block">
                    <SelectValue />
                  </span>
                  <span className="sm:hidden inline-block">
                    {currentSort === DEFAULT_SORT ? "Sắp xếp" : <SelectValue />}
                  </span>
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/80 shadow-lg">
              {SORT_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="rounded-lg cursor-pointer py-2.5"
                >
                  <div className="flex items-center gap-2 font-medium text-sm">
                    {opt.icon && <opt.icon className="size-4 text-amber-500" />}
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* F. CLEAR ALL */}
          {isFiltering && (
            <div className="animate-in fade-in zoom-in-95 duration-200 ml-1">
              <Button
                type="button"
                variant="ghost"
                onClick={onReset}
                className="h-10 lg:h-11 rounded-full px-5 text-[14px] font-bold text-destructive hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 whitespace-nowrap"
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PublicAlbumFilters;
