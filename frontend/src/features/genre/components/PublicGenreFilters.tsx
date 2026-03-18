import React, { useState, useEffect } from "react";
import {
  Search,
  XCircle,
  ListFilter,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import type { GenreFilterParams } from "@/features/genre/types";

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

interface PublicGenreFilterProps {
  params: GenreFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof GenreFilterParams, value: any) => void;
  onReset: () => void;
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Mặc định", value: "priority", icon: null },
  { label: "Phổ biến nhất", value: "popular", icon: Sparkles },
  { label: "Tên (A-Z)", value: "name", icon: null },
] as const;

// Định nghĩa giá trị mặc định cho Sort
const DEFAULT_SORT = "priority";

export const PublicGenreFilter: React.FC<PublicGenreFilterProps> = ({
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

  const isFiltering = !!params.keyword || params.isTrending !== undefined;

  const currentSort = params.sort || DEFAULT_SORT;
  const isTrendingActive = params.isTrending === true;

  const handleToggleTrending = () => {
    onFilterChange("isTrending", isTrendingActive ? undefined : "true");
  };

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
            placeholder="Tìm kiếm thể loại, phong cách..."
            autoComplete="off"
            spellCheck="false"
            // ĐỒNG NHẤT: Dùng nền đặc, bóng đổ và viền rõ ràng như ArtistFilter
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
          {/* A. Sắp xếp (Sort Pill) */}
          <Select
            value={currentSort}
            onValueChange={(val) => onFilterChange("sort", val)}
          >
            <SelectTrigger
              className={cn(
                "h-10 lg:h-11 rounded-full px-5 text-[14px] transition-all shrink-0 w-fit border shadow-sm focus:ring-0 focus:ring-offset-0",
                // ĐỒNG NHẤT: Màu sắc giống hệt bộ lọc Artist
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

          {/* B. Filter: Xu hướng (Trending Pill) */}
          <Button
            type="button"
            variant="outline"
            onClick={handleToggleTrending}
            className={cn(
              "h-10 lg:h-11 rounded-full px-4 sm:px-5 text-[14px] transition-all shrink-0 border shadow-sm focus:ring-0 focus:ring-offset-0 gap-2",
              isTrendingActive
                ? "bg-rose-500 text-white border-transparent hover:bg-rose-600 font-bold"
                : "bg-background/90 backdrop-blur-md border-border/80 text-foreground/90 hover:bg-secondary font-medium",
            )}
          >
            <TrendingUp
              className={cn(
                "size-4",
                isTrendingActive ? "text-white" : "text-foreground/70",
              )}
            />
            <span>Thịnh hành</span>
          </Button>

          {/* C. Nút Xóa Lọc */}
          {isFiltering && (
            <div className="animate-in fade-in zoom-in-95 duration-200 ml-1">
              <Button
                type="button"
                variant="ghost"
                onClick={onReset}
                className="h-10 lg:h-11 rounded-full px-5 text-[14px] font-bold text-destructive hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 whitespace-nowrap"
              >
                Xóa tìm kiếm
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PublicGenreFilter;
