import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Mic2,
  Disc,
  Tag,
  LayoutGrid,
  ListFilter,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackFilterParams } from "@/features/track/types";

// Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FilterDropdown from "@/components/ui/FilterDropdown";

// Feature Selectors
import { ArtistSelector } from "@/features/artist/components/ArtistSelector";
import { AlbumSelector } from "@/features/album/components/AlbumSelector";
import { GenreSelector } from "@/features/genre/components/GenreSelector";

// Shadcn Select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";

interface TrackFiltersProps {
  params: TrackFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof TrackFilterParams, value: any) => void;
  onReset: () => void;
  className?: string;
  hideStatus?: boolean;
}

const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Phổ biến", value: "popular" },
  { label: "Tên (A-Z)", value: "name" },
] as const;

const STATUS_OPTIONS = [
  { value: "ready", label: "Đã xử lý (Ready)", color: "bg-emerald-500" },
  {
    value: "processing",
    label: "Đang xử lý (Processing)",
    color: "bg-blue-500",
  },
  { value: "pending", label: "Chờ xử lý (Pending)", color: "bg-yellow-500" },
  { value: "failed", label: "Lỗi (Failed)", color: "bg-red-500" },
] as const;

export const TrackFilters: React.FC<TrackFiltersProps> = ({
  params,
  onSearch,
  onFilterChange,
  onReset,
  className,
  hideStatus = false,
}) => {
  // --- 1. UI STATE ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);

  // --- 2. SEARCH LOGIC ---
  const [localSearch, setLocalSearch] = useState(params.keyword || "");
  const debouncedSearch = useDebounce(localSearch, 400);

  // Đồng bộ URL -> Input
  useEffect(() => {
    setLocalSearch(params.keyword || "");
  }, [params.keyword]);

  // Đồng bộ Input -> URL (Thông qua Debounce)
  useEffect(() => {
    if (debouncedSearch !== (params.keyword || "")) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, params.keyword, onSearch]);

  // 🔥 FIX LỖI CLEAR SEARCH: Bỏ onSearch("") trực tiếp đi
  const handleClearSearch = () => {
    setLocalSearch(""); // Debounce sẽ tự động gọi onSearch("") sau 400ms, đảm bảo state không bị đụng độ
  };

  // --- 3. ANIMATION LOGIC (Overflow Fix) ---
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => setOverflowVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setOverflowVisible(false);
    }
  }, [isExpanded]);

  // --- 4. ACTIVE COUNT ---
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (params.status) count++;
    if (params.artistId) count++;
    if (params.albumId) count++;
    if (params.genreId) count++;
    return count;
  }, [params]);

  const removeFilter = (key: keyof TrackFilterParams) => {
    onFilterChange(key, undefined);
  };

  return (
    <div className={cn("w-full mb-8", className)}>
      <div className="bg-card border border-border rounded-xl shadow-sm transition-all">
        {/* --- HEADER --- */}
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Search Bar */}
          <div className="relative w-full md:flex-1 md:max-w-xl group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="size-4" />
            </div>
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm bài hát, ISRC, lời nhạc..."
              autoComplete="off"
              spellCheck="false"
              className="pl-9 pr-9 h-10 bg-background border-input shadow-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
            />
            {localSearch && (
              <button
                type="button" // 🔥 FIX QUAN TRỌNG: Ngăn HTML tự hiểu đây là nút Submit form
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto md:justify-end">
            <Select
              value={params.sort || "newest"}
              onValueChange={(val) => onFilterChange("sort", val)}
            >
              <SelectTrigger className="h-10 w-full md:w-[160px] bg-background border-input shadow-sm hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <ListFilter className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                    Sắp xếp:
                  </span>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6 hidden md:block" />

            <Button
              variant={isExpanded ? "secondary" : "outline"}
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "h-10 px-4 gap-2 shadow-sm border-input hover:bg-accent/50 transition-all min-w-[100px] justify-between",
                isExpanded &&
                  "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15",
              )}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5" />
                <span className="font-medium">Filter</span>
              </div>

              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180",
                  )}
                />
              </div>
            </Button>
          </div>
        </div>

        {/* --- EXPANDABLE PANEL --- */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out border-t border-transparent",
            isExpanded ? "grid-rows-[1fr] border-border" : "grid-rows-[0fr]",
          )}
        >
          <div
            className={cn(
              "bg-muted/30 transition-all",
              overflowVisible ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Status Filter */}
              {!hideStatus && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                    <LayoutGrid className="size-3" /> Trạng thái xử lý
                  </label>
                  <Select
                    value={params.status || "all"}
                    onValueChange={(val) =>
                      onFilterChange("status", val === "all" ? undefined : val)
                    }
                  >
                    <SelectTrigger className="w-full bg-background h-9 text-sm shadow-sm focus:ring-1">
                      <SelectValue placeholder="Tất cả trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn("size-2 rounded-full", opt.color)}
                            />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 2. Artist Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Mic2 className="size-3" /> Nghệ sĩ
                </label>
                <FilterDropdown
                  isActive={!!params.artistId}
                  onClear={() => onFilterChange("artistId", undefined)}
                  label={
                    <span className="truncate">
                      {params.artistId ? "Đã chọn" : "Tìm nghệ sĩ"}
                    </span>
                  }
                  contentClassName="w-[300px]"
                  className="w-full bg-background h-9 text-sm font-normal px-3 justify-start shadow-sm focus:ring-1"
                >
                  <div className="p-1">
                    <ArtistSelector
                      singleSelect
                      value={params.artistId ? [params.artistId] : []}
                      onChange={(ids) => onFilterChange("artistId", ids[0])}
                    />
                  </div>
                </FilterDropdown>
              </div>

              {/* 3. Album Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Disc className="size-3" /> Album
                </label>
                <FilterDropdown
                  isActive={!!params.albumId}
                  onClear={() => onFilterChange("albumId", undefined)}
                  label={
                    <span className="truncate">
                      {params.albumId ? "Đã chọn" : "Tìm Album"}
                    </span>
                  }
                  contentClassName="w-[300px]"
                  className="w-full bg-background h-9 text-sm font-normal px-3 justify-start shadow-sm focus:ring-1"
                >
                  <div className="p-1">
                    <AlbumSelector
                      value={params.albumId || ""}
                      onChange={(id) =>
                        onFilterChange("albumId", id || undefined)
                      }
                    />
                  </div>
                </FilterDropdown>
              </div>

              {/* 4. Genre Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Tag className="size-3" /> Thể loại
                </label>
                <FilterDropdown
                  isActive={!!params.genreId}
                  onClear={() => onFilterChange("genreId", undefined)}
                  label={
                    <span className="truncate">
                      {params.genreId ? "Đã chọn" : "Tìm thể loại"}
                    </span>
                  }
                  contentClassName="w-[300px]"
                  className="w-full bg-background h-9 text-sm font-normal px-3 justify-start shadow-sm focus:ring-1"
                >
                  <div className="p-1">
                    <GenreSelector
                      variant="filter" // Chế độ Filter
                      singleSelect={true}
                      value={params.genreId} // String ID
                      onChange={(val) => onFilterChange("genreId", val)}
                      placeholder="Tìm kiếm thể loại..."
                    />
                  </div>
                </FilterDropdown>
              </div>
            </div>
          </div>
        </div>

        {/* --- ACTIVE TAGS FOOTER --- */}
        {activeFiltersCount > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex flex-wrap items-center gap-2 rounded-b-xl">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Đang lọc:
            </span>

            {/* Status Tag */}
            {params.status && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <LayoutGrid className="size-3 text-blue-500" />
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="font-medium capitalize">{params.status}</span>
                <button
                  onClick={() => removeFilter("status")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Artist Tag */}
            {params.artistId && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Mic2 className="size-3 text-indigo-500" />
                <span className="text-muted-foreground">Nghệ sĩ:</span>
                <span className="font-medium">Đã chọn</span>
                <button
                  onClick={() => removeFilter("artistId")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Album Tag */}
            {params.albumId && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Disc className="size-3 text-orange-500" />
                <span className="text-muted-foreground">Album:</span>
                <span className="font-medium">Đã chọn</span>
                <button
                  onClick={() => removeFilter("albumId")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Genre Tag */}
            {params.genreId && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Tag className="size-3 text-emerald-500" />
                <span className="text-muted-foreground">Thể loại:</span>
                <span className="font-medium">Đã chọn</span>
                <button
                  onClick={() => removeFilter("genreId")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto font-medium"
            >
              <Trash2 className="size-3 mr-1.5" /> Xóa bộ lọc
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
export default TrackFilters;
