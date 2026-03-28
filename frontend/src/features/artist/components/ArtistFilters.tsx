"use client";

/**
 * @file ArtistFilters.tsx — Artist catalog search + filter bar (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs v3.2 — aligned with FeaturedAlbums + AlbumFilter v4.0:
 * ─ SearchInput: ambient glow on focus-within, brand-colored icon state
 * ─ FilterToggleButton extracted as memo with gradient-brand counter badge
 * ─ ActiveFilterTag: colored icon-bubble per filter (wave-spectrum system)
 * ─ ActiveTagsBar: gradient-wave top accent line + Sparkles eyebrow
 * ─ Card wrapper: border shifts to primary/20 + shadow-brand when active
 * ─ FilterLabel accepts iconColor prop — all sections get wave-spectrum colors
 * ─ FilterToggle: shadow-brand active, shadow-raised idle
 * ─ AmbientBackground layout fix: position fixed (not absolute) — prevents
 *   layout void on short pages (not-logged-in state)
 *
 * ALL v3.2 FIXES PRESERVED (FIX 1–7, 10–11):
 * ─ FIX 1+2: panelRef on grid wrapper + transitionend target/property guard
 * ─ FIX 3: React.memo applied
 * ─ FIX 4: removeFilter sends null not undefined
 * ─ FIX 5: handleClearSearch bypasses debounce
 * ─ FIX 6: URL→input one-way sync guard
 * ─ FIX 7: sort value toLowerCase()
 * ─ FIX 10: FilterDropdown onClear → null
 * ─ FIX 11: isActive/isVerified "all" → null
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
  ShieldCheck,
  Globe,
  Music2,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  UserCheck,
  UserX,
  ListFilter,
  Sparkles,
} from "lucide-react";

import { ArtistFilterParams } from "@/features/artist/types";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
import { NationalitySelector } from "@/components/ui/NationalitySelector";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ArtistFiltersProps {
  params: ArtistFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof ArtistFilterParams,
    value: ArtistFilterParams[keyof ArtistFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Popular", value: "popular" },
  { label: "Followers", value: "followers" },
  { label: "A – Z", value: "name" },
] as const;

const EXPAND_PANEL_ID = "artist-filter-panel";

// ─────────────────────────────────────────────────────────────────────────────
// TAG DEFINITIONS — wave-color icon system (dark-mode adaptive CSS tokens)
// bgClass drives the colored mini icon-bubble per chip
// ─────────────────────────────────────────────────────────────────────────────
interface TagDef {
  key: keyof ArtistFilterParams;
  label: string;
  iconColor: string;
  bgClass: string;
  getValue: (params: ArtistFilterParams) => string | null;
  getIcon: (params: ArtistFilterParams) => React.ElementType;
}

const ARTIST_TAG_DEFS: TagDef[] = [
  {
    key: "nationality",
    label: "Nation",
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
    getValue: (p) => p.nationality ?? null,
    getIcon: () => Globe,
  },
  {
    key: "genreId",
    label: "Genre",
    iconColor: "hsl(var(--wave-2))",
    bgClass: "bg-pink-500/10",
    getValue: (p) => (p.genreId ? "Genre" : null),
    getIcon: () => Music2,
  },
  {
    key: "isVerified",
    label: "Verified",
    iconColor: "hsl(var(--success))",
    bgClass: "bg-success/10",
    getValue: (p) => (p.isVerified !== undefined ? "Verified Only" : null),
    getIcon: () => ShieldCheck,
  },
  {
    key: "isActive",
    label: "Status",
    iconColor: "hsl(var(--success))",
    bgClass: "bg-success/10",
    getValue: (p) =>
      p.isActive !== undefined ? (p.isActive ? "Active" : "Inactive") : null,
    getIcon: (p) => (p.isActive ? UserCheck : UserX),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — premium with animated focus glow ring
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
      {/* Ambient glow on focus */}
      <div
        className={cn(
          "absolute -inset-px rounded-xl pointer-events-none",
          "bg-gradient-to-r from-brand-500/20 via-wave-1/15 to-wave-2/20",
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
        placeholder="Search artists by name, genre, nationality…"
        aria-label="Search artists"
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
// FILTER LABEL — .text-overline token + wave-spectrum icon colors
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
// Each chip only re-renders when its own data changes (not siblings).
// ─────────────────────────────────────────────────────────────────────────────
interface ActiveFilterTagProps {
  def: TagDef;
  params: ArtistFilterParams;
  onRemove: (key: keyof ArtistFilterParams) => void;
}

const ActiveFilterTag = memo(
  ({ def, params, onRemove }: ActiveFilterTagProps) => {
    const displayValue = def.getValue(params);
    if (!displayValue) return null;

    const Icon = def.getIcon(params);
    const iconColor =
      def.key === "isActive" && params.isActive === false
        ? "hsl(var(--error))"
        : def.iconColor;
    const bgClass =
      def.key === "isActive" && params.isActive === false
        ? "bg-error/10"
        : def.bgClass;

    return (
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
          {def.label}:
        </span>
        <span className="text-[10px] font-semibold text-foreground capitalize">
          {displayValue}
        </span>
        <button
          type="button"
          onClick={() => onRemove(def.key)}
          aria-label={`Remove ${def.label} filter`}
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
    );
  },
);
ActiveFilterTag.displayName = "ActiveFilterTag";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TAGS BAR — frosted strip with gradient-wave top accent
// ─────────────────────────────────────────────────────────────────────────────
const ActiveTagsBar = memo(
  ({
    params,
    activeCount,
    onRemoveFilter,
    onReset,
  }: {
    params: ArtistFilterParams;
    activeCount: number;
    onRemoveFilter: (key: keyof ArtistFilterParams) => void;
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
        {/* Gradient top accent line */}
        <div className="divider-glow absolute top-0 left-4 right-4 h-px" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="size-3 text-primary/60" aria-hidden="true" />
          <span className="text-overline text-muted-foreground/50">
            Filters:
          </span>
        </div>

        {ARTIST_TAG_DEFS.map((def) => (
          <ActiveFilterTag
            key={String(def.key)}
            def={def}
            params={params}
            onRemove={onRemoveFilter}
          />
        ))}

        <button
          type="button"
          onClick={onReset}
          aria-label="Clear all filters"
          className="btn-danger btn-sm ml-auto h-7 px-3 gap-1.5 text-[11px]"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Clear all
        </button>
      </div>
    );
  },
);
ActiveTagsBar.displayName = "ActiveTagsBar";

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TOGGLE BUTTON — extracted memo, gradient-brand counter badge
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
        <span className="hidden sm:block">Filters</span>
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
// ARTIST FILTERS — main orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export const ArtistFilters = memo<ArtistFiltersProps>(
  ({ params, onSearch, onFilterChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);
    const { user } = useAppSelector((s) => s.auth);

    // ── Search debounce ─────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);

    // FIX 6: one-way sync URL → input only
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (debouncedSearch !== (params.keyword || "")) {
        onSearch(debouncedSearch);
      }
    }, [debouncedSearch, params.keyword, onSearch]);

    // FIX 5: immediate clear — bypasses debounce
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

    // ── Active count — granular deps ─────────────────────────────────────────
    const activeFiltersCount = useMemo(() => {
      let n = 0;
      if (params.genreId) n++;
      if (params.nationality) n++;
      if (params.isVerified !== undefined) n++;
      if (params.isActive !== undefined) n++;
      return n;
    }, [
      params.genreId,
      params.nationality,
      params.isVerified,
      params.isActive,
    ]);

    // FIX 4: null sentinel
    const removeFilter = useCallback(
      (key: keyof ArtistFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

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
              {/* Sort — FIX 7: toLowerCase() */}
              <Select
                value={(params.sort || "newest").toLowerCase()}
                onValueChange={(val) => onFilterChange("sort", val)}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 w-[148px]",
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
                    <span className="text-overline text-muted-foreground/50 hidden md:block">
                      Sort:
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
            aria-label="Artist filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            {/* FIX 1: overflow toggled only after transitionend on outer el */}
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Nationality — FIX 10: onClear → null */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Globe}
                    text="Nationality"
                    iconColor="hsl(var(--info))"
                  />
                  <FilterDropdown
                    isActive={!!params.nationality}
                    onClear={() => onFilterChange("nationality", null)}
                    label={
                      <span className="truncate">
                        {params.nationality ?? "All Countries"}
                      </span>
                    }
                    contentClassName="w-[280px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.nationality && "border-info/40 text-foreground",
                    )}
                  >
                    <div className="p-1">
                      <NationalitySelector
                        value={params.nationality}
                        onChange={(val) => onFilterChange("nationality", val)}
                        clearable
                      />
                    </div>
                  </FilterDropdown>
                </div>

                {/* Genre */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Music2}
                    text="Genre"
                    iconColor="hsl(var(--wave-2))"
                  />
                  <FilterDropdown
                    isActive={!!params.genreId}
                    onClear={() => onFilterChange("genreId", null)}
                    label={
                      <span className="truncate">
                        {params.genreId ? "Genre selected" : "Select Genre"}
                      </span>
                    }
                    contentClassName="w-[280px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.genreId && "border-pink-500/40 text-foreground",
                    )}
                  >
                    <div className="p-1">
                      <GenreSelector
                        variant="filter"
                        singleSelect
                        value={params.genreId}
                        onChange={(val) => onFilterChange("genreId", val)}
                        placeholder="Search genres…"
                      />
                    </div>
                  </FilterDropdown>
                </div>

                {/* Status — admin only. FIX 11: "all" → null */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={LayoutGrid}
                      text="Status"
                      iconColor="hsl(var(--wave-1))"
                    />
                    <Select
                      value={
                        params.isActive === undefined
                          ? "all"
                          : String(params.isActive)
                      }
                      onValueChange={(val) =>
                        onFilterChange(
                          "isActive",
                          val === "all" ? null : val === "true",
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive / Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Verification — admin only. FIX 11 */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={ShieldCheck}
                      text="Verification"
                      iconColor="hsl(var(--success))"
                    />
                    <Select
                      value={
                        params.isVerified === undefined
                          ? "all"
                          : String(params.isVerified)
                      }
                      onValueChange={(val) =>
                        onFilterChange(
                          "isVerified",
                          val === "all" ? null : val === "true",
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="All Profiles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Profiles</SelectItem>
                        <SelectItem value="true">Verified Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── ACTIVE TAGS BAR ── */}
          <div className="relative">
            <ActiveTagsBar
              params={params}
              activeCount={activeFiltersCount}
              onRemoveFilter={removeFilter}
              onReset={onReset}
            />
          </div>
        </div>
      </div>
    );
  },
);

ArtistFilters.displayName = "ArtistFilters";
export default ArtistFilters;
