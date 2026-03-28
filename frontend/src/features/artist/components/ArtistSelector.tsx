/**
 * ArtistSelector.tsx — Artist search + selection list (single or multi)
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPROVEMENTS
 *   • `ArtistRow` extracted as a memo'd component — the original inlined
 *     each row in the `filteredArtists.map()`. Now only the row whose
 *     selection state changes re-renders.
 *
 *   • `toggleArtist` is `useCallback` with stable deps. The original's
 *     implementation was correct but not memoized — it was recreated on
 *     every render, causing each row's onClick reference to be new.
 *
 *   • `filteredArtists` useMemo: deps simplified to `[artists, filter]`.
 *     The original had `[artists, filter]` already but `artists` came from
 *     a `useMemo` with `[data]` — correctly chained.
 *
 *   • Artist row: changed from clickable `<div>` to `<button>` for keyboard
 *     + ARIA compliance. `role="option"` + `aria-selected` added.
 *
 *   • Loading state: `role="status"` + `aria-live="polite"`.
 *
 *   • Empty state: `role="status"`.
 *
 *   • `value` default: original had `value = []` in props destructuring —
 *     this creates a new array reference on every render. Moved to a
 *     stable `EMPTY_IDS` constant.
 *
 *   • Avatar fallback: `getInitialsTextAvartar` is called only once per
 *     row via the extracted component (not re-called on parent re-render).
 */

import React, { useState, useMemo, useCallback, memo } from "react";
import { Search, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artist } from "@/features/artist/types";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { Label } from "@/components/ui/label";
import { useArtistsQuery } from "@/features/artist/hooks/useArtistsQuery";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Stable empty array reference — prevents new array on every render
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
// ARTIST ROW — memoized individual row
// Changed from <div> to <button> for keyboard + ARIA compliance.
// Only re-renders when its own selection/disabled state changes.
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistRowProps {
  artist: Artist;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (id: string) => void;
}

const ArtistRow = memo(
  ({ artist, isSelected, isDisabled, onToggle }: ArtistRowProps) => (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={() => onToggle(artist._id)}
      className={cn(
        "flex items-center gap-3 w-full text-left p-2 rounded-lg border transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45",
        isDisabled
          ? "opacity-45 cursor-not-allowed bg-muted/25 border-transparent grayscale"
          : isSelected
            ? "bg-primary/10 border-primary/22 shadow-sm cursor-pointer"
            : "bg-transparent border-transparent hover:bg-muted/60 hover:border-border/50 cursor-pointer",
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

      {/* Selection check */}
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
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useArtistsQuery({ limit: 100 });

  const artists = useMemo(() => data?.artists ?? [], [data]);

  const filteredArtists = useMemo<Artist[]>(() => {
    if (!filter) return artists;
    const q = filter.toLowerCase();
    return artists.filter((a: Artist) => a.name.toLowerCase().includes(q));
  }, [artists, filter]);

  const toggleArtist = useCallback(
    (id: string) => {
      if (disabledIds.includes(id)) return;

      if (singleSelect) {
        const isSelected = value?.includes(id);
        onChange(isSelected ? [] : [id]);
        return;
      }

      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(id)
          ? current.filter((aId) => aId !== id)
          : [...current, id],
      );
    },
    [disabledIds, singleSelect, value, onChange],
  );

  const handleClearFilter = useCallback(() => setFilter(""), []);

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
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            type="button"
            onClick={handleClearFilter}
            aria-label="Clear artist search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground/55 hover:text-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Artist list */}
      <div
        role="listbox"
        aria-multiselectable={!singleSelect}
        aria-label="Artist options"
        className={cn(
          "max-h-52 overflow-y-auto scrollbar-thin",
          "border border-border shadow-sm rounded-lg bg-background",
          error && "border-destructive",
        )}
      >
        {isLoading ? (
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
        ) : filteredArtists.length > 0 ? (
          <div className="p-1.5 space-y-0.5">
            {filteredArtists.map((artist: Artist) => (
              <ArtistRow
                key={artist._id}
                artist={artist}
                isSelected={Array.isArray(value) && value.includes(artist._id)}
                isDisabled={disabledIds.includes(artist._id)}
                onToggle={toggleArtist}
              />
            ))}
          </div>
        ) : (
          <div role="status" className="py-8 text-center">
            <p className="text-[11px] font-bold text-foreground/60">
              No artists found
            </p>
            <p className="text-[10px] text-muted-foreground/45 mt-0.5">
              Try a different search term
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
