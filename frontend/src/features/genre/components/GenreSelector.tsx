/**
 * GenreSelector.tsx — Hierarchical genre picker (filter + form variants)
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPROVEMENTS
 *   • `buildFlatTree` extracted to module scope (pure function) — the original
 *     was defined inside the module but still recreated the tree on every
 *     `displayGenres` useMemo call. Now it's truly stable.
 *
 *   • `selectedIds` normalization memo: `Array.isArray(value)` guard is
 *     preserved; the deps array is `[value]` not `[value, singleSelect]`
 *     since `singleSelect` doesn't affect the normalization.
 *
 *   • Genre list item click: moved from `onClick` on a `<div>` to a `<button>`
 *     — fixes the accessible role/keyboard navigation anti-pattern.
 *     ARIA: `aria-selected` on each option, `role="listbox"` on the container.
 *
 *   • Search input: `role="searchbox"` + `aria-label`.
 *
 *   • Color dot: explicit `aria-hidden="true"`.
 *
 *   • Loading state: `role="status"` + `aria-live="polite"`.
 *
 *   • Empty state: `role="status"`.
 *
 *   • Multi-select badge X: `type="button"` + `aria-label`.
 *
 *   • `handleSelect` is `useCallback` with stable deps.
 */

import React, { useState, useMemo, useCallback, memo } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type GenreNode = Genre & {
  level: number;
  isDisabled: boolean;
  hasChildren: boolean;
};

interface GenreSelectorProps {
  label?: string;
  required?: boolean;
  error?: string;
  value: string | string[] | undefined | null;
  onChange: (val: any) => void;
  singleSelect?: boolean;
  excludeIds?: string[];
  className?: string;
  placeholder?: string;
  variant?: "form" | "filter";
}

// ─────────────────────────────────────────────────────────────────────────────
// TREE BUILDER — pure function, module scope, never recreated
// ─────────────────────────────────────────────────────────────────────────────

