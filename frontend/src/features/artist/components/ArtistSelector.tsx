import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  memo,
} from "react";
import { Search, Check, X, Loader2, UserRound } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { Label } from "@/components/ui/label";
import { useArtistsQuery } from "@/features/artist/hooks/useArtistsQuery";
import { IArtist } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_IDS: string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistSelectorProps {
  label?: string;
  required?: boolean;
  error?: string;
  value?: string[];
  onChange: (ids: string[]) => void;
  singleSelect?: boolean;
  disabledIds?: string[];
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST ROW — memoized, keyboard accessible
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistRowProps {
  artist: IArtist;
  isSelected: boolean;
  isDisabled: boolean;
  isFocused: boolean;
  onToggle: (id: string) => void;
  rowRef?: (el: HTMLButtonElement | null) => void;
}

const ArtistRow = memo(
  ({
    artist,
    isSelected,
    isDisabled,
    isFocused,
    onToggle,
    rowRef,
  }: ArtistRowProps) => (
    <button
      ref={rowRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      tabIndex={isFocused ? 0 : -1}
      onClick={() => onToggle(artist._id)}
      className={cn(
        "flex items-center gap-3 w-full text-left p-2 rounded-lg border transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45",
        isDisabled
          ? "opacity-45 cursor-not-allowed bg-muted/25 border-transparent grayscale"
          : isSelected
            ? "bg-primary/10 border-primary/22 shadow-sm cursor-pointer"
            : "bg-transparent border-transparent hover:bg-muted/60 hover:border-border/50 cursor-pointer",
        isFocused &&
          !isSelected &&
          !isDisabled &&
          "bg-muted/60 border-border/50",
      )}
    >
      {/* Avatar */}
      <Avatar
        className={cn(
          "size-8 border shadow-sm shrink-0",
          isSelected ? "border-primary/35" : "border-border",
        )}
      >
        <AvatarImage
          src={artist.avatar}
          alt={artist.name}
          className="object-cover"
          loading="lazy"
          decoding="async"
        />
        <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
          {getInitialsTextAvartar(artist.name)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate leading-snug",
            isSelected
              ? "font-bold text-primary"
              : "font-semibold text-foreground/90",
          )}
        >
          {artist.name}
        </p>
        <p className="text-[10px] text-muted-foreground/55 truncate leading-snug">
          Artist
        </p>
      </div>

      {/* Check */}
      {isSelected && (
        <div
          className="bg-primary/18 p-0.5 rounded-full shrink-0"
          aria-hidden="true"
        >
          <Check className="size-3.5 stroke-[2.5] text-primary" />
        </div>
      )}
    </button>
  ),
);
ArtistRow.displayName = "ArtistRow";

// ─────────────────────────────────────────────────────────────────────────────
// D. SINGLE-SELECT CHIP
// ─────────────────────────────────────────────────────────────────────────────

interface SelectedChipProps {
  artist: IArtist;
  onRemove: () => void;
}

const SelectedChip = memo(({ artist, onRemove }: SelectedChipProps) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/8 shadow-sm">
    <Avatar className="size-6 border border-primary/25 shrink-0">
      <AvatarImage
        src={artist.avatar}
        alt={artist.name}
        className="object-cover"
      />
      <AvatarFallback className="text-[9px] font-bold bg-primary/15 text-primary">
        {getInitialsTextAvartar(artist.name)}
      </AvatarFallback>
    </Avatar>
    <span className="text-xs font-bold text-primary truncate max-w-[160px]">
      {artist.name}
    </span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${artist.name}`}
      className="size-4 rounded-full hover:bg-destructive hover:text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40 shrink-0 ml-0.5"
    >
      <X className="size-2.5" aria-hidden="true" />
    </button>
  </div>
));
SelectedChip.displayName = "SelectedChip";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST SELECTOR — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const ArtistSelector: React.FC<ArtistSelectorProps> = ({
  label,
  required,
  error,
  value = EMPTY_IDS,
  onChange,
  singleSelect = false,
  disabledIds = EMPTY_IDS,
  className,
}) => {
  const [inputValue, setInputValue] = useState("");
  // B. Debounced value → sent to server
  const debouncedSearch = useDebounce(inputValue, 350);

  // B. Server-side search: keyword passed to query
  const { data, isLoading } = useArtistsQuery({
    limit: 50,
    keyword: debouncedSearch || undefined,
  });

  const artists = useMemo<IArtist[]>(() => data?.artists ?? [], [data]);

  // Stable sets for O(1) lookup
  const selectedSet = useMemo(() => new Set(value), [value]);
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);

  // Keep last-seen names of selected artists across search changes (for chips)
  const selectedNamesRef = useRef<Map<string, IArtist>>(new Map());
  useEffect(() => {
    for (const artist of artists) {
      if (selectedSet.has(artist._id)) {
        selectedNamesRef.current.set(artist._id, artist);
      }
    }
  }, [artists, selectedSet]);

  // ── Toggle ───────────────────────────────────────────────────────────────
  const toggleArtist = useCallback(
    (id: string) => {
      if (disabledSet.has(id)) return;
      if (singleSelect) {
        onChange(selectedSet.has(id) ? [] : [id]);
        return;
      }
      onChange(
        selectedSet.has(id)
          ? value.filter((aId) => aId !== id)
          : [...value, id],
      );
    },
    [disabledSet, singleSelect, value, selectedSet, onChange],
  );

  const handleClearFilter = useCallback(() => setInputValue(""), []);

  // ── C. Keyboard navigation ───────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    setFocusedIndex(-1);
  }, [debouncedSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) return;
      e.preventDefault();
      const total = artists.length;
      if (total === 0) return;

      if (e.key === "ArrowDown") {
        setFocusedIndex((prev) => {
          const next = prev < total - 1 ? prev + 1 : 0;
          rowRefs.current.get(next)?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : total - 1;
          rowRefs.current.get(next)?.focus();
          return next;
        });
      } else if ((e.key === "Enter" || e.key === " ") && focusedIndex >= 0) {
        toggleArtist(artists[focusedIndex]._id);
      }
    },
    [artists, focusedIndex, toggleArtist],
  );

  // ── A. Virtual scroll ────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: artists.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // approx row height
    overscan: 5,
  });

  // ── D. Chips data (singleSelect shows 1 chip; multi shows many) ──────────
  const selectedArtistsForChips = useMemo<IArtist[]>(() => {
    return value
      .map((id) => {
        // prefer live data from current list, fallback to cached
        return (
          artists.find((a) => a._id === id) ?? selectedNamesRef.current.get(id)
        );
      })
      .filter((a): a is IArtist => Boolean(a));
  }, [value, artists]);

  return (
    <div className={cn("space-y-2.5 w-full", className)}>
      {/* Label */}
      {label && (
        <Label className="text-[10px] font-bold uppercase text-foreground/75 tracking-wider flex items-center gap-1.5 ml-0.5">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      {/* D. Selected chip(s) displayed above search */}
      {selectedArtistsForChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {singleSelect ? (
            // Single select: one prominent chip
            <SelectedChip
              artist={selectedArtistsForChips[0]}
              onRemove={() => onChange([])}
            />
          ) : (
            // Multi select: badge row
            selectedArtistsForChips.map((artist) => (
              <Badge
                key={artist._id}
                variant="secondary"
                className="pl-1.5 pr-1 py-0.5 h-7 text-[11px] border bg-background hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Avatar className="size-4 shrink-0">
                  <AvatarImage
                    src={artist.avatar}
                    alt={artist.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-[8px] font-bold">
                    {getInitialsTextAvartar(artist.name)}
                  </AvatarFallback>
                </Avatar>
                {artist.name}
                <button
                  type="button"
                  onClick={() => toggleArtist(artist._id)}
                  aria-label={`Remove ${artist.name}`}
                  className="size-4 rounded-full hover:bg-destructive hover:text-white flex items-center justify-center transition-colors ml-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
                >
                  <X className="size-2.5" aria-hidden="true" />
                </button>
              </Badge>
            ))
          )}
        </div>
      )}

      {/* Search input */}
      <div className="relative group">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/55 transition-colors group-focus-within:text-primary pointer-events-none"
          aria-hidden="true"
        />
        <Input
          placeholder="Search artists…"
          aria-label="Search artists"
          className={cn(
            "pl-9 pr-8 h-9 text-sm bg-background border-input shadow-sm",
            "focus-visible:ring-1 focus-visible:ring-primary/30 transition-all",
            error && "border-destructive focus-visible:ring-destructive/20",
          )}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        {/* Spinner during debounce/loading; clear button when idle */}
        {isLoading && debouncedSearch ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground/50" />
        ) : inputValue ? (
          <button
            type="button"
            onClick={handleClearFilter}
            aria-label="Clear artist search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground/55 hover:text-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Artist list — virtualized + keyboard nav */}
      <div
        role="listbox"
        aria-multiselectable={!singleSelect}
        aria-label="Artist options"
        onKeyDown={handleKeyDown}
        className={cn(
          "border border-border shadow-sm rounded-lg bg-background",
          error && "border-destructive",
        )}
      >
        {isLoading && !debouncedSearch ? (
          <div
            role="status"
            aria-live="polite"
            className="flex justify-center items-center py-8 text-xs text-muted-foreground/55 gap-2"
          >
            <Loader2
              className="size-4 animate-spin text-primary/60"
              aria-hidden="true"
            />
            Loading artists…
          </div>
        ) : artists.length > 0 ? (
          /* A. Virtual scroll container */
          <div
            ref={parentRef}
            className="max-h-52 overflow-y-auto scrollbar-thin p-1.5"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const artist = artists[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ArtistRow
                      artist={artist}
                      isSelected={selectedSet.has(artist._id)}
                      isDisabled={disabledSet.has(artist._id)}
                      isFocused={focusedIndex === virtualRow.index}
                      onToggle={toggleArtist}
                      rowRef={(el) => {
                        if (el) rowRefs.current.set(virtualRow.index, el);
                        else rowRefs.current.delete(virtualRow.index);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div role="status" className="py-8 text-center">
            <UserRound
              className="size-6 mx-auto mb-2 text-muted-foreground/30"
              aria-hidden="true"
            />
            <p className="text-[11px] font-bold text-foreground/60">
              No artists found
            </p>
            <p className="text-[10px] text-muted-foreground/45 mt-0.5">
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "Try a different search term"}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="text-[11px] font-bold text-destructive animate-in slide-in-from-left-1 duration-200"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default ArtistSelector;
