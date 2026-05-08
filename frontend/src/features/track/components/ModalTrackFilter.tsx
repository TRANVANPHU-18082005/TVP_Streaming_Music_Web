import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Search,
  XCircle,
  ListFilter,
  Mic2,
  Music,
  FilterX,
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

export const ModalTrackFilter: React.FC<ModalTrackFilterProps> = ({
  params,
  onChange,
  className,
}) => {
  // --- LOCAL SEARCH LOGIC ---
  const [localSearch, setLocalSearch] = useState(params.keyword || "");
  const debouncedSearch = useDebounce(localSearch, 400);

  // Sync từ local lên cha (Khi người dùng gõ)
  useEffect(() => {
    // Chỉ trigger onChange nếu thực sự có sự khác biệt (tránh loop)
    if (debouncedSearch !== (params.keyword || "")) {
      onChange((prev) => ({
        ...prev,
        keyword: debouncedSearch || undefined,
        page: 1,
      }));
    }
  }, [debouncedSearch, onChange, params.keyword]);

  // Sync từ cha xuống local (Dành cho trường hợp Clear All từ bên ngoài)
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
    onChange({ sort: "newest", page: 1 }); // Reset toàn bộ, chỉ giữ lại sort mặc định
  };

  const currentSort = params.sort || "newest";

  // Tính toán xem có đang dùng bộ lọc nào không (để hiện nút Clear All)
  const isFiltering =
    !!params.artistId || !!params.genreId || currentSort !== "newest";

  return (
    <div className={cn("w-full space-y-3.5", className)}>
      {/* ================= 1. THANH TÌM KIẾM CHÍNH ================= */}
      <div className="relative w-full group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-300 group-focus-within:text-primary z-10">
          <Search className="size-4 sm:size-4.5" />
        </div>
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Tìm tên bài hát, ca sĩ..."
          autoComplete="off"
          spellCheck="false"
          // UI Nâng cấp: Bóng đổ tinh tế, viền focus sáng lên từ từ
          className="pl-10 sm:pl-11 pr-10 h-11 sm:h-12 rounded-xl bg-card border-border/50 shadow-sm focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-300 text-[14px] font-semibold placeholder:font-medium placeholder:text-muted-foreground/60"
        />

        {/* Nút Xóa Search (Chỉ hiện khi có chữ, kèm hiệu ứng Fade-in) */}
        {localSearch && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-all duration-200 z-10 animate-in fade-in zoom-in-95"
          >
            <XCircle className="size-4.5 sm:size-5" />
          </button>
        )}
      </div>

      {/* ================= 2. BỘ LỌC NHANH (VUỐT NGANG) ================= */}
      {/* Thêm pr-6 để chừa khoảng trống bên phải, giúp người dùng mobile biết có thể vuốt tiếp */}
      <div className="flex items-center gap-2 w-full overflow-x-auto pb-2 pt-0.5 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
        {/* A. Sắp xếp (Sort Pill) */}
        <Select
          value={currentSort}
          onValueChange={(val) => updateFilter("sort", val)}
        >
          <SelectTrigger
            className={cn(
              "h-9 sm:h-10 rounded-[10px] px-3 sm:px-4 text-[12px] sm:text-[13px] transition-all duration-200 shrink-0 w-fit border shadow-sm focus:ring-0 focus:ring-offset-0",
              currentSort !== "newest"
                ? "bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15"
                : "bg-card border-border/50 text-foreground/80 font-medium hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <ListFilter
                className={cn(
                  "size-3.5",
                  currentSort !== "newest"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <SelectValue />
            </div>
          </SelectTrigger>

          {/* 🔥 FIX Ở ĐÂY: Thêm z-[9999] để menu nổi lên trên Modal */}
          <SelectContent className="rounded-xl border-border/60 shadow-xl min-w-[140px] z-[9999]">
            {SORT_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[13px] font-bold py-2.5 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* B. Nghệ sĩ (Artist Pill) */}
        <FilterDropdown
          isActive={!!params.artistId}
          onClear={() => updateFilter("artistId", undefined)}
          label={
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Mic2
                className={cn(
                  "size-3.5",
                  params.artistId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>{params.artistId ? "Đã chọn nghệ sĩ" : "Nghệ sĩ"}</span>
            </div>
          }
          contentClassName="w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-9 sm:h-10 rounded-[10px] px-3 sm:px-4 text-[12px] sm:text-[13px] transition-all duration-200 shrink-0 border shadow-sm",
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
        {/* C. Album */}
        <FilterDropdown
          isActive={!!params.albumId}
          onClear={() => updateFilter("albumId", undefined)}
          label={
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Mic2
                className={cn(
                  "size-3.5",
                  params.albumId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>{params.albumId ? "Đã chọn album" : "Album"}</span>
            </div>
          }
          contentClassName="w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-9 sm:h-10 rounded-[10px] px-3 sm:px-4 text-[12px] sm:text-[13px] transition-all duration-200 shrink-0 border shadow-sm",
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

        {/* C. Thể loại (Genre Pill) */}
        <FilterDropdown
          isActive={!!params.genreId}
          onClear={() => updateFilter("genreId", undefined)}
          label={
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Music
                className={cn(
                  "size-3.5",
                  params.genreId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>{params.genreId ? "Đã chọn thể loại" : "Thể loại"}</span>
            </div>
          }
          contentClassName="w-[300px] sm:w-[320px] rounded-2xl shadow-xl border-border/50"
          className={cn(
            "h-9 sm:h-10 rounded-[10px] px-3 sm:px-4 text-[12px] sm:text-[13px] transition-all duration-200 shrink-0 border shadow-sm",
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

        {/* D. Nút Clear All (Chỉ hiện khi đang có bộ lọc) */}
        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-9 sm:h-10 px-3 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[10px] transition-all animate-in fade-in slide-in-from-left-2"
          >
            <FilterX className="size-4 mr-1.5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Xóa bộ lọc
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};
export default ModalTrackFilter;