const buildFlatTree = (
  items: Genre[],
  excludeIds: string[] = [],
  parentId: string | null = null,
  level = 0,
): GenreNode[] => {
  const result: GenreNode[] = [];

  const children = items
    .filter((item) => {
      const pId =
        typeof item.parentId === "object" && item.parentId
          ? (item.parentId as any)._id
          : item.parentId;
      return (pId || null) === parentId;
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
    result.push(...buildFlatTree(items, excludeIds, child._id, level + 1));
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// GENRE ROW — memoized individual row
// Changed from clickable <div> to <button> for keyboard + ARIA compliance.
// ─────────────────────────────────────────────────────────────────────────────

interface GenreRowProps {
  genre: GenreNode;
  isSelected: boolean;
  searchTerm: string;
  onSelect: (id: string) => void;
}

const GenreRow = memo(
  ({ genre, isSelected, searchTerm, onSelect }: GenreRowProps) => {
    const indent = searchTerm ? 0 : genre.level * 20;

    return (
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => onSelect(genre._id)}
        className={cn(
          "flex items-center gap-2 w-full text-left rounded-sm text-sm transition-colors duration-100 select-none py-2 pr-3",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          isSelected
            ? "bg-primary/10 text-primary font-semibold"
            : "hover:bg-muted/50 text-foreground",
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Tree indent icon */}
        {!searchTerm && (
          <span
            className="text-muted-foreground/35 shrink-0"
            aria-hidden="true"
          >
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

        {/* Color dot + name */}
        <div className="flex-1 flex items-center gap-2 truncate">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: genre.color || "#888" }}
            aria-hidden="true"
          />
          <span className="truncate">{genre.name}</span>
        </div>

        {/* Selected check */}
        {isSelected && (
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
        )}
      </button>
    );
  },
);
GenreRow.displayName = "GenreRow";

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL OPTION ROW — "All levels" / "Root only" options
// ─────────────────────────────────────────────────────────────────────────────

interface SpecialOptionProps {
  icon: React.ElementType;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  iconCls?: string;
}

const SpecialOption = memo(
  ({ icon: Icon, label, isSelected, onClick, iconCls }: SpecialOptionProps) => (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full text-left px-3 py-2 rounded-sm text-sm transition-colors duration-100 select-none",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        isSelected
          ? "bg-primary/10 text-primary font-semibold"
          : "hover:bg-muted/50",
      )}
    >
      <Icon
        className={cn("size-3.5 opacity-75 shrink-0", iconCls)}
        aria-hidden="true"
      />
      <span className="flex-1">{label}</span>
      {isSelected && (
        <Check className="size-4 text-primary" aria-hidden="true" />
      )}
    </button>
  ),
);
SpecialOption.displayName = "SpecialOption";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE SELECTOR — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const GenreSelector: React.FC<GenreSelectorProps> = ({
  label,
  required,
  error,
  value,
  onChange,
  singleSelect = false,
  excludeIds = [],
  className,
  placeholder = "Search genres…",
  variant = "form",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: genres, isLoading } = useGenreTreeQuery();

  // Normalize value → string[] for uniform selection checks
  const selectedIds = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  }, [value]);

  // Build flat tree or flat search results
  const displayGenres = useMemo<GenreNode[]>(() => {
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

  // Toggle selection — single or multi mode
  const handleSelect = useCallback(
    (id: string | null | undefined) => {
      if (singleSelect) {
        onChange(id === value ? undefined : id);
        return;
      }
      if (!id) return;
      const isSelected = selectedIds.includes(id);
      onChange(
        isSelected ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
      );
    },
    [singleSelect, value, selectedIds, onChange],
  );

  return (
    <div className={cn("space-y-2 w-full", className)}>
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

      <div
        className={cn(
          "border border-input rounded-lg bg-background shadow-sm",
          "transition-all focus-within:ring-1 focus-within:ring-primary/30",
          error && "border-destructive focus-within:ring-destructive/25",
        )}
      >
        {/* Search */}
        <div className="relative border-b border-border/50">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/55 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            role="searchbox"
            aria-label="Search genres"
            className="w-full h-9 pl-9 pr-4 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Option list */}
        <div
          role="listbox"
          aria-multiselectable={!singleSelect}
          aria-label="Genre options"
          className="max-h-[240px] overflow-y-auto scrollbar-thin p-1"
        >
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="py-8 flex justify-center items-center gap-2 text-xs text-muted-foreground/60"
            >
              <Loader2
                className="size-4 animate-spin text-primary/60"
                aria-hidden="true"
              />
              Loading genres…
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Special options — only when not in search mode */}
              {!searchTerm && (
                <>
                  {variant === "filter" && (
                    <SpecialOption
                      icon={ListFilter}
                      label="All levels"
                      isSelected={value === undefined}
                      onClick={() => handleSelect(undefined)}
                    />
                  )}

                  <SpecialOption
                    icon={variant === "filter" ? FolderOpen : Layers}
                    label={
                      variant === "filter"
                        ? "Root genres only"
                        : "No parent (root)"
                    }
                    isSelected={
                      value === (variant === "filter" ? "root" : null)
                    }
                    onClick={() =>
                      handleSelect(variant === "filter" ? "root" : null)
                    }
                    iconCls={
                      variant === "filter" ? "text-purple-500" : "text-primary"
                    }
                  />
                </>
              )}

              {/* Genre rows */}
              {displayGenres.map((genre) => (
                <GenreRow
                  key={genre._id}
                  genre={genre}
                  isSelected={selectedIds.includes(genre._id)}
                  searchTerm={searchTerm}
                  onSelect={handleSelect}
                />
              ))}

              {/* Empty state */}
              {displayGenres.length === 0 && !isLoading && (
                <div
                  role="status"
                  className="py-8 text-center text-[11px] font-semibold text-muted-foreground/45 uppercase tracking-wide"
                >
                  No genres found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-select tags */}
      {!singleSelect && selectedIds.length > 0 && genres && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const g = genres.find((item) => item._id === id);
            if (!g) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="pl-2.5 pr-1 py-0.5 h-7 text-[11px] border bg-background hover:bg-muted transition-colors flex items-center gap-1.5"
                style={{ borderColor: g.color ? `${g.color}45` : undefined }}
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: g.color || "#888" }}
                  aria-hidden="true"
                />
                {g.name}
                <button
                  type="button"
                  onClick={() => handleSelect(id)}
                  aria-label={`Remove ${g.name}`}
                  className="size-4 rounded-full hover:bg-destructive hover:text-white flex items-center justify-center transition-colors ml-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
                >
                  <X className="size-2.5" aria-hidden="true" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

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

export default GenreSelector;
