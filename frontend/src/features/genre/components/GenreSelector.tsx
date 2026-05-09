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
  ChevronRight,
  CornerDownRight,
  FolderOpen,
  ListFilter,
  Layers,
  Minus,
  Hash,
  ChevronsUpDown,
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

interface GenreNode extends IGenre {
  level: number;
  isDisabled: boolean;
  hasChildren: boolean;
  /** Direct children IDs */
  childIds: string[];
  /** All descendant IDs — precomputed */
  descendantIds: string[];
  /** Normalized parent ID */
  parentIdNorm: string | null;
  /** Ordered ancestor IDs from root → parent (for breadcrumb) */
  ancestorIds: string[];
}

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
  /** Max height of the scrollable list in px */
  maxListHeight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// A. TREE BUILDER — O(n), iterative descendant calc, no recursion risk
// ─────────────────────────────────────────────────────────────────────────────

const normParentId = (item: IGenre): string | null => {
  const pid = item.parentId;
  if (!pid) return null;
  if (typeof pid === "object" && pid !== null) return (pid as any)._id ?? null;
  return pid as string;
};

/** BFS descendant ids — iterative, safe for any tree depth */
const getDescendantIds = (
  id: string,
  childrenOf: Map<string | null, IGenre[]>,
): string[] => {
  const result: string[] = [];
  const queue: string[] = (childrenOf.get(id) ?? []).map((k) => k._id);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    result.push(curr);
    queue.push(...(childrenOf.get(curr) ?? []).map((k) => k._id));
  }
  return result;
};

const buildFlatTree = (
  items: IGenre[],
  excludeSet: Set<string>,
): GenreNode[] => {
  // Group children by parentId (exclude excluded items)
  const childrenOf = new Map<string | null, IGenre[]>();
  for (const item of items) {
    if (excludeSet.has(item._id)) continue;
    const pid = normParentId(item);
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(item);
  }

  // Sort each sibling group by priority desc, then name asc
  for (const siblings of childrenOf.values()) {
    siblings.sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        a.name.localeCompare(b.name, "vi"),
    );
  }

  // Cache descendant ids per node
  const descendantsCache = new Map<string, string[]>();
  const getDescendants = (id: string): string[] => {
    if (!descendantsCache.has(id)) {
      descendantsCache.set(id, getDescendantIds(id, childrenOf));
    }
    return descendantsCache.get(id)!;
  };

  // DFS — emit nodes in depth-first order, track ancestor chain
  const result: GenreNode[] = [];

  const traverse = (
    parentId: string | null,
    level: number,
    ancestorIds: string[],
  ) => {
    for (const child of childrenOf.get(parentId) ?? []) {
      const directKids = childrenOf.get(child._id) ?? [];
      result.push({
        ...child,
        level,
        isDisabled: false,
        hasChildren: directKids.length > 0,
        childIds: directKids.map((k) => k._id),
        descendantIds: getDescendants(child._id),
        parentIdNorm: parentId,
        ancestorIds,
      });
      traverse(child._id, level + 1, [...ancestorIds, child._id]);
    }
  };

  traverse(null, 0, []);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// B. SELECTION NORMALIZER — bottom-up sibling promotion
//    Rule: all children of a parent selected → promote to parent (remove children)
//    Rule: parent selected → remove all descendants (redundant)
// ─────────────────────────────────────────────────────────────────────────────

const normalizeSelection = (
  ids: string[],
  nodeMap: Map<string, GenreNode>,
): string[] => {
  const selected = new Set(ids);

  // Pass 1 — if parent is selected, strip all its descendants (redundant)
  for (const [, node] of nodeMap) {
    if (selected.has(node._id) && node.hasChildren) {
      for (const desc of node.descendantIds) {
        selected.delete(desc);
      }
    }
  }

  // Pass 2 — bottom-up sibling promotion (one linear pass over sorted nodes)
  // Process in reverse DFS order so children are evaluated before parents
  const allNodes = [...nodeMap.values()];
  for (let i = allNodes.length - 1; i >= 0; i--) {
    const node = allNodes[i];
    if (!node.hasChildren || selected.has(node._id)) continue;
    if (
      node.childIds.length > 0 &&
      node.childIds.every((id) => selected.has(id))
    ) {
      selected.add(node._id);
      for (const cid of node.childIds) selected.delete(cid);
    }
  }

  return [...selected];
};

