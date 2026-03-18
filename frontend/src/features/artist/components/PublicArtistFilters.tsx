import React, { useState, useEffect } from "react";
import { Search, ListFilter, Music, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import type { ArtistFilterParams } from "@/features/artist/types";

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
import { PublicGenreSelector } from "@/features/genre/components/PublicGenreSelector";

interface PublicArtistFiltersProps {
  params: ArtistFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof ArtistFilterParams, value: any) => void;
  onReset: () => void;
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Phổ biến nhất", value: "popular", icon: Sparkles },
  { label: "Mới nhất", value: "newest", icon: null },
  { label: "Tên (A-Z)", value: "name", icon: null },
] as const;

// Định nghĩa giá trị mặc định cho Sort
const DEFAULT_SORT = "popular";

export const PublicArtistFilters: React.FC<PublicArtistFiltersProps> = ({
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
    // onSearch sẽ tự động được gọi thông qua debounce
  };

  const isFiltering = !!params.genreId || params.keyword;

  const currentSort = params.sort || DEFAULT_SORT;

  return (
    <div className={cn("w-full p-2 lg:p-4", className)}>
      {/* Responsive: 
        - Mobile: flex-col (Search xếp trên, Pills vuốt ngang dưới)
        - Desktop (lg): flex-row (Cùng nằm 1 hàng)
      */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center w-full">
        {/* --- 1. HERO SEARCH BAR --- */}
        <div className="relative w-full lg:max-w-[420px] shrink-0 group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/60 group-focus-within:text-primary transition-colors z-10">
            <Search className="size-5" />
          </div>
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm nghệ sĩ, nhóm nhạc..."
            autoComplete="off"
            spellCheck="false"
            // TƯƠNG PHẢN CAO: Dùng nền đặc (bg-background), bóng đổ (shadow-md) và viền rõ ràng.
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

        {/* Vạch kẻ dọc chia cách trên Desktop */}
        <div className="hidden lg:block w-[1px] h-8 bg-border/80 mx-2 shrink-0" />

        {/* --- 2. SCROLLABLE PILLS --- */}
        <div className="flex items-center gap-3 w-full overflow-x-auto pb-2 lg:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* A. Thể loại (Genre Pill) */}
          <FilterDropdown
            isActive={!!params.genreId}
            onClear={() => onFilterChange("genreId", undefined)}
            label={
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Music
                  className={cn(
                    "size-4",
                    params.genreId
                      ? "text-background opacity-90"
                      : "text-foreground/70",
                  )}
                />
                <span className="font-semibold">
                  {params.genreId ? "Đã chọn thể loại" : "Thể loại"}
                </span>
              </div>
            }
            contentClassName="w-[300px] rounded-2xl"
            className={cn(
              "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 border shadow-sm",
              // 🔥 TƯƠNG PHẢN TUYỆT ĐỐI (Spotify Style): Active thì nền đen chữ trắng (light mode)
              params.genreId
                ? "bg-foreground text-background border-transparent hover:bg-foreground/90"
                : "bg-background border-border text-foreground hover:bg-accent",
            )}
          >
            <div className="p-2">
              <PublicGenreSelector
                variant="filter"
                singleSelect={true}
                value={params.genreId}
                onChange={(val) => onFilterChange("genreId", val)}
                placeholder="Tìm thể loại (Pop, Rock...)"
              />
            </div>
          </FilterDropdown>

          {/* B. Sắp xếp (Sort Pill) */}
          <Select
            value={currentSort} // Dùng biến đã xử lý fallback
            onValueChange={(val) => onFilterChange("sort", val)}
          >
            <SelectTrigger
              className={cn(
                "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 w-fit border shadow-sm focus:ring-0 focus:ring-offset-0",
                currentSort !== DEFAULT_SORT
                  ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20"
                  : "bg-background/90 backdrop-blur-md border-border/80 hover:bg-secondary text-foreground/90",
              )}
            >
              <div className="flex items-center gap-2 whitespace-nowrap font-semibold">
                <ListFilter
                  className={cn(
                    "size-3.5",
                    currentSort !== DEFAULT_SORT
                      ? "text-primary"
                      : "text-foreground/70",
                  )}
                />
                <span>
                  <span className="hidden sm:inline-block">
                    {/* Bắt buộc phải có thẻ SelectValue bên trong để Shadcn biết đường render Text tương ứng với Value đã chọn */}
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

          {/* C. Nút Xóa Lọc */}
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
export default PublicArtistFilters;
