import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  TrendingUp,
  FolderTree,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ListFilter,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Shadcn Select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { GenreFilterParams } from "@/features/genre/types";
import { useDebounce } from "@/hooks/useDebounce";

// 🔥 IMPORTS CUSTOM
import { GenreSelector } from "./GenreSelector";
import { useGenreTreeQuery } from "@/features/genre/hooks/useGenresQuery";
import FilterDropdown from "@/components/ui/FilterDropdown";

interface GenreFiltersProps {
  params: GenreFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof GenreFilterParams, value: any) => void;
  onReset: () => void;
}

const SORT_OPTIONS = [
  { label: "Mặc định (Priority)", value: "priority" },
  { label: "Phổ biến nhất", value: "popular" },
  { label: "Tên (A-Z)", value: "name" },
  { label: "Mới nhất", value: "newest" },
] as const;

export const GenreFilters: React.FC<GenreFiltersProps> = ({
  params,
  onSearch,
  onFilterChange,
  onReset,
}) => {
  // --- 1. UI STATE ---
  const [isExpanded, setIsExpanded] = useState(false);
  // State quản lý overflow: 'hidden' khi đang animate, 'visible' khi đã mở xong (để Dropdown đè lên được)
  const [overflowVisible, setOverflowVisible] = useState(false);

  // --- 2. DATA (Lookup tên cho Active Tags) ---
  const { data: genres } = useGenreTreeQuery();
  // --- 3. SEARCH LOGIC ---
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

  const handleClearSearch = () => setLocalSearch("");

  // --- 4. ANIMATION LOGIC ---
  useEffect(() => {
    if (isExpanded) {
      // Khi mở: Đợi animation chạy xong (300ms) rồi mới cho tràn (visible)
      // Để các dropdown như YearPicker không bị cắt
      const timer = setTimeout(() => setOverflowVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      // Khi đóng: Ẩn ngay lập tức để animation đóng mượt mà
      setOverflowVisible(false);
    }
  }, [isExpanded]);

  // --- 5. HELPERS ---

  // Lấy tên hiển thị cho Parent Tag
  const getParentLabel = useMemo(() => {
    if (!params.parentId || params.parentId === "all") return null;
    if (params.parentId === "root") return "Root Only";

    const found = genres?.find((g) => g._id === params.parentId);
    return found ? `Con của: "${found.name}"` : "Danh mục cụ thể";
  }, [params.parentId, genres]);

  // Đếm số lượng filter đang active
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (params.status && params.status !== "all") count++;
    if (params.parentId && params.parentId !== "all") count++;
    if (params.isTrending !== undefined) count++;
    return count;
  }, [params]);

  const removeFilter = (key: keyof GenreFilterParams) => {
    onFilterChange(key, undefined);
  };

  return (
    <div className="w-full mb-8">
      {/* CONTAINER CHÍNH */}
      <div className="bg-card border border-border rounded-xl shadow-sm transition-all">
        {/* ================= HEADER SECTION ================= */}
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Search Bar */}
          <div className="relative w-full md:flex-1 md:max-w-xl group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="size-4" />
            </div>
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm kiếm thể loại..."
              className="pl-9 pr-9 h-10 bg-background border-input shadow-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
            />
            {localSearch && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-3 w-full md:w-auto md:justify-end">
            <Select
              value={params.sort || "priority"}
              onValueChange={(val) => onFilterChange("sort", val)}
            >
              <SelectTrigger className="h-10 w-full md:w-[180px] bg-background border-input shadow-sm hover:bg-accent/50 transition-colors">
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
                <span className="font-medium hidden md:flex">Filter</span>
              </div>
              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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

        {/* ================= EXPANDABLE PANEL ================= */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out border-t border-transparent",
            isExpanded ? "grid-rows-[1fr] border-border" : "grid-rows-[0fr]",
          )}
        >
          <div
            className={cn(
              "bg-muted/30 transition-all",
              // 🔥 Quan trọng: Để dropdown không bị cắt
              overflowVisible ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Status Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Eye className="size-3" /> Trạng thái
                </label>
                <Select
                  value={params.status || "all"}
                  onValueChange={(val) =>
                    onFilterChange("status", val === "all" ? undefined : val)
                  }
                >
                  <SelectTrigger className="w-full bg-background h-9 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="inactive">Đang ẩn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Hierarchy Filter (Using Custom Selector) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <FolderTree className="size-3" /> Cấp bậc
                </label>
                <FilterDropdown
                  isActive={!!params.parentId}
                  onClear={() => onFilterChange("parentId", undefined)}
                  label={
                    <span className="truncate">
                      {params.parentId ? "Filtered" : "Select Genre"}
                    </span>
                  }
                  contentClassName="w-[280px]"
                  className="w-full bg-background h-9 text-sm font-normal px-3 justify-start shadow-sm focus:ring-1"
                >
                  <div className="p-1">
                    <GenreSelector
                      // 🔥 CẤU HÌNH CHO FILTER
                      variant="filter"
                      singleSelect={true}
                      // 1. Value: Chuyển array thành string đơn (nếu params lưu string)
                      value={params.parentId}
                      // 2. OnChange: Nhận về string ID hoặc undefined
                      onChange={(val) => {
                        // val ở đây là một string ID (vd: "65a...") hoặc undefined
                        onFilterChange("parentId", val);
                      }}
                      placeholder="Tìm kiếm thể loại..."
                    />
                  </div>
                </FilterDropdown>
              </div>

              {/* 3. Trending Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <TrendingUp className="size-3" /> Xu hướng
                </label>
                <Select
                  value={
                    params.isTrending === undefined
                      ? "all"
                      : String(params.isTrending)
                  }
                  onValueChange={(val) => {
                    const value = val === "all" ? undefined : val === "true";
                    onFilterChange("isTrending", value);
                  }}
                >
                  <SelectTrigger className="w-full bg-background h-9 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="true">Đang thịnh hành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* ================= ACTIVE TAGS FOOTER ================= */}
        {activeFiltersCount > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex flex-wrap items-center gap-2 rounded-b-xl">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Đang lọc:
            </span>

            {/* Status Tag */}
            {params.status && params.status !== "all" && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Eye className="size-3 text-blue-500" />
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="font-medium capitalize">
                  {params.status === "active" ? "Hoạt động" : "Ẩn"}
                </span>
                <button
                  onClick={() => removeFilter("status")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Hierarchy Tag */}
            {params.parentId && params.parentId !== "all" && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <FolderTree className="size-3 text-purple-500" />
                <span className="text-muted-foreground">Cấp bậc:</span>
                <span className="font-medium max-w-[200px] truncate">
                  {getParentLabel}
                </span>
                <button
                  onClick={() => removeFilter("parentId")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Trending Tag */}
            {params.isTrending !== undefined && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <TrendingUp className="size-3 text-pink-500" />
                <span className="font-medium">Thịnh hành</span>
                <button
                  onClick={() => removeFilter("isTrending")}
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
export default GenreFilters;
