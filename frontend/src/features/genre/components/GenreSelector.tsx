import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  X,
  CornerDownRight,
  Loader2,
  FolderOpen,
  Folder,
  ListFilter,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenreTreeQuery } from "@/features/genre/hooks/useGenresQuery";
import type { Genre } from "@/features/genre/types";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// --- Helper Types ---
type GenreNode = Genre & {
  level: number;
  isDisabled: boolean;
  hasChildren: boolean;
};

// --- Helper Logic Build Tree ---
const buildFlatTree = (
  items: Genre[],
  excludeIds: string[] = [],
  parentId: string | null = null,
  level = 0,
): GenreNode[] => {
  const result: GenreNode[] = [];
  const children = items
    .filter((item) => {
      const itemParentId =
        typeof item.parentId === "object" && item.parentId
          ? (item.parentId as any)._id
          : item.parentId;
      return (itemParentId || null) === parentId;
    })
    .sort((a, b) => (a.priority > b.priority ? -1 : 1));

  for (const child of children) {
    if (excludeIds.includes(child._id)) continue;
    const hasChildren = items.some((i) => {
      const pId =
        typeof i.parentId === "object" && i.parentId
          ? (i.parentId as any)._id
          : i.parentId;
      return (pId || null) === child._id;
    });

    result.push({ ...child, level, isDisabled: false, hasChildren });
    const grandChildren = buildFlatTree(
      items,
      excludeIds,
      child._id,
      level + 1,
    );
    result.push(...grandChildren);
  }
  return result;
};

// --- Props ---
interface GenreSelectorProps {
  label?: string;
  required?: boolean;
  error?: string;
  // 🔥 FIX: Hỗ trợ cả mảng (Multi) và đơn (Single)
  value: string | string[] | undefined | null;
  // 🔥 FIX: Callback trả về đúng kiểu
  onChange: (val: any) => void;

  singleSelect?: boolean;
  excludeIds?: string[];
  className?: string;
  placeholder?: string;
  // 🔥 FIX: Thêm variant để phân biệt UI Form/Filter
  variant?: "form" | "filter";
}

export const GenreSelector: React.FC<GenreSelectorProps> = ({
  label,
  required,
  error,
  value,
  onChange,
  singleSelect = false,
  excludeIds = [],
  className,
  placeholder = "Chọn thể loại...",
  variant = "form",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: genres, isLoading } = useGenreTreeQuery();

  // Chuẩn hóa value đầu vào thành mảng để dễ kiểm tra
  const selectedIds = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  }, [value]);

  // Xử lý Tree Data
  const displayGenres = useMemo(() => {
    if (!genres) return [];
    if (searchTerm) {
      return genres
        .filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .map((g) => ({
          ...g,
          level: 0,
          isDisabled: false,
          hasChildren: false,
        }));
    }
    return buildFlatTree(genres, excludeIds);
  }, [genres, searchTerm, excludeIds]);

  // 🔥 CORE LOGIC: Toggle Selection
  const handleSelect = (id: string | null | undefined) => {
    // Case 1: Single Select (Dùng cho Filter hoặc chọn Parent)
    if (singleSelect) {
      // Nếu click lại cái đang chọn -> Bỏ chọn (undefined)
      if (id === value) {
        onChange(undefined);
      } else {
        onChange(id);
      }
      return;
    }

    // Case 2: Multi Select (Dùng cho gán Genre vào Track)
    if (!id) return; // Multi không chọn root/null
    const currentIds = selectedIds;
    const isSelected = currentIds.includes(id);

    onChange(
      isSelected
        ? currentIds.filter((item) => item !== id)
        : [...currentIds, id],
    );
  };

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {label && (
        <Label className="text-xs font-bold uppercase text-foreground/80 tracking-wider flex items-center gap-1.5 ml-0.5">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div
        className={cn(
          "border border-input rounded-sm bg-background shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20",
          error && "border-destructive focus-within:ring-destructive/20",
        )}
      >
        {/* Search */}
        <div className="relative border-b border-border/50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            className="w-full h-10 pl-9 pr-4 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
          {isLoading ? (
            <div className="py-8 text-center flex justify-center items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* --- SPECIAL OPTIONS (Chỉ hiện khi không search) --- */}
              {!searchTerm && (
                <>
                  {/* Option: ALL (Cho Filter) */}
                  {variant === "filter" && (
                    <div
                      onClick={() => handleSelect(undefined)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer text-sm transition-colors select-none",
                        value === undefined
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <ListFilter className="size-3.5 opacity-70" />
                      <span className="flex-1">Tất cả cấp bậc</span>
                      {value === undefined && <Check className="size-4" />}
                    </div>
                  )}

                  {/* Option: ROOT ONLY (Cho Filter = "root", Cho Form = null) */}
                  {(variant === "filter" || variant === "form") && (
                    <div
                      onClick={() =>
                        handleSelect(variant === "filter" ? "root" : null)
                      }
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer text-sm transition-colors select-none",
                        value === (variant === "filter" ? "root" : null)
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50",
                      )}
                    >
                      {variant === "filter" ? (
                        <FolderOpen className="size-3.5 text-purple-500" />
                      ) : (
                        <Layers className="size-3.5 text-primary" />
                      )}
                      <span className="flex-1">
                        {variant === "filter"
                          ? "Chỉ danh mục gốc"
                          : "Gốc (Không có cha)"}
                      </span>
                      {value === (variant === "filter" ? "root" : null) && (
                        <Check className="size-4" />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* --- GENRE LIST --- */}
              {displayGenres.map((genre) => {
                const isSelected = selectedIds.includes(genre._id);
                return (
                  <div
                    key={genre._id}
                    onClick={() => handleSelect(genre._id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer text-sm transition-colors select-none group",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50 text-foreground",
                    )}
                    style={{
                      paddingLeft: searchTerm
                        ? "12px"
                        : `${12 + genre.level * 20}px`,
                    }}
                  >
                    {!searchTerm && (
                      <span className="text-muted-foreground/40 shrink-0">
                        {genre.level === 0 ? (
                          genre.hasChildren ? (
                            <FolderOpen className="size-3.5" />
                          ) : (
                            <Folder className="size-3.5" />
                          )
                        ) : (
                          <CornerDownRight className="size-3.5" />
                        )}
                      </span>
                    )}
                    <div className="flex-1 flex items-center gap-2 truncate">
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: genre.color || "#ccc" }}
                      />
                      <span className="truncate">{genre.name}</span>
                    </div>
                    {isSelected && <Check className="size-4 shrink-0" />}
                  </div>
                );
              })}

              {displayGenres.length === 0 && !isLoading && (
                <div className="py-8 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Không tìm thấy kết quả
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Tags (Chỉ cho Multi-select Form) */}
      {!singleSelect && selectedIds.length > 0 && genres && (
        <div className="flex flex-wrap gap-2 animate-in fade-in zoom-in-95 duration-200">
          {selectedIds.map((id) => {
            const g = genres.find((item) => item._id === id);
            if (!g) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="pl-2.5 pr-1 py-0.5 h-7 text-xs border bg-background hover:bg-muted transition-colors flex items-center gap-1.5"
                style={{ borderColor: g.color ? `${g.color}40` : undefined }}
              >
                {g.name}
                <button
                  type="button"
                  onClick={() => handleSelect(id)}
                  className="size-4 rounded-full hover:bg-destructive hover:text-white flex items-center justify-center transition-colors ml-1"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-[11px] font-bold text-destructive animate-in slide-in-from-left-1">
          {error}
        </p>
      )}
    </div>
  );
};
export default GenreSelector;
