import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  memo,
} from "react";
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
  Minus,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { useGenreTreeQuery } from "@/features/genre/hooks/useGenresQuery";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { IGenre } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SelectionState = "none" | "full" | "indeterminate";

type GenreNode = IGenre & {
  level: number;
  isDisabled: boolean;
  hasChildren: boolean;
  /** All descendant IDs (used for indeterminate calc) */
  descendantIds: string[];
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
// A. TREE BUILDER — O(n) using Map, no nested .filter()
// ─────────────────────────────────────────────────────────────────────────────

const buildFlatTree = (
  items: IGenre[],
  excludeIds: string[] = [],
): GenreNode[] => {
  // Step 1 — index by _id  → O(n)

  // Step 2 — group children by parentId  → O(n)
  const childrenOf = new Map<string | null, IGenre[]>();
  for (const item of items) {
    const pid =
      typeof item.parentId === "object" && item.parentId !== null
        ? (item.parentId as any)._id
        : ((item.parentId as string | null) ?? null);

    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(item);
  }

  // Step 3 — sort each sibling group by priority desc
  for (const [, siblings] of childrenOf) {
    siblings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  // Step 4 — collect all descendant IDs for a node  → cached via closure
  const descendantsCache = new Map<string, string[]>();
  const getDescendantIds = (id: string): string[] => {
    if (descendantsCache.has(id)) return descendantsCache.get(id)!;
    const kids = childrenOf.get(id) ?? [];
    const result: string[] = [];
    for (const kid of kids) {
      result.push(kid._id, ...getDescendantIds(kid._id));
    }
    descendantsCache.set(id, result);
    return result;
  };

  // Step 5 — DFS traverse to build flat list  → O(n)
  const result: GenreNode[] = [];
  const excludeSet = new Set(excludeIds);

  const traverse = (parentId: string | null, level: number) => {
    const children = childrenOf.get(parentId) ?? [];
    for (const child of children) {
      if (excludeSet.has(child._id)) continue;
      const descendantIds = getDescendantIds(child._id);
      const hasChildren = (childrenOf.get(child._id)?.length ?? 0) > 0;
      result.push({
        ...child,
        level,
        isDisabled: false,
        hasChildren,
        descendantIds,
      });
      traverse(child._id, level + 1);
    }
  };

  traverse(null, 0);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// D. INDETERMINATE STATE CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

const getSelectionState = (
  genre: GenreNode,
  selectedSet: Set<string>,
): SelectionState => {
  if (selectedSet.has(genre._id)) return "full";
  if (!genre.hasChildren) return "none";
  const selectedDescendants = genre.descendantIds.filter((id) =>
    selectedSet.has(id),
  );
  if (selectedDescendants.length === 0) return "none";
  if (selectedDescendants.length === genre.descendantIds.length) return "full";
  return "indeterminate";
};

const getSelectedChildCount = (
  genre: GenreNode,
  selectedSet: Set<string>,
): number => {
  return genre.descendantIds.filter((id) => selectedSet.has(id)).length;
};

// ─────────────────────────────────────────────────────────────────────────────
// GENRE ROW — memoized
// ─────────────────────────────────────────────────────────────────────────────

interface GenreRowProps {
  genre: GenreNode;
  selectionState: SelectionState;
  selectedChildCount: number;
  isFocused: boolean;
  searchTerm: string;
  onSelect: (id: string) => void;
  rowRef?: (el: HTMLButtonElement | null) => void;
}

const GenreRow = memo(
  ({
    genre,
    selectionState,
    selectedChildCount,
    isFocused,
    searchTerm,
    onSelect,
    rowRef,
  }: GenreRowProps) => {
    const indent = searchTerm ? 0 : genre.level * 20;
    const isSelected = selectionState === "full";
    const isIndet = selectionState === "indeterminate";

    return (
      <button
        ref={rowRef}
        type="button"
        role="option"
        aria-selected={isSelected}
        tabIndex={isFocused ? 0 : -1}
        onClick={() => onSelect(genre._id)}
        className={cn(
          "flex items-center gap-2 w-full text-left rounded-sm text-sm transition-all duration-150 select-none py-2 pr-3",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          // Full selected: nổi bật nhất
          isSelected && "bg-primary/10 text-primary font-semibold",
          // Indeterminate: border trái + bg nhẹ — báo hiệu có con đang được chọn
          isIndet &&
            "bg-primary/[0.04] text-foreground border-l-2 border-primary/40",
          // Default
          !isSelected && !isIndet && "hover:bg-muted/50 text-foreground",
          isFocused && !isSelected && !isIndet && "bg-muted/50",
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Tree indent icon */}
        {!searchTerm && (
          <span
            className={cn(
              "shrink-0 transition-colors duration-150",
              isIndet ? "text-primary/50" : "text-muted-foreground/35",
            )}
            aria-hidden="true"
          >
            {genre.level === 0 ? (
              genre.hasChildren ? (
                <FolderOpen
                  className={cn("size-3.5", isIndet && "text-primary/55")}
                />
              ) : (
                <Folder className="size-3.5" />
              )
            ) : (
              <CornerDownRight className="size-3.5" />
            )}
          </span>
        )}

        {/* Color dot + name */}
        <div className="flex-1 flex items-center gap-2 truncate min-w-0">
          <span
            className={cn(
              "size-2 rounded-full shrink-0 transition-all duration-150",
              // Dot có ring glow khi indeterminate — visual cue rõ ràng
              isIndet && "ring-2 ring-primary/20 ring-offset-[1.5px]",
            )}
            style={{ backgroundColor: genre.color || "#888" }}
            aria-hidden="true"
          />
          <span
            className={cn(
              "truncate transition-colors duration-150",
              isIndet && "text-foreground/75",
            )}
          >
            {genre.name}
          </span>
        </div>

        {/* Indeterminate: badge số con được chọn */}
        {isIndet && selectedChildCount > 0 && (
          <span
            className="shrink-0 text-[10px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full leading-none tabular-nums"
            aria-label={`${selectedChildCount} sub-genres selected`}
          >
            {selectedChildCount}
          </span>
        )}

        {/* Full selected checkmark */}
        {isSelected && (
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
        )}

        {/* Indeterminate dash */}
        {isIndet && (
          <Minus
            className="size-4 shrink-0 text-primary/45"
            aria-hidden="true"
          />
        )}
      </button>
    );
  },
);
GenreRow.displayName = "GenreRow";

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL OPTION ROW
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

  // ── Normalize selection ──────────────────────────────────────────────────
  const selectedIds = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  }, [value]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ── Build tree / search list (A — O(n)) ─────────────────────────────────
  const flatTree = useMemo<GenreNode[]>(() => {
    if (!genres) return [];
    return buildFlatTree(genres, excludeIds);
  }, [genres, excludeIds]);

  const displayGenres = useMemo<GenreNode[]>(() => {
    if (!searchTerm) return flatTree;
    const lower = searchTerm.toLowerCase();
    return flatTree
      .filter((g) => g.name.toLowerCase().includes(lower))
      .map((g) => ({ ...g, level: 0 }));
  }, [flatTree, searchTerm]);

  // ── Toggle ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (id: string | null | undefined) => {
      if (singleSelect) {
        onChange(id === value ? undefined : id);
        return;
      }
      if (!id) return;
      const isSelected = selectedSet.has(id);
      onChange(
        isSelected ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
      );
    },
    [singleSelect, value, selectedIds, selectedSet, onChange],
  );

  // ── C. Keyboard navigation ───────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowDown", "ArrowUp", "Enter", " ", "Escape"].includes(e.key))
        return;
      e.preventDefault();

      const total = displayGenres.length;
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
        handleSelect(displayGenres[focusedIndex]._id);
      }
    },
    [displayGenres, focusedIndex, handleSelect],
  );

  // ── B. Virtual scroll via @tanstack/react-virtual ───────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: displayGenres.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 5,
  });

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
        onKeyDown={handleKeyDown}
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
            className="w-full h-9 pl-9 pr-9 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Option list */}
        <div
          role="listbox"
          aria-multiselectable={!singleSelect}
          aria-label="Genre options"
          ref={listContainerRef}
          className="p-1"
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
            <>
              {/* Special options — only outside search */}
              {!searchTerm && (
                <div className="mb-0.5 space-y-0.5">
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
                </div>
              )}

              {/* B. Virtualized genre rows */}
              <div
                ref={parentRef}
                className="max-h-[240px] overflow-y-auto scrollbar-thin"
              >
                {displayGenres.length === 0 ? (
                  <div
                    role="status"
                    className="py-8 text-center text-[11px] font-semibold text-muted-foreground/45 uppercase tracking-wide"
                  >
                    No genres found
                  </div>
                ) : (
                  /* Virtual container */
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const genre = displayGenres[virtualRow.index];
                      const state = singleSelect
                        ? selectedSet.has(genre._id)
                          ? "full"
                          : "none"
                        : getSelectionState(genre, selectedSet);

                      const childCount =
                        !singleSelect && state === "indeterminate"
                          ? getSelectedChildCount(genre, selectedSet)
                          : 0;

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
                          <GenreRow
                            genre={genre}
                            selectionState={state}
                            selectedChildCount={childCount}
                            isFocused={focusedIndex === virtualRow.index}
                            searchTerm={searchTerm}
                            onSelect={handleSelect}
                            rowRef={(el) => {
                              if (el) rowRefs.current.set(virtualRow.index, el);
                              else rowRefs.current.delete(virtualRow.index);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
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
