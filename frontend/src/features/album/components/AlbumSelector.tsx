import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
} from "react";
import { Search, Disc, Check, X, Loader2, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAlbumsQuery } from "@/features/album/hooks/useAlbumsQuery";
import { IAlbum } from "../types";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { APP_CONFIG } from "@/config/constants";

// ─── Debounce Hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── AlbumItem (React.memo) ───────────────────────────────────────────────────
interface AlbumItemProps {
  album: IAlbum;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const AlbumItem = memo(({ album, isSelected, onToggle }: AlbumItemProps) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onToggle(album._id);
      }}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all duration-150",
        isSelected
          ? "bg-primary/10 border-primary/20 text-foreground shadow-sm"
          : "bg-transparent border-transparent hover:bg-secondary hover:text-secondary-foreground",
      )}
    >
      {/* Cover Image */}
      <div
        className={cn(
          "size-10 rounded-md overflow-hidden shrink-0 border bg-muted",
          isSelected ? "border-primary/30" : "border-border",
        )}
      >
        {album.coverImage ? (
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="size-4 text-muted-foreground" />
          </div>
        )}
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
        <div className="bg-primary/20 p-1 rounded-full shrink-0">
          <Check className="size-3.5 text-primary stroke-[3]" />
        </div>
      )}
    </div>
  );
});
AlbumItem.displayName = "AlbumItem";

// ─── AlbumSelector ────────────────────────────────────────────────────────────
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
  const [inputValue, setInputValue] = useState("");
  const debouncedFilter = useDebounce(inputValue, 350);

  // Server-side search: truyền keyword vào query thay vì filter client-side
  const { data, isLoading } = useAlbumsQuery({
    limit: APP_CONFIG.SELECTOR_LIMIT,
    isPublic: true,
    keyword: debouncedFilter || undefined,
  });

  const albums: IAlbum[] = useMemo(() => data?.albums || [], [data?.albums]);

  // Lấy thông tin selectedAlbum — fetch riêng nếu không có trong danh sách hiện tại
  const selectedAlbumInList = useMemo(
    () => albums.find((a) => a._id === value),
    [albums, value],
  );

  // Dùng ref để giữ title của album đã chọn kể cả khi nó không còn trong list
  const selectedTitleRef = useRef<string>("");
  useEffect(() => {
    if (selectedAlbumInList) {
      selectedTitleRef.current = selectedAlbumInList.title;
    }
  }, [selectedAlbumInList]);

  const handleToggle = useCallback(
    (id: string) => {
      onChange(value === id ? "" : id);
    },
    [value, onChange],
  );

  const handleClearFilter = useCallback(() => setInputValue(""), []);
  const handleClearValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
    },
    [onChange],
  );

  const displayTitle =
    selectedAlbumInList?.title ||
    (selectedTitleRef.current
      ? selectedTitleRef.current
      : value
        ? `ID: ...${value.slice(-4)}`
        : "");

  return (
    <div className="space-y-3 w-full">
      {/* Header */}
      <div className="flex justify-between items-end">
        {label && (
          <label
            className={cn(
              "text-xs font-bold uppercase flex gap-1.5 items-center tracking-wider text-foreground/80",
              error && "text-destructive",
            )}
          >
            <Disc className="size-4" /> {label}
            {required && <span className="text-destructive text-sm">*</span>}
          </label>
        )}

        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearValue}
            className="h-7 px-3 text-[10px] font-semibold bg-background border-input hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 gap-2 transition-all shadow-sm"
          >
            <span className="truncate max-w-[150px]">{displayTitle}</span>
            <X className="size-3 shrink-0" />
          </Button>
        )}
      </div>

      {/* Main Container — focus-within highlight */}
      <div
        className={cn(
          "p-3 border border-input rounded-xl bg-background shadow-sm space-y-3 transition-all duration-200",
          "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-md",
          error &&
            "border-destructive ring-1 ring-destructive/20 bg-destructive/5 focus-within:border-destructive focus-within:ring-destructive/20",
        )}
      >
        {/* Search Input */}
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-150" />
          <Input
            placeholder="Search albums..."
            className="pl-9 pr-8 h-9 text-sm bg-background border-input focus-visible:ring-2 focus-visible:ring-primary/20"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Loading spinner trong search khi đang debounce/fetching */}
          {isLoading && debouncedFilter ? (
            <Loader2 className="absolute right-2.5 top-2.5 size-3.5 animate-spin text-muted-foreground" />
          ) : inputValue ? (
            <button
              type="button"
              onClick={handleClearFilter}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted transition-all"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* List */}
        <div className="max-h-52 overflow-y-auto custom-scrollbar pr-1 -mr-1">
          {isLoading && !debouncedFilter ? (
            // Initial load skeleton
            <div className="py-8 flex justify-center items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> Loading
              albums...
            </div>
          ) : albums.length > 0 ? (
            <div className="space-y-1.5">
              {albums.map((album) => (
                <AlbumItem
                  key={album._id}
                  album={album}
                  isSelected={value === album._id}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs font-bold text-foreground">
                No albums found
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {debouncedFilter
                  ? `No results for "${debouncedFilter}"`
                  : "Try adjusting your search"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-destructive animate-in slide-in-from-left-1">
          <span className="text-[11px] font-bold">{error}</span>
        </div>
      )}
    </div>
  );
};

export default AlbumSelector;
