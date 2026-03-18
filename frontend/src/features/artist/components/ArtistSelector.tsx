import React, { useState, useMemo } from "react";
import { Search, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artist } from "@/features/artist/types";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { Label } from "@/components/ui/label";
import { useArtistsQuery } from "@/features/artist/hooks/useArtistsQuery";

interface ArtistSelectorProps {
  label?: string;
  required?: boolean;
  error?: string;
  value: string[] | undefined;
  onChange: (ids: string[]) => void;
  singleSelect?: boolean;
  disabledIds?: string[];
  className?: string;
}

export const ArtistSelector: React.FC<ArtistSelectorProps> = ({
  label,
  required,
  error,
  value = [],
  onChange,
  singleSelect = false,
  disabledIds = [],
  className,
}) => {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useArtistsQuery({ limit: 100 });

  const artists = useMemo(() => data?.artists || [], [data]);

  const filteredArtists = useMemo(() => {
    let result = artists;
    if (filter) {
      result = result.filter((a: Artist) =>
        a.name.toLowerCase().includes(filter.toLowerCase()),
      );
    }
    return result;
  }, [artists, filter]);

  const toggleArtist = (id: string) => {
    if (disabledIds.includes(id)) return;
    if (singleSelect) {
      const isSelected = value?.includes(id);
      onChange(isSelected ? [] : [id]);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    const newValues = current.includes(id)
      ? current.filter((aId) => aId !== id)
      : [...current, id];
    onChange(newValues);
  };

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* --- LABEL --- */}
      {label && (
        <Label className="text-xs font-bold uppercase text-foreground/80 tracking-wider flex items-center gap-1.5 ml-0.5">
          {label}{" "}
          {required && <span className="text-destructive text-sm">*</span>}
        </Label>
      )}

      {/* --- SEARCH --- */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          placeholder="Tìm nghệ sĩ..."
          className={cn(
            "pl-9 pr-8 h-10 text-sm bg-background border-input shadow-sm rounded-sm focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
            error &&
              "border-destructive focus-visible:ring-destructive/20 bg-destructive/5",
          )}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* --- LIST --- */}
      {/* Thay đổi: Khung viền đậm hơn, background sạch */}
      <div
        className={cn(
          "max-h-52 overflow-y-auto custom-scrollbar pr-1 border border-border shadow-sm rounded-sm bg-background",
          error &&
            "border-destructive focus-visible:ring-destructive/20 bg-destructive/5",
        )}
      >
        {isLoading ? (
          <div className="flex justify-center items-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-primary" /> Đang tải
            danh sách...
          </div>
        ) : filteredArtists.length > 0 ? (
          <div className="p-1.5 space-y-1">
            {filteredArtists.map((artist: Artist) => {
              const isSelected =
                Array.isArray(value) && value.includes(artist._id);
              const isDisabled = disabledIds.includes(artist._id);

              return (
                <div
                  key={artist._id}
                  onClick={() => !isDisabled && toggleArtist(artist._id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-sm cursor-pointer transition-all border",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed bg-muted/30 border-transparent grayscale"
                      : isSelected
                        ? // Thay đổi: Trạng thái chọn rõ ràng hơn (nền primary nhạt + viền)
                          "bg-primary/10 border-primary/20 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-secondary hover:text-secondary-foreground",
                  )}
                >
                  <Avatar
                    className={cn(
                      "size-8 border shadow-sm",
                      isSelected ? "border-primary/30" : "border-border",
                    )}
                  >
                    <AvatarImage
                      src={artist.avatar}
                      alt={artist.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
                      {getInitialsTextAvartar(artist.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm truncate leading-tight",
                        // Thay đổi: Text đậm hơn, không dùng muted-foreground cho tên
                        isSelected
                          ? "font-bold text-primary"
                          : "font-semibold text-foreground",
                      )}
                    >
                      {artist.name}
                    </p>
                    {/* Có thể thêm sub-text nếu cần, ví dụ Role */}
                    <p className="text-[10px] text-muted-foreground truncate">
                      Artist
                    </p>
                  </div>

                  {isSelected && (
                    <div className="bg-primary/20 p-0.5 rounded-full shrink-0">
                      <Check className="size-3.5 stroke-[3] text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs font-bold text-foreground">
              Không tìm thấy nghệ sĩ
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Thử tìm kiếm từ khóa khác
            </p>
          </div>
        )}
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
export default ArtistSelector;