// ─────────────────────────────────────────────────────────────────────────────
// C. PER-ROW STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** O(n) precompute: how many descendants of each parent are in selectedSet */
const buildDescendantSelectedCounts = (
  flatTree: GenreNode[],
  selectedSet: Set<string>,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const node of flatTree) {
    if (!node.hasChildren) continue;
    let n = 0;
    for (const desc of node.descendantIds) {
      if (selectedSet.has(desc)) n++;
    }
    counts.set(node._id, n);
  }
  return counts;
};

const getSelectionState = (
  node: GenreNode,
  selectedSet: Set<string>,
  descendantSelectedCount: number,
): SelectionState => {
  if (selectedSet.has(node._id)) return "full";
  if (!node.hasChildren || descendantSelectedCount === 0) return "none";
  if (descendantSelectedCount === node.descendantIds.length) return "full";
  return "indeterminate";
};

// ─────────────────────────────────────────────────────────────────────────────
// D. HIGHLIGHT TEXT — split on query match, mark matched segment
// ─────────────────────────────────────────────────────────────────────────────

const HighlightText = memo(
  ({ text, query }: { text: string; query: string }) => {
    if (!query) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-primary font-semibold rounded-sm not-italic">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </span>
    );
  },
);
HighlightText.displayName = "HighlightText";

// ─────────────────────────────────────────────────────────────────────────────
// E. LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const GenreSkeleton = memo(() => (
  <div
    role="status"
    aria-label="Loading genres"
    className="px-1 py-1 space-y-1"
  >
    {[80, 60, 70, 50, 65].map((w, i) => (
      <div
        key={i}
        className="flex items-center gap-2 px-3 py-2 rounded-sm"
        style={{
          paddingLeft: `${12 + (i % 3 === 0 ? 0 : i % 2 === 0 ? 20 : 40)}px`,
        }}
      >
        <div className="size-3.5 rounded-sm bg-muted/60 animate-pulse shrink-0" />
        <div
          className="h-2.5 rounded-full bg-muted/60 animate-pulse"
          style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
        />
      </div>
    ))}
  </div>
));
GenreSkeleton.displayName = "GenreSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// F. GENRE ROW — supports collapse toggle, highlight, breadcrumb, indeterminate
// ─────────────────────────────────────────────────────────────────────────────

interface GenreRowProps {
  genre: GenreNode;
  selectionState: SelectionState;
  selectedDescendantCount: number;
  isFocused: boolean;
  searchTerm: string;
  isCollapsed: boolean;
  ancestorNames: string[];
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string, e: React.MouseEvent) => void;
  rowRef?: (el: HTMLButtonElement | null) => void;
}

