"use client";

/**
 * @file MoodVideoFilter.tsx — Mood Video catalog search + filter bar (v4.0 — Soundwave Premium)
 *
 * FULL ALIGNMENT WITH PlaylistFilter v4.0:
 * ─ SearchInput: ambient focus glow (wave-3/wave-2 cyan-pink spectrum = mood identity)
 * ─ FilterToggleButton: extracted memo, gradient-brand counter badge, aria-expanded/controls
 * ─ ActiveFilterTag: colored icon-bubble per filter (wave-spectrum system)
 * ─ ActiveTagsBar: divider-glow accent line + Sparkles eyebrow icon
 * ─ Card wrapper: border-primary/20 + shadow-brand + gradient-wave top line when active
 * ─ FilterLabel: iconColor prop per section (wave-spectrum)
 * ─ Mood identity: wave-3 (cyan) primary = consistent with MoodVideo page palette
 *
 * ALL BUG FIXES FROM PlaylistFilter v4.0 APPLIED:
 * ─ FIX 1+2: transitionend on outer grid div, target+propertyName guard
 * ─ FIX 3: React.memo applied
 * ─ FIX 4: removeFilter sends null not undefined
 * ─ FIX 5: handleClearSearch bypasses debounce
 * ─ FIX 6: URL→input one-way sync guard
 * ─ FIX 7: sort value toLowerCase()
 * ─ FIX 9: null for "all" select values
 * ─ FIX 10: stable toggleExpanded ref via useCallback
 * ─ FIX 11: aria-expanded + aria-controls on filter toggle
 * ─ FIX 12: id + role + aria-label on expandable region
 * ─ FIX 13: type="button" + aria-label on all X buttons
 * ─ FIX 15: memo on all sub-components
 * ─ FIX 16: null removal sentinel
 * ─ FIX 17: aria-hidden on decorative icons
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  useRef,
} from "react";
import {
  X,
  Search,
  SlidersHorizontal,
  Eye,
  Trash2,
  ListFilter,
  ChevronDown,
  Sparkles,
  Hash,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoodVideoFilterParams } from "@/features/mood-video/types";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MoodVideoFilterProps {
  params: MoodVideoFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof MoodVideoFilterParams,
    value: MoodVideoFilterParams[keyof MoodVideoFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — module scope, zero re-allocation per render
// ─────────────────────────────────────────────────────────────────────────────

const EXPAND_PANEL_ID = "mood-video-filter-panel";

/** Mood quick-tag shortcuts — drives tag pill row in expanded panel */
const MOOD_QUICK_TAGS = [
  "Sad",
  "Lofi",
  "Chill",
  "Rain",
  "Focus",
  "Upbeat",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TAG DEFS — wave-3 (cyan) spectrum for mood identity
// Matches PlaylistFilter FILTER_TAG_DEFS pattern exactly
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_TAG_DEFS = [
  {
    key: "isActive" as const,
    label: "Status",
    icon: Activity,
    iconColor: "hsl(var(--wave-3))",
    bgClass: "bg-cyan-500/10",
  },
] as const;

type FilterTagKey = (typeof FILTER_TAG_DEFS)[number]["key"];

/** Pure helper — no closure deps, safe at module scope */
function getTagDisplayValue(
  key: FilterTagKey,
  params: MoodVideoFilterParams,
): string | null {
  switch (key) {
    case "isActive":
      return params.isActive !== undefined
        ? params.isActive
          ? "Active"
          : "Inactive"
        : null;
    default:
      return null;
  }
}

/** Context-aware icon + color for isActive chips */
function getStatusMeta(isActive: boolean): {
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
} {
  return isActive
    ? {
        icon: CheckCircle2,
        iconColor: "hsl(var(--success))",
        bgClass: "bg-success/10",
      }
    : {
        icon: XCircle,
        iconColor: "hsl(var(--error))",
        bgClass: "bg-error/10",
      };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — ambient focus glow in wave-3/wave-2 cyan-pink spectrum
// Mirrors PlaylistFilter SearchInput exactly
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
      {/* Ambient glow — wave-3 cyan identity */}
      <div
        className={cn(
          "absolute -inset-px rounded-xl pointer-events-none",
          "bg-gradient-to-r from-[hsl(var(--wave-3)/0.2)] via-[hsl(var(--brand-500)/0.15)] to-[hsl(var(--wave-2)/0.2)]",
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
        placeholder="Search by title or #tags…"
        aria-label="Search mood videos"
        className={cn(
          "h-11 pl-10 pr-10 text-sm",
          "bg-background/60 dark:bg-surface-1/60",
          "border-border/70 hover:border-border-strong",
          "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20",
          "rounded-xl backdrop-blur-sm",
          "placeholder:text-muted-foreground",
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
// Direct port from PlaylistFilter FilterLabel
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
// FIX 13: type="button" + aria-label on X button
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveFilterTagProps {
  label: string;
  displayValue: string;
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
  onRemove: () => void;
}

const ActiveFilterTag = memo(
  ({
    label,
    displayValue,
    icon: Icon,
    iconColor,
    bgClass,
    onRemove,
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
      <span className="text-[10px] font-semibold text-foreground capitalize">
        {displayValue}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
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
// Mirrors PlaylistFilter ActiveTagsBar pattern with context-aware icon override
// ─────────────────────────────────────────────────────────────────────────────

const ActiveTagsBar = memo(
  ({
    params,
    activeCount,
    onRemoveFilter,
    onReset,
  }: {
    params: MoodVideoFilterParams;
    activeCount: number;
    onRemoveFilter: (key: keyof MoodVideoFilterParams) => void;
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
            Filters:
          </span>
        </div>

        {FILTER_TAG_DEFS.map((def) => {
          const displayValue = getTagDisplayValue(def.key, params);
          if (!displayValue) return null;

          // Context-aware icon overrides for isActive
          let icon: React.ElementType = def.icon;
          let iconColor: string = def.iconColor as string;
          let bgClass: string = def.bgClass as string;

          if (def.key === "isActive" && params.isActive !== undefined) {
            const meta = getStatusMeta(params.isActive);
            icon = meta.icon;
            iconColor = meta.iconColor;
            bgClass = meta.bgClass;
          }

          return (
            <ActiveFilterTag
              key={def.key}
              label={def.label}
              displayValue={displayValue}
              icon={icon}
              iconColor={iconColor}
              bgClass={bgClass}
              onRemove={() => onRemoveFilter(def.key)}
            />
          );
        })}

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
// FILTER TOGGLE BUTTON — gradient-brand counter, shadow-brand active
// FIX 10: stable ref via memo. FIX 11: aria-expanded + aria-controls
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
// ICON SELECT ITEM — reusable rich select option
// ─────────────────────────────────────────────────────────────────────────────

const IconSelectItem = memo(
  ({
    value,
    icon: Icon,
    iconColor,
    label,
  }: {
    value: string;
    icon: React.ElementType;
    iconColor: string;
    label: string;
  }) => (
    <SelectItem value={value}>
      <span className="flex items-center gap-2">
        <Icon
          className="size-3.5 shrink-0"
          style={{ color: iconColor }}
          aria-hidden="true"
        />
        {label}
      </span>
    </SelectItem>
  ),
);
IconSelectItem.displayName = "IconSelectItem";

// ─────────────────────────────────────────────────────────────────────────────
// MOOD QUICK TAG PILL — isolated memo for tag shortcuts in expanded panel
// ─────────────────────────────────────────────────────────────────────────────

const MoodTagPill = memo(
  ({ tag, onClick }: { tag: string; onClick: (tag: string) => void }) => (
    <button
      type="button"
      onClick={() => onClick(tag)}
      aria-label={`Search for #${tag}`}
      className={cn(
        "px-3 py-1 text-[10px] font-bold rounded-full",
        "border border-border/60",
        "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      #{tag}
    </button>
  ),
);
MoodTagPill.displayName = "MoodTagPill";

// ─────────────────────────────────────────────────────────────────────────────
// MOOD VIDEO FILTER — main orchestrator (FIX 3: memo)
// ─────────────────────────────────────────────────────────────────────────────

const MoodVideoFilter = memo<MoodVideoFilterProps>(
  ({ params, onSearch, onFilterChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);

    // ── Search debounce ─────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);

    // FIX 6: one-way sync URL → input only (guard prevents cursor jump)
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (debouncedSearch !== (params.keyword || "")) {
        onSearch(debouncedSearch);
      }
    }, [debouncedSearch, params.keyword, onSearch]);

    // FIX 5: immediate clear bypasses debounce
    const handleClearSearch = useCallback(() => {
      setLocalSearch("");
      onSearch("");
    }, [onSearch]);

    // ── Tag shortcut search ─────────────────────────────────────────────────
    const handleTagSearch = useCallback(
      (tag: string) => {
        setLocalSearch(tag);
        onSearch(tag);
      },
      [onSearch],
    );

    // ── Panel expand — FIX 1+2: transitionend guard ─────────────────────────
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = gridRef.current;
      if (!el) return;
      if (isExpanded) {
        const onEnd = (e: TransitionEvent) => {
          // FIX 2: guard target + propertyName to avoid sibling transitions firing
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

    // ── Active count — granular deps, not full params object ────────────────
    const activeFiltersCount = useMemo(() => {
      let n = 0;
      if (params.isActive !== undefined) n++;
      return n;
    }, [params.isActive]);

    // FIX 4+16: null sentinel — removeFilter sends null, not undefined
    const removeFilter = useCallback(
      (key: keyof MoodVideoFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    // FIX 10: stable ref, never recreated
    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    return (
      <div className="w-full">
        <div
          className={cn(
            "relative overflow-hidden",
            "rounded-2xl border border-border/60",
            "bg-card/50 dark:bg-surface-1/20 backdrop-blur-md",
            "transition-shadow duration-300 hover:shadow-elevated",
            activeFiltersCount > 0 && "border-primary/20 shadow-brand",
          )}
        >
          {/* Top accent line when filters active — gradient-wave token */}
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
              {/* Sort — FIX 7: value toLowerCase() ensures consistent casing */}
              <Select
                value={(params.sort || "newest").toLowerCase()}
                onValueChange={(val) => onFilterChange("sort", val)}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 w-[164px]",
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
                  <SelectItem value="newest">Latest Upload</SelectItem>
                  <SelectItem value="popular">Most Used</SelectItem>
                  <SelectItem value="name">Name A – Z</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
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

          {/* ── EXPANDABLE PANEL ──
           * FIX 1+2: gridRef on outer wrapper, transitionend guards target+propertyName
           * FIX 12: id + role + aria-label for screen readers
           */}
          <div
            ref={gridRef}
            id={EXPAND_PANEL_ID}
            role="region"
            aria-label="Mood video filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            {/* FIX 1: overflow only after transitionend resolves on outer el */}
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Visibility Status — FIX 9: null for "all" */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Eye}
                    text="Visibility Status"
                    iconColor="hsl(var(--wave-3))"
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
                    <SelectTrigger
                      className={cn(
                        "w-full h-9 text-sm rounded-lg",
                        "bg-background/80 border-border/70",
                        "shadow-raised focus:ring-1 focus:ring-primary/30",
                      )}
                    >
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <IconSelectItem
                        value="true"
                        icon={CheckCircle2}
                        iconColor="hsl(var(--success))"
                        label="Active (Shown)"
                      />
                      <IconSelectItem
                        value="false"
                        icon={XCircle}
                        iconColor="hsl(var(--error))"
                        label="Inactive (Hidden)"
                      />
                    </SelectContent>
                  </Select>
                </div>

                {/* Mood Quick Tags — drives search keyword shortcut */}
                <div className="space-y-0 sm:col-span-2 lg:col-span-2">
                  <FilterLabel
                    icon={Hash}
                    text="Mood Quick Tags"
                    iconColor="hsl(var(--wave-4))"
                  />
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {MOOD_QUICK_TAGS.map((tag) => (
                      <MoodTagPill
                        key={tag}
                        tag={tag}
                        onClick={handleTagSearch}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTIVE TAGS BAR — FIX 16: null sentinel via removeFilter ── */}
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

MoodVideoFilter.displayName = "MoodVideoFilter";
export default MoodVideoFilter;
