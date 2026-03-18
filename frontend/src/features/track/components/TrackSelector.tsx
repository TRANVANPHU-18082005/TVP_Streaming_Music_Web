import React, { useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Search,
  Music,
  X,
  Loader2,
  Disc,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/utils/track-helper";
import { ITrack } from "@/features/track/types";
import { useAdminTracks } from "@/features/track/hooks/useTracksQuery";

interface TrackSelectorProps {
  value?: string | string[]; // ID đơn hoặc mảng ID
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  className?: string;
}

export const TrackSelector: React.FC<TrackSelectorProps> = ({
  value,
  onChange,
  multiple = false,
  disabled = false,
  placeholder = "Chọn bài hát...",
  error,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  // --- 1. API SEARCH ---
  // Gọi API search tracks (Lấy danh sách gợi ý)
  const { data, isLoading } = useAdminTracks({
    page: 1,
    limit: 20,
    keyword: debouncedSearch,
    status: "ready", // Chỉ lấy bài đã ready
  });

  const tracks = data?.tracks || [];

  // --- 2. SELECTED ITEMS LOGIC ---
  // Để hiển thị đúng các bài đã chọn (khi search term thay đổi làm mất track trong list),
  // ta cần một state phụ hoặc logic để fetch chi tiết các bài đã chọn.
  // Ở đây để đơn giản, ta giả định list `tracks` trả về hoặc danh sách `selectedTracks`
  // được quản lý ở form cha hoặc cache.
  // Trong thực tế production, bạn nên có thêm logic: "Nếu có value nhưng không có trong list tracks, gọi API lấy detail bài đó".

  // Helper check selected
  const isSelected = (trackId: string) => {
    if (Array.isArray(value)) return value.includes(trackId);
    return value === trackId;
  };

  // Handler select
  const handleSelect = (track: ITrack) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(track._id)
        ? currentValues.filter((id) => id !== track._id) // Remove
        : [...currentValues, track._id]; // Add
      onChange(newValues);
    } else {
      onChange(track._id);
      setOpen(false);
    }
  };

  // Handler remove tag (Multi mode)
  const handleRemoveTag = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation();
    if (Array.isArray(value)) {
      onChange(value.filter((id) => id !== idToRemove));
    }
  };

  // --- 3. RENDER ---
  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between min-h-[44px] h-auto px-3 py-2 text-left font-normal hover:bg-background",
              !value || (Array.isArray(value) && value.length === 0)
                ? "text-muted-foreground"
                : "text-foreground",
              error && "border-destructive ring-destructive/20",
            )}
          >
            <div className="flex flex-wrap gap-2 items-center w-full overflow-hidden">
              {/* --- DISPLAY SELECTED VALUE --- */}
              {!value || (Array.isArray(value) && value.length === 0) ? (
                <span className="flex items-center gap-2">
                  <Search className="size-4 opacity-50" />
                  {placeholder}
                </span>
              ) : multiple && Array.isArray(value) ? (
                // MULTI SELECT VIEW (Tags)
                <div className="flex flex-wrap gap-1.5 w-full">
                  {value.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1.5 h-6"
                    >
                      {value.length} selected
                    </Badge>
                  )}
                  {/* Note: Ở đây chỉ hiện số lượng để gọn. 
                      Nếu muốn hiện tên, cần map ID sang Track Object từ cache */}
                </div>
              ) : (
                // SINGLE SELECT VIEW
                <span className="truncate font-medium">
                  {/* Tìm track trong list hiện tại để hiện tên, nếu không thấy hiện ID (hoặc text fallback) */}
                  {tracks.find((t: ITrack) => t._id === value)?.title ||
                    "Selected Track"}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {/* --- DROPDOWN CONTENT --- */}
        <PopoverContent className="p-0 w-[400px] sm:w-[500px]" align="start">
          <Command shouldFilter={false}>
            {/* shouldFilter={false} là QUAN TRỌNG vì ta filter server-side */}

            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Tìm tên bài hát, nghệ sĩ..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="h-11"
              />
              {isLoading && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />
              )}
            </div>

            <CommandList>
              {/* Empty State */}
              {!isLoading && tracks.length === 0 && (
                <CommandEmpty className="py-6 text-center text-muted-foreground text-sm">
                  Không tìm thấy bài hát nào.
                </CommandEmpty>
              )}

              <CommandGroup>
                <ScrollArea className="h-[300px]">
                  {tracks.map((track: ITrack) => {
                    const active = isSelected(track._id);
                    return (
                      <CommandItem
                        key={track._id}
                        value={track._id} // Value cho command item
                        onSelect={() => handleSelect(track)}
                        className="cursor-pointer aria-selected:bg-accent/50"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {/* Check Icon */}
                          <div
                            className={cn(
                              "flex items-center justify-center w-4 h-4 border rounded-sm transition-all",
                              active
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30 opacity-50",
                            )}
                          >
                            {active && <Check className="w-3 h-3" />}
                          </div>

                          {/* Track Image */}
                          <div className="relative size-10 rounded overflow-hidden bg-muted shrink-0 border border-border">
                            {track.coverImage ? (
                              <img
                                src={track.coverImage}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-5 h-5 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>

                          {/* Track Info */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-sm truncate">
                              {track.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <span className="truncate max-w-[150px]">
                                {track.artist?.name || "Unknown"}
                              </span>
                              <span>•</span>
                              <span className="font-mono">
                                {formatDuration(track.duration)}
                              </span>
                            </div>
                          </div>

                          {/* Album Hint (Optional) */}
                          {track.album && (
                            <Badge
                              variant="outline"
                              className="hidden sm:flex text-[10px] h-5 px-1.5 max-w-[100px] truncate text-muted-foreground/70"
                            >
                              <Disc className="w-3 h-3 mr-1" />
                              {track.album.title}
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Error Message */}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      {/* --- SELECTED LIST PREVIEW (Chỉ hiện khi Multi-select) --- */}
      {multiple && Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Lưu ý: Để hiển thị đúng list này, bạn cần fetch tracks dựa trên list ID `value`. 
                Nếu data trong popover thay đổi do search, bạn sẽ mất thông tin track đã chọn để hiển thị ở đây.
                Trong production, component này nên nhận thêm prop `selectedTracksData` (mảng object) thay vì chỉ `value` (mảng ID),
                hoặc dùng một hook riêng để fetch detail các bài đã chọn. */}

          {/* Demo hiển thị dạng ID (Trong thực tế thay bằng Track Card nhỏ) */}
          {value.map((id, idx) => (
            <div
              key={id}
              className="flex items-center gap-2 bg-card border rounded-full pl-1 pr-3 py-1 text-xs animate-in fade-in zoom-in"
            >
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {idx + 1}
              </div>
              <span className="max-w-[100px] truncate font-medium">
                Track ID: ...{id.slice(-6)}
              </span>
              <button
                type="button"
                onClick={(e) => handleRemoveTag(e, id)}
                className="ml-1 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default TrackSelector;