const GenreRow = memo(
  ({
    genre,
    selectionState,
    selectedDescendantCount,
    isFocused,
    searchTerm,
    isCollapsed,
    ancestorNames,
    onSelect,
    onToggleCollapse,
    rowRef,
  }: GenreRowProps) => {
    const indent = searchTerm ? 0 : genre.level * 18;
    const isSelected = selectionState === "full";
    const isIndet = selectionState === "indeterminate";

    return (
      <button
        ref={rowRef}
        type="button"
        role="option"
        aria-selected={isSelected}
        aria-expanded={
          genre.hasChildren && !searchTerm ? !isCollapsed : undefined
        }
        tabIndex={isFocused ? 0 : -1}
        onClick={() => onSelect(genre._id)}
        className={cn(
          "group flex items-center gap-2 w-full text-left rounded-md text-sm",
          "transition-colors duration-100 select-none py-2 pr-3",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          isSelected && "bg-primary/10 text-primary font-medium",
          isIndet && "bg-primary/[0.05] text-foreground",
          !isSelected && !isIndet && "hover:bg-muted/60 text-foreground",
          isFocused && !isSelected && !isIndet && "bg-muted/60",
        )}
        style={{ paddingLeft: `${10 + indent}px` }}
      >
        {/* ── Collapse chevron or indent icon ─────────────────────────── */}
        {!searchTerm ? (
          genre.hasChildren ? (
            <span
              role="button"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
              onClick={(e) => onToggleCollapse(genre._id, e)}
              className={cn(
                "shrink-0 flex items-center justify-center size-4 rounded",
                "text-muted-foreground/50 hover:text-foreground hover:bg-muted/70",
                "transition-colors duration-100",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-150",
                  !isCollapsed && "rotate-90",
                  isIndet && "text-primary/60",
                )}
                aria-hidden="true"
              />
            </span>
          ) : (
            <span
              className="shrink-0 size-4 flex items-center justify-center text-muted-foreground/30"
              aria-hidden="true"
            >
              <CornerDownRight className="size-3" />
            </span>
          )
        ) : (
          /* Search mode: show folder/leaf icon */
          <span
            className="shrink-0 size-4 flex items-center justify-center text-muted-foreground/40"
            aria-hidden="true"
          >
            {genre.hasChildren ? (
              <FolderOpen className="size-3.5" />
            ) : (
              <Hash className="size-3" />
            )}
          </span>
        )}

        {/* ── Color dot ──────────────────────────────────────────────── */}
        <span
          className={cn(
            "size-2 rounded-full shrink-0 transition-all duration-150",
            isIndet &&
              "ring-2 ring-primary/25 ring-offset-[1.5px] ring-offset-background",
          )}
          style={{ backgroundColor: genre.color || "#6b7280" }}
          aria-hidden="true"
        />

        {/* ── Name + breadcrumb ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-px">
          <span className="truncate leading-tight">
            <HighlightText text={genre.name} query={searchTerm} />
          </span>
          {/* Ancestor breadcrumb — only shown in search mode when has parents */}
          {searchTerm && ancestorNames.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 truncate leading-tight">
              {ancestorNames.join(" › ")}
            </span>
          )}
        </div>

        {/* ── Right-side indicators ──────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-1">
          {/* Descendant selected count badge */}
          {isIndet && selectedDescendantCount > 0 && (
            <span
              className="text-[10px] font-bold tabular-nums text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full leading-none"
              aria-label={`${selectedDescendantCount} sub-genres selected`}
            >
              {selectedDescendantCount}
            </span>
          )}
          {/* Collapsed children count */}
          {!searchTerm &&
            genre.hasChildren &&
            isCollapsed &&
            !isSelected &&
            !isIndet && (
              <span className="text-[10px] tabular-nums text-muted-foreground/40 leading-none">
                {genre.childIds.length}
              </span>
            )}
          {/* Checkmark */}
          {isSelected && (
            <Check className="size-3.5 text-primary" aria-hidden="true" />
          )}
          {isIndet && (
            <Minus className="size-3.5 text-primary/50" aria-hidden="true" />
          )}
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.selectionState === next.selectionState &&
    prev.selectedDescendantCount === next.selectedDescendantCount &&
    prev.isFocused === next.isFocused &&
    prev.searchTerm === next.searchTerm &&
    prev.isCollapsed === next.isCollapsed &&
    prev.genre._id === next.genre._id,
);
GenreRow.displayName = "GenreRow";

// ─────────────────────────────────────────────────────────────────────────────
// G. SPECIAL OPTION — "All levels" / "Root only"
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
        "flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm",
        "transition-colors duration-100 select-none",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        isSelected
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          iconCls ?? "text-muted-foreground/60",
        )}
        aria-hidden="true"
      />
      <span className="flex-1 text-sm">{label}</span>
      {isSelected && (
        <Check className="size-3.5 text-primary shrink-0" aria-hidden="true" />
      )}
    </button>
  ),
);
SpecialOption.displayName = "SpecialOption";

// ─────────────────────────────────────────────────────────────────────────────
// H. SELECTION SUMMARY BAR — multi-select only
// ─────────────────────────────────────────────────────────────────────────────

interface SelectionSummaryProps {
  count: number;
  onSelectAll: () => void;
  onClearAll: () => void;
  totalVisible: number;
}

const SelectionSummary = memo(
  ({ count, onSelectAll, onClearAll, totalVisible }: SelectionSummaryProps) => (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/20">
      <span className="text-[11px] font-medium text-muted-foreground flex-1">
        {count > 0 ? (
          <>
            <span className="text-primary font-bold">{count}</span>
            <span className="text-muted-foreground/70"> đã chọn</span>
          </>
        ) : (
          <span className="text-muted-foreground/50">Chưa chọn</span>
        )}
      </span>
      <div className="flex items-center gap-1">
        {totalVisible > 0 && count < totalVisible && (
          <button
            type="button"
            onClick={onSelectAll}
            className={cn(
              "h-5 px-2 text-[10px] font-medium rounded",
              "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60",
              "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            Chọn tất cả
          </button>
        )}
        {count > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "h-5 px-2 text-[10px] font-medium rounded",
              "text-destructive/70 hover:text-destructive hover:bg-destructive/10",
              "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/30",
            )}
          >
            Xóa tất cả
          </button>
        )}
      </div>
    </div>
  ),
);
SelectionSummary.displayName = "SelectionSummary";

