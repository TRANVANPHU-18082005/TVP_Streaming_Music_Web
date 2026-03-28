"use client";

/**
 * @file GenreFilters.tsx — Genre catalog search + filter bar (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v3.2 — full alignment with AlbumFilter + ArtistFilters v4.0:
 * ─ SearchInput: ambient focus glow + brand-colored icon state transition
 * ─ FilterToggleButton: extracted memo, gradient-brand counter badge
 * ─ ActiveFilterTag: colored icon-bubble per filter (wave-spectrum system)
 * ─ ActiveTagsBar: divider-glow accent line + Sparkles eyebrow icon
 * ─ Card wrapper: border-primary/20 + shadow-brand + gradient-wave top line
 *   when activeFiltersCount > 0
 * ─ FilterLabel: iconColor prop → wave-spectrum per filter section
 * ─ Genre page identity: wave-3 (cyan) primary spectrum
 *
 * ALL v3.2 FIXES PRESERVED (FIX 1–13):
 * ─ FIX 1+2: transitionend on outer grid div, target+propertyName guard
 * ─ FIX 3: React.memo applied
 * ─ FIX 4: activeFiltersCount granular deps
 * ─ FIX 5: removeFilter in useCallback
 * ─ FIX 6: handleClearSearch bypasses debounce
 * ─ FIX 7: URL→input one-way sync guard
 * ─ FIX 8: null removal sentinel
 * ─ FIX 9: isTrending "all" → null
 * ─ FIX 10: parentLabel as value (not function)
 * ─ FIX 11: type="button" + aria-label on all X buttons
 * ─ FIX 12: sort value toLowerCase()
 * ─ FIX 13: toggleExpanded in useCallback
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  Search,
  X,
  TrendingUp,
  FolderTree,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ListFilter,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenreFilterParams } from "@/features/genre/types";
import { useDebounce } from "@/hooks/useDebounce";
import { GenreSelector } from "./GenreSelector";
import { useGenreTreeQuery } from "@/features/genre/hooks/useGenresQuery";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { useAppSelector } from "@/store/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface GenreFiltersProps {
  params: GenreFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof GenreFilterParams,
    value: GenreFilterParams[keyof GenreFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: "Mặc định (Priority)", value: "priority" },
  { label: "Phổ biến nhất", value: "popular" },
  { label: "Tên (A–Z)", value: "name" },
  { label: "Mới nhất", value: "newest" },
] as const;

const EXPAND_PANEL_ID = "genre-filter-panel";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TAG DEFS — wave-3 (cyan) spectrum for genre identity
// bgClass drives colored mini icon-bubble per chip
// ─────────────────────────────────────────────────────────────────────────────
const TAG_DEFS = {
  status: {
    label: "Trạng thái",
    icon: Eye,
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
  },
  parentId: {
    label: "Cấp bậc",
    icon: FolderTree,
    iconColor: "hsl(var(--wave-3))",
    bgClass: "bg-cyan-500/10",
  },
  isTrending: {
    label: "Xu hướng",
    icon: TrendingUp,
    iconColor: "hsl(var(--wave-2))",
    bgClass: "bg-pink-500/10",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — ambient glow ring + brand icon state
// ─────────────────────────────────────────────────────────────────────────────
const SearchInput = memo(
  ({
    value,
    onChange,
    onClear,
  }: {
    value: string;
    onChange: (val: string) => void;
    onClear: () => void;
  }) => (
    <div className="relative w-full group">
      {/* Ambient glow activates on focus-within */}
      <div
        className={cn(
          "absolute -inset-px rounded-xl pointer-events-none",
          "bg-gradient-to-r from-wave-3/20 via-brand-500/15 to-wave-2/20",
          "opacity-0 group-focus-within:opacity-100",
          "transition-opacity duration-300 blur-sm",
        )}
        aria-hidden="true"
      />

      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <Search
          className={cn(
            "size-4 transition-colors duration-200",
            value
              ? "text-primary"
              : "text-muted-foreground/50 group-focus-within:text-primary/70",
          )}
          aria-hidden="true"
        />
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm kiếm thể loại, tâm trạng…"
        aria-label="Search genres"
        className={cn(
          "h-11 pl-10 pr-10 text-sm",
          "bg-background/60 dark:bg-surface-1/60",
          "border-border/70 hover:border-border-strong",
          "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20",
          "rounded-xl backdrop-blur-sm",
          "placeholder:text-muted-foreground/40",
          "transition-all duration-200",
        )}
      />

      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 z-10",
            "p-1 rounded-full",
            "text-muted-foreground/60 hover:text-foreground hover:bg-muted/70",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER LABEL — .text-overline token + wave-spectrum icon color
