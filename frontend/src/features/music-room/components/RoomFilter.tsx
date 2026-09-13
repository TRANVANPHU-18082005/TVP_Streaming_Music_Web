import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { RoomFilterParams } from "../hooks/useRoomParams";

interface RoomFilterProps {
  params: RoomFilterParams;
  onSearch: (keyword: string) => void;
  onReset: () => void;
}

export const RoomFilter = memo<RoomFilterProps>(({ params, onSearch, onReset }) => {
  const [localSearch, setLocalSearch] = useState(params.q || "");
  const debouncedSearch = useDebounce(localSearch, 400);
  const isClearingRef = useRef(false);

  useEffect(() => {
    if ((params.q || "") === localSearch) return;
    setLocalSearch(params.q || "");
  }, [params.q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isClearingRef.current) {
      isClearingRef.current = false;
      return;
    }
    if (debouncedSearch !== (params.q || "")) onSearch(debouncedSearch);
  }, [debouncedSearch, params.q, onSearch]);

  const handleClearSearch = useCallback(() => {
    isClearingRef.current = true;
    setLocalSearch("");
    onSearch("");
  }, [onSearch]);

  return (
    <div className="w-full">
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-card/50 dark:bg-surface-1/20 backdrop-blur-md",
        "border border-border/50 hover:border-border hover:shadow-elevated transition-all duration-300",
        params.q ? "border-primary/30 shadow-brand" : ""
      )}>
        <div className="flex items-center gap-2.5 p-3">
          <div className="relative flex-1 min-w-0 group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <Search className={cn(
                "size-3.5 transition-colors duration-200",
                localSearch ? "text-primary" : "text-muted-foreground/40 group-focus-within:text-primary/60"
              )} aria-hidden="true" />
            </div>
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm kiếm phòng theo tên hoặc mã..."
              aria-label="Search rooms"
              className={cn(
                "h-10 pl-9 pr-9 text-sm rounded-xl",
                "bg-background/60 border-border/60",
                "hover:border-border focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20",
                "transition-all duration-200"
              )}
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

RoomFilter.displayName = "RoomFilter";
export default RoomFilter;