// ─────────────────────────────────────────────────────────────────────────────
// I. GENRE SELECTOR — MAIN
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
  placeholder = "Tìm kiếm thể loại…",
  variant = "form",
  maxListHeight = 260,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const { data: genres, isLoading } = useGenreTreeQuery();

  // ── Stable exclude set ───────────────────────────────────────────────────
  const excludeSet = useMemo(
    () => new Set(excludeIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excludeIds.join(",")],
  );

  // ── Normalize value → string[] ───────────────────────────────────────────
  const selectedIds = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  }, [value]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ── Build flat tree ──────────────────────────────────────────────────────
  const flatTree = useMemo<GenreNode[]>(() => {
    if (!genres) return [];
    return buildFlatTree(genres, excludeSet);
  }, [genres, excludeSet]);

  // ── Node map — O(1) lookup ───────────────────────────────────────────────
  const nodeMap = useMemo<Map<string, GenreNode>>(() => {
    const m = new Map<string, GenreNode>();
    for (const node of flatTree) m.set(node._id, node);
    return m;
  }, [flatTree]);

  // ── Precompute descendant selected counts ────────────────────────────────
  const descendantCounts = useMemo(
    () => buildDescendantSelectedCounts(flatTree, selectedSet),
    [flatTree, selectedSet],
  );

  // ── Ancestor name map for breadcrumb ────────────────────────────────────
  const ancestorNamesMap = useMemo<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const node of flatTree) {
      m.set(
        node._id,
        node.ancestorIds.map((aid) => nodeMap.get(aid)?.name ?? ""),
      );
    }
    return m;
  }, [flatTree, nodeMap]);

  // ── Filtered list for search ─────────────────────────────────────────────
  const searchResults = useMemo<GenreNode[]>(() => {
    if (!searchTerm) return flatTree;
    const lower = searchTerm.toLowerCase();
    return flatTree
      .filter((g) => g.name.toLowerCase().includes(lower))
      .map((g) => ({ ...g, level: 0 }));
  }, [flatTree, searchTerm]);

  // ── Visible tree (collapse/expand applied) ───────────────────────────────
  const visibleTree = useMemo<GenreNode[]>(() => {
    if (searchTerm) return searchResults;

    const result: GenreNode[] = [];
    const hiddenSet = new Set<string>();

    for (const node of flatTree) {
      if (hiddenSet.has(node._id)) continue;
      result.push(node);
      if (collapsedSet.has(node._id) && node.hasChildren) {
        for (const id of node.descendantIds) hiddenSet.add(id);
      }
    }

    return result;
  }, [flatTree, searchTerm, collapsedSet, searchResults]);

  // ── Selection handlers ───────────────────────────────────────────────────
  const handleSelect = useCallback(
    (id: string | null | undefined) => {
      // Single select: simple toggle
      if (singleSelect) {
        const currentVal = Array.isArray(value) ? value[0] : value;
        onChange(id === currentVal ? undefined : id);
        return;
      }
      if (!id) return;

      const node = nodeMap.get(id);
      const descCount = descendantCounts.get(id) ?? 0;
      const state = getSelectionState(node!, selectedSet, descCount);

      let nextIds: string[];

      if (state === "full") {
        // DESELECT: if parent, expand to direct children so user can pick granularly
        if (node?.hasChildren && node.childIds.length > 0) {
          const others = selectedIds.filter((x) => x !== id);
          nextIds = [...others, ...node.childIds];
        } else {
          nextIds = selectedIds.filter((x) => x !== id);
        }
      } else if (state === "indeterminate") {
        // PROMOTE: user clicking partially-selected parent → fully select it
        const descSet = new Set(node?.descendantIds ?? []);
        nextIds = [...selectedIds.filter((x) => !descSet.has(x)), id];
      } else {
        // SELECT: add, strip descendants to avoid redundancy
        const descSet = new Set(node?.descendantIds ?? []);
        nextIds = [...selectedIds.filter((x) => !descSet.has(x)), id];
      }

      onChange(normalizeSelection(nextIds, nodeMap));
    },
    [
      singleSelect,
      value,
      selectedIds,
      selectedSet,
      nodeMap,
      descendantCounts,
      onChange,
    ],
  );

  const handleSelectAll = useCallback(() => {
    const allIds = visibleTree.map((n) => n._id);
    onChange(normalizeSelection(allIds, nodeMap));
  }, [visibleTree, nodeMap, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleToggleCollapse = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setCollapsedSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const handleExpandAll = useCallback(() => {
    setCollapsedSet(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    const roots = new Set(
      flatTree.filter((n) => n.level === 0 && n.hasChildren).map((n) => n._id),
    );
    setCollapsedSet(roots);
  }, [flatTree]);

  // ── Search: reset focus index ────────────────────────────────────────────
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const total = visibleTree.length;
      if (total === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < total - 1 ? prev + 1 : 0;
          rowRefs.current.get(next)?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : total - 1;
          rowRefs.current.get(next)?.focus();
          return next;
        });
      } else if ((e.key === "Enter" || e.key === " ") && focusedIndex >= 0) {
        e.preventDefault();
        handleSelect(visibleTree[focusedIndex]._id);
      } else if (e.key === "ArrowRight" && focusedIndex >= 0) {
        e.preventDefault();
        const node = visibleTree[focusedIndex];
        if (node?.hasChildren) {
          setCollapsedSet((prev) => {
            const next = new Set(prev);
            next.delete(node._id);
            return next;
          });
        }
      } else if (e.key === "ArrowLeft" && focusedIndex >= 0) {
        e.preventDefault();
        const node = visibleTree[focusedIndex];
        if (node?.hasChildren) {
          setCollapsedSet((prev) => new Set([...prev, node._id]));
        }
      }
    },
    [visibleTree, focusedIndex, handleSelect],
  );

  // ── Virtual scroll ───────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: visibleTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 6,
  });

  // ── Derived display state ────────────────────────────────────────────────
  const hasCollapsibleNodes = useMemo(
    () => flatTree.some((n) => n.hasChildren),
    [flatTree],
  );

  const hasAnyCollapsed = collapsedSet.size > 0;

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

      {/* Main container */}
      <div
        className={cn(
          "border border-input rounded-xl bg-background",
          "shadow-sm overflow-hidden",
          "transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40",
          error &&
            "border-destructive/60 focus-within:ring-destructive/20 focus-within:border-destructive/60",
        )}
        onKeyDown={handleKeyDown}
      >
        {/* ── Search row ──────────────────────────────────────────────── */}
        <div className="relative flex items-center border-b border-border/50">
          <Search
            className="absolute left-3 size-3.5 text-muted-foreground/50 pointer-events-none shrink-0"
            aria-hidden="true"
          />
          <input
            type="search"
            role="searchbox"
            aria-label="Search genres"
            aria-busy={isLoading}
            className="flex-1 h-9 pl-9 pr-9 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Collapse toggle — only visible when not searching */}
          {!searchTerm && !isLoading && hasCollapsibleNodes && (
            <button
              type="button"
              onClick={hasAnyCollapsed ? handleExpandAll : handleCollapseAll}
              aria-label={hasAnyCollapsed ? "Expand all" : "Collapse all"}
              className="absolute right-2 p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ChevronsUpDown className="size-3.5" />
            </button>
          )}
          {/* Clear search */}
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              className="absolute right-2 p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* ── Multi-select summary bar ─────────────────────────────────── */}
        {!singleSelect && !isLoading && flatTree.length > 0 && (
          <SelectionSummary
            count={selectedIds.length}
            totalVisible={visibleTree.length}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
        )}

        {/* ── Options ────────────────────────────────────────────────── */}
        <div
          role="listbox"
          aria-multiselectable={!singleSelect}
          aria-label="Genre options"
          className="p-1"
        >
          {isLoading ? (
            <GenreSkeleton />
          ) : (
            <>
              {/* Special options — only in non-search mode */}
              {!searchTerm && (
                <div className="mb-1 space-y-0.5">
                  {variant === "filter" && (
                    <SpecialOption
                      icon={ListFilter}
                      label="Tất cả cấp bậc"
                      isSelected={
                        value === undefined ||
                        value === null ||
                        (Array.isArray(value) && value.length === 0)
                      }
                      onClick={() => onChange(undefined)}
                    />
                  )}
                  <SpecialOption
                    icon={variant === "filter" ? FolderOpen : Layers}
                    label={
                      variant === "filter"
                        ? "Chỉ thể loại gốc"
                        : "Không có thể loại cha"
                    }
                    isSelected={value === "root"}
                    onClick={() => onChange("root")}
                    iconCls={
                      variant === "filter"
                        ? "text-violet-500"
                        : "text-primary/70"
                    }
                  />
                  {!searchTerm && (
                    <div
                      className="my-1 mx-2 h-px bg-border/40"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}

              {/* Virtualized genre list */}
              <div
                ref={parentRef}
                style={{ maxHeight: `${maxListHeight}px` }}
                className="overflow-y-auto scrollbar-thin scrollbar-thumb-border/60 scrollbar-track-transparent"
              >
                {visibleTree.length === 0 ? (
                  <div
                    role="status"
                    className="py-10 flex flex-col items-center gap-2 text-center"
                  >
                    <span className="text-[28px]" aria-hidden="true">
                      🎵
                    </span>
                    <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wide">
                      {searchTerm
                        ? "Không tìm thấy kết quả"
                        : "Chưa có thể loại"}
                    </p>
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-[11px] text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
                      >
                        Xóa tìm kiếm
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const genre = visibleTree[virtualRow.index];
                      const descCount = descendantCounts.get(genre._id) ?? 0;
                      const state = singleSelect
                        ? selectedSet.has(genre._id)
                          ? "full"
                          : "none"
                        : getSelectionState(genre, selectedSet, descCount);
                      const isCollapsed =
                        !searchTerm && collapsedSet.has(genre._id);
                      const ancestorNames =
                        ancestorNamesMap.get(genre._id) ?? [];

                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
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
                            selectedDescendantCount={descCount}
                            isFocused={focusedIndex === virtualRow.index}
                            searchTerm={searchTerm}
                            isCollapsed={isCollapsed}
                            ancestorNames={ancestorNames}
                            onSelect={handleSelect}
                            onToggleCollapse={handleToggleCollapse}
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

      {/* ── Multi-select selected tags ─────────────────────────────────── */}
      {!singleSelect && selectedIds.length > 0 && genres && (
        <div
          className="flex flex-wrap gap-1.5"
          role="list"
          aria-label="Selected genres"
        >
          {selectedIds.map((id) => {
            const g = nodeMap.get(id) ?? genres.find((item) => item._id === id);
            if (!g) return null;
            const isParent = nodeMap.get(id)?.hasChildren ?? false;
            const descSelectedCount = descendantCounts.get(id) ?? 0;

            return (
              <Badge
                key={id}
                variant="secondary"
                role="listitem"
                className={cn(
                  "pl-2 pr-1 py-0.5 h-7 text-[11px] border bg-background",
                  "hover:bg-muted/60 transition-colors flex items-center gap-1.5",
                  "focus-within:ring-1 focus-within:ring-primary/30",
                  isParent
                    ? "border-primary/25 bg-primary/5"
                    : "border-border/60",
                )}
                style={{
                  borderLeftColor: (g as IGenre).color
                    ? `${(g as IGenre).color}60`
                    : undefined,
                  borderLeftWidth: "2px",
                }}
              >
                {/* Color / folder icon */}
                {isParent ? (
                  <FolderOpen
                    className="size-3 shrink-0 text-primary/50"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: (g as IGenre).color || "#6b7280",
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Name */}
                <span className="truncate max-w-[110px]">{g.name}</span>

                {/* Parent + descendant count badge */}
                {isParent && descSelectedCount > 0 && (
                  <span className="text-[9px] font-bold text-primary/50 border border-primary/20 px-1 rounded leading-none tabular-nums">
                    +{descSelectedCount}
                  </span>
                )}
                {isParent && descSelectedCount === 0 && (
                  <span className="text-[9px] font-bold text-primary/40 border border-primary/15 px-1 rounded leading-none">
                    all
                  </span>
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleSelect(id)}
                  aria-label={`Remove ${g.name}`}
                  className={cn(
                    "size-4 rounded-full flex items-center justify-center ml-0.5",
                    "text-muted-foreground/50 hover:text-white hover:bg-destructive",
                    "transition-colors duration-100",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40",
                  )}
                >
                  <X className="size-2.5" aria-hidden="true" />
                </button>
              </Badge>
            );
          })}

          {/* Quick-clear all tags */}
          {selectedIds.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className={cn(
                "h-7 px-2 rounded-full border border-border/60 bg-background",
                "text-[11px] text-muted-foreground/60 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5",
                "flex items-center gap-1 transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/30",
              )}
              aria-label="Clear all selected genres"
            >
              <X className="size-2.5" aria-hidden="true" />
              Xóa tất cả
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p
          role="alert"
          className="text-[11px] font-semibold text-destructive animate-in slide-in-from-left-1 duration-200"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default GenreSelector;
