import React, { useState, useMemo } from "react";
import { Search, Disc, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Album } from "@/features/album/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAlbumsQuery } from "@/features/album/hooks/useAlbumsQuery";

interface AlbumSelectorProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
}

export const AlbumSelector: React.FC<AlbumSelectorProps> = ({
  value,
  onChange,
  label,
  error,
  required,
}) => {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useAlbumsQuery({ limit: 100 });

  const filteredAlbums = useMemo(() => {
    if (!filter) return data?.albums || [];
    return (
      data?.albums.filter((album: Album) =>
        album.title.toLowerCase().includes(filter.toLowerCase()),
      ) || []
    );
  }, [data, filter]);

  const selectedAlbum = useMemo(() => {
    return data?.albums.find((a: Album) => a._id === value);
  }, [data, value]);

  const handleToggle = (id: string) => {
    onChange(value === id ? "" : id);
  };

  return (
    <div className="space-y-3 w-full">
      {/* Header */}
      <div className="flex justify-between items-end">
        {label && (
          <label
            className={cn(
              // Thay đổi: Tăng độ đậm (foreground/80) thay vì muted
              "text-xs font-bold uppercase flex gap-1.5 items-center tracking-wider text-foreground/80",
              error && "text-destructive",
            )}
          >
            <Disc className="size-4" /> {label}{" "}
            {required && <span className="text-destructive text-sm">*</span>}
          </label>
        )}
        {value && (
          <Button
            type="button"
            variant="outline" // Thay đổi: Dùng outline để rõ ràng hơn
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            // Thay đổi: Badge rõ ràng hơn
            className="h-7 px-3 text-[10px] font-semibold bg-background border-input hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 gap-2 transition-all shadow-sm"
          >
            <span className="truncate max-w-[150px]">
              {selectedAlbum?.title || "ID: " + value.slice(-4)}
            </span>
            <X className="size-3" />
          </Button>
        )}
      </div>

      {/* Main Container */}
      {/* Thay đổi: Nền đặc (bg-background) và viền rõ (border-input) */}
      <div
        className={cn(
          "p-3 border border-input rounded-xl bg-background shadow-sm space-y-3 transition-all",
          error &&
            "border-destructive ring-1 ring-destructive/20 bg-destructive/5",
        )}
      >
        {/* Search Input */}
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search albums..."
            // Thay đổi: Input nền sáng/tối rõ ràng
            className="pl-9 pr-8 h-9 text-sm bg-background border-input focus-visible:ring-2 focus-visible:ring-primary/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted transition-all"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* List Container */}
        <div className="max-h-52 overflow-y-auto custom-scrollbar pr-1 -mr-1">
          {isLoading ? (
            <div className="py-8 flex justify-center items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Loading
              data...
            </div>
          ) : filteredAlbums.length > 0 ? (
            <div className="space-y-1.5">
              {filteredAlbums.map((album: Album) => {
                const isSelected = value === album._id;
                return (
                  <div
                    key={album._id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(album._id);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all",
                      isSelected
                        ? // Thay đổi: Màu nền Primary nhạt + Viền Primary rõ ràng
                          "bg-primary/10 border-primary/20 text-foreground shadow-sm"
                        : "bg-transparent border-transparent hover:bg-secondary hover:text-secondary-foreground",
                    )}
                  >
                    {/* Cover Image */}
                    <div
                      className={cn(
                        "size-10 rounded-md overflow-hidden shrink-0 border",
                        isSelected ? "border-primary/30" : "border-border",
                      )}
                    >
                      <img
                        src={album.coverImage || "/images/default-album.png"}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Text Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p
                        className={cn(
                          "text-xs font-bold truncate leading-tight",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {album.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-medium">
                        {album.artist?.name || "Unknown Artist"}
                      </p>
                    </div>

                    {/* Check Icon */}
                    {isSelected && (
                      <div className="bg-primary/20 p-1 rounded-full">
                        <Check className="size-3.5 text-primary stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs font-bold text-foreground">
                No albums found
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Try adjusting your search
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-1.5 text-destructive animate-in slide-in-from-left-1">
          <span className="text-[11px] font-bold">{error}</span>
        </div>
      )}
    </div>
  );
};
export default AlbumSelector;