// ─────────────────────────────────────────────────────────────────────────────
const FilterLabel = memo(
  ({
    icon: Icon,
    text,
    iconColor,
    htmlFor,
  }: {
    icon: React.ElementType;
    text: string;
    iconColor?: string;
    htmlFor?: string;
  }) => (
    <label
      htmlFor={htmlFor}
      className="text-overline text-muted-foreground/60 flex items-center gap-1.5 ml-0.5 mb-1.5"
    >
      <Icon
        className="size-3 shrink-0"
        style={iconColor ? { color: iconColor } : undefined}
        aria-hidden="true"
      />
      {text}
    </label>
  ),
);
FilterLabel.displayName = "FilterLabel";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE FILTER TAG — isolated memo, colored icon-bubble pill
// FIX 11: type="button" + aria-label on X button
// ─────────────────────────────────────────────────────────────────────────────
interface ActiveFilterTagProps {
  label: string;
  displayValue: string;
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
  onRemove: () => void;
  ariaLabel: string;
}

const ActiveFilterTag = memo(
  ({
    label,
    displayValue,
    icon: Icon,
    iconColor,
    bgClass,
    onRemove,
    ariaLabel,
  }: ActiveFilterTagProps) => (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-full",
        "border border-border/60 bg-card/60 backdrop-blur-sm",
        "shadow-raised hover:shadow-elevated",
        "cursor-default transition-all duration-150",
        "animate-fade-in",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center size-4 rounded-full shrink-0",
          bgClass,
        )}
      >
        <Icon
          className="size-2.5"
          style={{ color: iconColor }}
          aria-hidden="true"
        />
      </span>
      <span className="text-[10px] text-muted-foreground font-medium">
        {label}:
      </span>
      <span className="text-[10px] font-semibold text-foreground capitalize max-w-[120px] truncate">
        {displayValue}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ariaLabel}
        className={cn(
          "ml-0.5 p-0.5 rounded-full shrink-0",
          "text-muted-foreground/50",
          "hover:text-destructive hover:bg-destructive/10",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40",
        )}
      >
        <X className="size-2.5" aria-hidden="true" />
      </button>
    </div>
  ),
);
ActiveFilterTag.displayName = "ActiveFilterTag";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TAGS BAR — divider-glow accent + Sparkles eyebrow
// ─────────────────────────────────────────────────────────────────────────────
const ActiveTagsBar = memo(
  ({
    params,
    activeCount,
    parentLabel,
    onRemoveFilter,
    onReset,
  }: {
    params: GenreFilterParams;
    activeCount: number;
    parentLabel: string | null;
    onRemoveFilter: (key: keyof GenreFilterParams) => void;
    onReset: () => void;
  }) => {
    if (activeCount === 0) return null;

    return (
      <div
        className={cn(
          "relative px-4 py-3",
          "border-t border-border/50 bg-muted/10 backdrop-blur-sm",
          "flex flex-wrap items-center gap-2",
          "animate-fade-down",
        )}
      >
        <div className="divider-glow absolute top-0 left-4 right-4 h-px" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="size-3 text-primary/60" aria-hidden="true" />
          <span className="text-overline text-muted-foreground/50">
            Đang lọc:
          </span>
        </div>

        {/* Status */}
        {params.status && params.status !== "all" && (
          <ActiveFilterTag
            label={TAG_DEFS.status.label}
            displayValue={params.status === "active" ? "Hoạt động" : "Ẩn"}
            icon={TAG_DEFS.status.icon}
            iconColor={TAG_DEFS.status.iconColor}
            bgClass={TAG_DEFS.status.bgClass}
            onRemove={() => onRemoveFilter("status")}
            ariaLabel="Remove status filter"
          />
        )}

        {/* Parent hierarchy */}
        {params.parentId && params.parentId !== "all" && (
          <ActiveFilterTag
            label={TAG_DEFS.parentId.label}
            displayValue={parentLabel ?? "Danh mục cụ thể"}
            icon={TAG_DEFS.parentId.icon}
            iconColor={TAG_DEFS.parentId.iconColor}
            bgClass={TAG_DEFS.parentId.bgClass}
            onRemove={() => onRemoveFilter("parentId")}
            ariaLabel="Remove parent filter"
          />
        )}

        {/* Trending */}
        {params.isTrending !== undefined && (
          <ActiveFilterTag
            label={TAG_DEFS.isTrending.label}
            displayValue="Đang thịnh hành"
            icon={TAG_DEFS.isTrending.icon}
            iconColor={TAG_DEFS.isTrending.iconColor}
            bgClass={TAG_DEFS.isTrending.bgClass}
            onRemove={() => onRemoveFilter("isTrending")}
            ariaLabel="Remove trending filter"
          />
        )}

        <button
          type="button"
          onClick={onReset}
          aria-label="Clear all filters"
          className="btn-danger btn-sm ml-auto h-7 px-3 gap-1.5 text-[11px]"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Xóa bộ lọc
        </button>
      </div>
    );
  },
);
ActiveTagsBar.displayName = "ActiveTagsBar";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TOGGLE BUTTON — gradient-brand counter, shadow-brand when active
// ─────────────────────────────────────────────────────────────────────────────
const FilterToggleButton = memo(
  ({
    isExpanded,
    activeCount,
    onClick,
    panelId,
  }: {
    isExpanded: boolean;
    activeCount: number;
    onClick: () => void;
    panelId: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isExpanded}
      aria-controls={panelId}
      className={cn(
        "h-11 px-4 gap-2",
        "inline-flex items-center justify-between shrink-0",
        "rounded-xl border text-sm font-medium",
        "transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        isExpanded
          ? [
              "border-primary/40 bg-primary/10 text-primary",
              "hover:bg-primary/15 shadow-brand",
            ]
          : [
              "border-border/70 bg-background/60 dark:bg-surface-1/60 text-foreground",
              "hover:bg-accent/50 hover:border-border-strong shadow-raised backdrop-blur-sm",
            ],
      )}
    >
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:block">Bộ lọc</span>
      </div>

      <div className="flex items-center gap-1.5 ml-1">
        {activeCount > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 px-1 items-center justify-center",
              "rounded-full text-[10px] font-black text-white",
              "gradient-brand shadow-glow-xs",
            )}
            aria-label={`${activeCount} active filters`}
          >
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground/60",
            "transition-transform duration-200",
            isExpanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </div>
    </button>
  ),
);
FilterToggleButton.displayName = "FilterToggleButton";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE FILTERS — main orchestrator (FIX 3: memo)
// ─────────────────────────────────────────────────────────────────────────────
export const GenreFilters = memo<GenreFiltersProps>(
  ({ params, onSearch, onFilterChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);
    const { user } = useAppSelector((s) => s.auth);

    const { data: genres } = useGenreTreeQuery();

    // ── Search debounce ─────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);

    // FIX 7: one-way sync URL → input only
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (debouncedSearch !== (params.keyword || "")) {
        onSearch(debouncedSearch);
      }
    }, [debouncedSearch, params.keyword, onSearch]);

    // FIX 6: immediate clear bypasses debounce
    const handleClearSearch = useCallback(() => {
      setLocalSearch("");
      onSearch("");
    }, [onSearch]);

    // ── Panel expand — FIX 1+2 preserved ────────────────────────────────────
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = gridRef.current;
      if (!el) return;
      if (isExpanded) {
        const onEnd = (e: TransitionEvent) => {
          if (e.target === el && e.propertyName === "grid-template-rows") {
            setPanelOverflow(true);
          }
        };
        el.addEventListener("transitionend", onEnd);
        return () => el.removeEventListener("transitionend", onEnd);
      } else {
        setPanelOverflow(false);
      }
    }, [isExpanded]);

    // FIX 10: parentLabel as computed value (not function reference)
    const parentLabel = useMemo<string | null>(() => {
      if (!params.parentId || params.parentId === "all") return null;
      if (params.parentId === "root") return "Root Only";
      const found = genres?.find((g) => g._id === params.parentId);
      return found ? `Con của: "${found.name}"` : "Danh mục cụ thể";
    }, [params.parentId, genres]);

    // FIX 4: granular deps — keyword/sort don't affect count
    const activeFiltersCount = useMemo(() => {
      let n = 0;
      if (params.status && params.status !== "all") n++;
      if (params.parentId && params.parentId !== "all") n++;
      if (params.isTrending !== undefined) n++;
      return n;
    }, [params.status, params.parentId, params.isTrending]);

    // FIX 5+8: stable ref; null sentinel
    const removeFilter = useCallback(
      (key: keyof GenreFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    // FIX 13: stable ref
    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    return (
      <div className="w-full">
        <div
          className={cn(
            "relative overflow-hidden",
            "rounded-2xl border border-border/60",
            "bg-card/50 dark:bg-surface-1/50 backdrop-blur-md",
            "transition-shadow duration-300 hover:shadow-elevated",
            activeFiltersCount > 0 && "border-primary/20 shadow-brand",
          )}
        >
          {/* Top accent line when filters active */}
          {activeFiltersCount > 0 && (
            <div className="absolute inset-x-0 top-0 h-px gradient-wave opacity-60" />
          )}

          {/* ── TOP ROW ── */}
          <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 min-w-0">
              <SearchInput
                value={localSearch}
                onChange={setLocalSearch}
                onClear={handleClearSearch}
              />
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Sort — FIX 12: toLowerCase() */}
              <Select
                value={(params.sort || "priority").toLowerCase()}
                onValueChange={(val) => onFilterChange("sort", val)}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 w-[172px]",
                    "bg-background/60 dark:bg-surface-1/60 backdrop-blur-sm",
                    "border-border/70 hover:border-border-strong",
                    "rounded-xl text-sm shadow-raised transition-all duration-150",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <ListFilter
                      className="size-3.5 text-muted-foreground/50 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-overline text-muted-foreground/50 hidden md:block shrink-0">
                      Sắp xếp:
                    </span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator
                orientation="vertical"
                className="h-6 hidden sm:block opacity-50"
                aria-hidden="true"
              />

              <FilterToggleButton
                isExpanded={isExpanded}
                activeCount={activeFiltersCount}
                onClick={toggleExpanded}
                panelId={EXPAND_PANEL_ID}
              />
            </div>
          </div>

          {/* ── EXPANDABLE PANEL — FIX 2: gridRef on outer wrapper ── */}
          <div
            ref={gridRef}
            id={EXPAND_PANEL_ID}
            role="region"
            aria-label="Genre filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            {/* FIX 1: overflow only after transitionend on outer el */}
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Status — admin only */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={Eye}
                      text="Trạng thái"
                      iconColor="hsl(var(--info))"
                    />
                    <Select
                      value={params.status || "all"}
                      onValueChange={(val) =>
                        onFilterChange("status", val === "all" ? null : val)
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="Tất cả" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="active">Đang hoạt động</SelectItem>
                        <SelectItem value="inactive">Đang ẩn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Parent hierarchy — FIX 10: onClear → null */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={FolderTree}
                    text="Cấp bậc"
                    iconColor="hsl(var(--wave-3))"
                  />
                  <FilterDropdown
                    isActive={!!params.parentId}
                    onClear={() => onFilterChange("parentId", null)}
                    label={
                      <span className="truncate">
                        {params.parentId
                          ? (parentLabel ?? "Filtered")
                          : "Chọn thể loại cha"}
                      </span>
                    }
                    contentClassName="w-[280px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.parentId && "border-cyan-500/40 text-foreground",
                    )}
                  >
                    <div className="p-1">
                      <GenreSelector
                        variant="filter"
                        singleSelect
                        value={params.parentId}
                        onChange={(val) => onFilterChange("parentId", val)}
                        placeholder="Tìm kiếm thể loại…"
                      />
                    </div>
                  </FilterDropdown>
                </div>

                {/* Trending — FIX 9: null for "all" case */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={TrendingUp}
                    text="Xu hướng"
                    iconColor="hsl(var(--wave-2))"
                  />
                  <Select
                    value={
                      params.isTrending === undefined
                        ? "all"
                        : String(params.isTrending)
                    }
                    onValueChange={(val) =>
                      onFilterChange(
                        "isTrending",
                        val === "all" ? null : val === "true",
                      )
                    }
                  >
                    <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="true">Đang thịnh hành</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTIVE TAGS BAR ── */}
          <div className="relative">
            <ActiveTagsBar
              params={params}
              activeCount={activeFiltersCount}
              parentLabel={parentLabel}
              onRemoveFilter={removeFilter}
              onReset={onReset}
            />
          </div>
        </div>
      </div>
    );
  },
);

GenreFilters.displayName = "GenreFilters";
export default GenreFilters;
