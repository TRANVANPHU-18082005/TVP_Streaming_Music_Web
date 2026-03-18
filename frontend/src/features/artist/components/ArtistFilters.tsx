import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  ShieldCheck,
  Globe,
  Music2,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  UserCheck,
  UserX,
  ListFilter,
} from "lucide-react";
import { ArtistFilterParams } from "@/features/artist/types";
import { useDebounce } from "@/hooks/useDebounce";

// Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
import { NationalitySelector } from "@/components/ui/NationalitySelector";
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

interface ArtistFiltersProps {
  params: ArtistFilterParams;
  // 🔥 UPDATE: Sử dụng callback thay vì setParams trực tiếp để nhất quán
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof ArtistFilterParams, value: any) => void;
  onReset: () => void;
}

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Popular", value: "popular" },
  { label: "Followers", value: "followers" },
  { label: "A-Z", value: "name" },
] as const;

export const ArtistFilters: React.FC<ArtistFiltersProps> = ({
  params,
  onSearch,
  onFilterChange,
  onReset,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);
  console.log("params in ArtistFilters:", params);
  // --- 1. Search Logic ---
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

  // 🔥 Fix Overflow Animation
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => setOverflowVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setOverflowVisible(false);
    }
  }, [isExpanded]);

  // --- 2. Active Count ---
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (params.genreId) count++;
    if (params.nationality) count++;
    if (params.isVerified !== undefined) count++;
    if (params.isActive !== undefined) count++;
    return count;
  }, [params]);

  const removeFilter = (key: keyof ArtistFilterParams) => {
    onFilterChange(key, undefined);
  };

  return (
    <div className="w-full mb-8">
      {/* CONTAINER: Block Design */}
      <div className="bg-card border border-border rounded-xl shadow-sm transition-all overflow-hidden">
        {/* --- HEADER --- */}
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card">
          {/* 1. Search Input */}
          <div className="relative w-full md:flex-1 md:max-w-xl group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="size-4" />
            </div>
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search artists..."
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

          {/* 2. Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto md:justify-end">
            <Select
              value={params.sort || "newest"}
              onValueChange={(val) => onFilterChange("sort", val)}
            >
              <SelectTrigger className="h-10 w-full md:w-[160px] bg-background border-input shadow-sm hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <ListFilter className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                    Sort:
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
              {/* 1. Nationality */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Globe className="size-3" /> Nationality
                </label>
                <FilterDropdown
                  isActive={!!params.nationality}
                  onClear={() => onFilterChange("nationality", undefined)}
                  label={
                    <span className="truncate">
                      {params.nationality
                        ? `Selected: ${params.nationality}`
                        : "All Countries"}
                    </span>
                  }
                  contentClassName="w-[280px]"
                  className="w-full bg-background h-9 text-sm font-normal px-3 justify-start shadow-sm focus:ring-1"
                >
                  <div className="p-1">
                    <NationalitySelector
                      value={params.nationality}
                      onChange={(val) => onFilterChange("nationality", val)}
                      clearable={true}
                      // autoDetect={false} (Mặc định là false rồi, không cần truyền)
                    />
                  </div>
                </FilterDropdown>
              </div>

              {/* 2. Genre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <Music2 className="size-3" /> Genre
                </label>
                <FilterDropdown
                  isActive={!!params.genreId}
                  onClear={() => onFilterChange("genreId", undefined)}
                  label={
                    <span className="truncate">
                      {params.genreId ? "Filtered" : "Select Genre"}
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
                      value={params.genreId}
                      // 2. OnChange: Nhận về string ID hoặc undefined
                      onChange={(val) => {
                        // val ở đây là một string ID (vd: "65a...") hoặc undefined
                        onFilterChange("genreId", val);
                      }}
                      placeholder="Tìm kiếm thể loại..."
                    />
                  </div>
                </FilterDropdown>
              </div>

              {/* 3. Account Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <LayoutGrid className="size-3" /> Status
                </label>
                <Select
                  value={
                    params.isActive === undefined
                      ? "all"
                      : String(params.isActive)
                  }
                  onValueChange={(val) => {
                    const value = val === "all" ? undefined : val === "true";
                    onFilterChange("isActive", value);
                  }}
                >
                  <SelectTrigger className="w-full bg-background h-9 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive/Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Verification */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <ShieldCheck className="size-3" /> Verification
                </label>
                <Select
                  value={
                    params.isVerified === undefined
                      ? "all"
                      : String(params.isVerified)
                  }
                  onValueChange={(val) => {
                    const value = val === "all" ? undefined : val === "true";
                    onFilterChange("isVerified", value);
                  }}
                >
                  <SelectTrigger className="w-full bg-background h-9 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="All Profiles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Profiles</SelectItem>
                    <SelectItem value="true">Verified Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* --- ACTIVE TAGS --- */}
        {activeFiltersCount > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Active:
            </span>

            {/* Tags */}
            {params.nationality && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Globe className="size-3 text-blue-500" />
                <span className="text-muted-foreground">Nation:</span>
                <span className="font-medium">{params.nationality}</span>
                <button
                  onClick={() => removeFilter("nationality")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {params.genreId && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <Music2 className="size-3 text-pink-500" />
                <span className="text-muted-foreground">Genre:</span>
                <span className="font-medium">Selected</span>
                <button
                  onClick={() => removeFilter("genreId")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {params.isVerified !== undefined && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <ShieldCheck className="size-3 text-emerald-500" />
                <span className="font-medium">Verified Only</span>
                <button
                  onClick={() => removeFilter("isVerified")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {params.isActive !== undefined && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                {params.isActive ? (
                  <UserCheck className="size-3 text-green-500" />
                ) : (
                  <UserX className="size-3 text-red-500" />
                )}
                <span className="font-medium">
                  {params.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => removeFilter("isActive")}
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
              <Trash2 className="size-3 mr-1.5" /> Clear All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
export default ArtistFilters;
