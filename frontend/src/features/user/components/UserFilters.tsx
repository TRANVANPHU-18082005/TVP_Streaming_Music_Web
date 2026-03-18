import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  ShieldCheck,
  UserCog,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  ListFilter,
  Trash2,
  UserCheck,
  UserX,
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

import { type UserFilterParams } from "@/features/user/types";
import { useDebounce } from "@/hooks/useDebounce";

interface UserFiltersProps {
  params: UserFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (key: keyof UserFilterParams, value: any) => void;
  onReset: () => void;
}

// Đồng bộ SORT_OPTIONS khớp chính xác với getUsersSchema của Zod
const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Phổ biến", value: "popular" },
  { label: "Tên (A-Z)", value: "name" },
] as const;

export const UserFilters: React.FC<UserFiltersProps> = ({
  params,
  onSearch,
  onFilterChange,
  onReset,
}) => {
  // --- 1. UI STATE ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);

  // --- 2. SEARCH LOGIC ---
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

  // 🔥 FIX LỖI CLEAR SEARCH: Bỏ onSearch("") trực tiếp đi
  const handleClearSearch = () => {
    setLocalSearch(""); // Debounce sẽ tự động gọi onSearch("") sau 400ms, đảm bảo UI mượt và không đụng state
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
    if (params.role && params.role !== "all") count++;
    if (params.isActive !== undefined) count++;
    if (params.isVerified !== undefined) count++;
    return count;
  }, [params]);

  const removeFilter = (key: keyof UserFilterParams) => {
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
              placeholder="Tìm kiếm theo Tên, Username hoặc Email..."
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

          {/* Actions Group */}
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
              overflowVisible ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              {/* 1. Role Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <UserCog className="size-3" /> Phân quyền
                </label>
                <Select
                  value={params.role || "all"}
                  onValueChange={(val) =>
                    onFilterChange("role", val === "all" ? undefined : val)
                  }
                >
                  <SelectTrigger className="w-full bg-background h-10 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="Tất cả phân quyền" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả phân quyền</SelectItem>
                    <SelectItem value="user">Người dùng (User)</SelectItem>
                    <SelectItem value="artist">Nghệ sĩ (Artist)</SelectItem>
                    <SelectItem value="admin">Quản trị viên (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Status Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <LayoutGrid className="size-3" /> Trạng thái
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
                  <SelectTrigger className="w-full bg-background h-10 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    <SelectItem value="true">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-emerald-500" />
                        Đang hoạt động
                      </div>
                    </SelectItem>
                    <SelectItem value="false">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-destructive" />
                        Bị khóa (Banned)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Verification Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest flex items-center gap-1.5 ml-1">
                  <ShieldCheck className="size-3" /> Xác thực
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
                  <SelectTrigger className="w-full bg-background h-10 text-sm shadow-sm focus:ring-1">
                    <SelectValue placeholder="Tất cả hồ sơ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả hồ sơ</SelectItem>
                    <SelectItem value="true">
                      Đã xác thực (Tích xanh)
                    </SelectItem>
                    <SelectItem value="false">Chưa xác thực</SelectItem>
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

            {/* Role Tag */}
            {params.role && params.role !== "all" && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <UserCog className="size-3 text-purple-500" />
                <span className="text-muted-foreground">Quyền:</span>
                <span className="font-medium capitalize">{params.role}</span>
                <button
                  type="button"
                  onClick={() => removeFilter("role")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Status Tag */}
            {params.isActive !== undefined && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                {params.isActive ? (
                  <UserCheck className="size-3 text-emerald-500" />
                ) : (
                  <UserX className="size-3 text-destructive" />
                )}
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="font-medium">
                  {params.isActive ? "Hoạt động" : "Bị khóa"}
                </span>
                <button
                  type="button"
                  onClick={() => removeFilter("isActive")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Verification Tag */}
            {params.isVerified !== undefined && (
              <Badge
                variant="secondary"
                className="h-7 pl-2 pr-1 gap-1.5 bg-background border border-border hover:bg-accent cursor-default"
              >
                <ShieldCheck
                  className={cn(
                    "size-3",
                    params.isVerified
                      ? "text-blue-500"
                      : "text-muted-foreground",
                  )}
                />
                <span className="font-medium">
                  {params.isVerified ? "Đã có tích xanh" : "Chưa xác thực"}
                </span>
                <button
                  type="button"
                  onClick={() => removeFilter("isVerified")}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            <Button
              type="button"
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
export default UserFilters;
