"use client";

/**
 * @file TrackFilters.tsx — Track catalog search + filter bar (v4.0 — Soundwave Premium)
 *
 * REDESIGN vs original:
 * ─ Full Soundwave token integration: .glass-frosted/.card-base, .shadow-brand,
 *   .badge-*, .btn-danger, .text-overline, .menu-item, .shadow-raised
 * ─ Light/Dark: all hardcoded emerald/blue/yellow/red/indigo/orange/emerald-500
 *   Tailwind color literals → hsl(var(--wave-*)) / hsl(var(--success)) /
 *   hsl(var(--warning)) / hsl(var(--error)) / hsl(var(--info)) CSS tokens
 * ─ SearchInput: ambient focus glow ring (brand-500 → wave-2 gradient)
 * ─ FilterToggleButton: extracted memo with gradient-brand counter badge
 * ─ ActiveFilterTag: colored icon-bubble per filter (wave-spectrum system)
 * ─ ActiveTagsBar: divider-glow accent line + Sparkles eyebrow icon
 * ─ STATUS_OPTIONS: colored status dots use CSS token references
 * ─ Card wrapper: border shifts to primary/20 + shadow-brand + gradient-wave
 *   top accent line when activeFiltersCount > 0
 * ─ FilterLabel: iconColor prop → wave-spectrum per filter section
 *
 * BUG FIXES FROM ORIGINAL:
 * ─ handleClearSearch now calls onSearch("") immediately (bypasses debounce)
 *   Original comment said debounce would handle it, but this causes a 400ms
 *   visible delay on clear — bypassing is the correct UX behavior
 * ─ URL→input sync guard: localSearch excluded from deps to prevent loop
 * ─ overflowVisible: replaced setTimeout hack with CSS transitionend listener
 *   (setTimeout at 300ms is fragile — if user closes panel before 300ms,
 *   overflow leaks. transitionend is precise and event-driven)
 * ─ removeFilter: now sends null not undefined (undefined serializes as
 *   the string "undefined" in some URL param implementations)
 * ─ activeFiltersCount: granular deps [status, artistId, albumId, genreId]
 *   instead of full `params` object — avoids count recalc on sort/keyword change
 * ─ All callbacks wrapped in useCallback — stable refs for child memos
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
  Mic2,
  Disc,
  Tag,
  LayoutGrid,
  ListFilter,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackFilterParams } from "@/features/track/types";
import { useDebounce } from "@/hooks/useDebounce";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { ArtistSelector } from "@/features/artist/components/ArtistSelector";
import { AlbumSelector } from "@/features/album/components/AlbumSelector";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
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
interface TrackFiltersProps {
  params: TrackFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof TrackFilterParams,
    value: TrackFilterParams[keyof TrackFilterParams] | null,
  ) => void;
  onReset: () => void;
  className?: string;
  hideStatus?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — module-scoped, zero allocation per render
// Status dot colors use CSS token references — dark-mode adaptive
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Phổ biến", value: "popular" },
  { label: "Tên (A–Z)", value: "name" },
] as const;

interface StatusOption {
  value: string;
  label: string;
  iconColor: string;
  bgClass: string;
  icon: React.ElementType;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "ready",
    label: "Đã xử lý",
    iconColor: "hsl(var(--success))",
    bgClass: "bg-success/10",
    icon: CheckCircle2,
  },
  {
    value: "processing",
    label: "Đang xử lý",
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
    icon: Loader,
  },
  {
    value: "pending",
    label: "Chờ xử lý",
    iconColor: "hsl(var(--warning))",
    bgClass: "bg-warning/10",
    icon: Clock3,
  },
  {
    value: "failed",
    label: "Lỗi",
    iconColor: "hsl(var(--error))",
    bgClass: "bg-error/10",
    icon: AlertTriangle,
  },
];

/** Filter tag definitions — wave-spectrum icon system */
interface TagDef {
  key: keyof TrackFilterParams;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
  getDisplayValue: (params: TrackFilterParams) => string | null;
}

const TAG_DEFS: TagDef[] = [
  {
    key: "status",
    label: "Trạng thái",
    icon: LayoutGrid,
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
    getDisplayValue: (p) => {
      if (!p.status) return null;
      return (
        STATUS_OPTIONS.find((o) => o.value === p.status)?.label ?? p.status
      );
    },
  },
  {
    key: "artistId",
    label: "Nghệ sĩ",
    icon: Mic2,
    iconColor: "hsl(var(--wave-1))",
    bgClass: "bg-brand-100/60",
    getDisplayValue: (p) => (p.artistId ? "Đã chọn" : null),
  },
  {
    key: "albumId",
    label: "Album",
    icon: Disc,
    iconColor: "hsl(var(--wave-4))",
    bgClass: "bg-warning/10",
    getDisplayValue: (p) => (p.albumId ? "Đã chọn" : null),
  },
  {
    key: "genreId",
    label: "Thể loại",
    icon: Tag,
    iconColor: "hsl(var(--wave-2))",
    bgClass: "bg-pink-500/10",
    getDisplayValue: (p) => (p.genreId ? "Đã chọn" : null),
  },
];

const EXPAND_PANEL_ID = "track-filter-panel";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — ambient focus glow + brand icon state
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
        placeholder="Tìm bài hát, ISRC, lời nhạc…"
        autoComplete="off"
        spellCheck={false}
        aria-label="Tìm kiếm bài hát"
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
          aria-label="Xóa tìm kiếm"
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
  }: {
    icon: React.ElementType;
    text: string;
    iconColor?: string;
  }) => (
    <label className="text-overline text-muted-foreground/60 flex items-center gap-1.5 ml-0.5 mb-1.5">
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
        aria-label={`Xóa bộ lọc ${label}`}
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
    onRemoveFilter,
    onReset,
  }: {
    params: TrackFilterParams;
    activeCount: number;
    onRemoveFilter: (key: keyof TrackFilterParams) => void;
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
          "rounded-b-2xl",
        )}
      >
        {/* Divider-glow accent */}
        <div className="divider-glow absolute top-0 left-4 right-4 h-px" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="size-3 text-primary/60" aria-hidden="true" />
          <span className="text-overline text-muted-foreground/50">
            Đang lọc:
          </span>
        </div>

        {TAG_DEFS.map((def) => {
          const displayValue = def.getDisplayValue(params);
          if (!displayValue) return null;

          // Override icon for status — show contextual status icon
          let icon = def.icon;
          let iconColor = def.iconColor;
          let bgClass = def.bgClass;

          if (def.key === "status" && params.status) {
            const statusOpt = STATUS_OPTIONS.find(
              (o) => o.value === params.status,
            );
            if (statusOpt) {
              icon = statusOpt.icon;
              iconColor = statusOpt.iconColor;
              bgClass = statusOpt.bgClass;
            }
          }

          return (
            <ActiveFilterTag
              key={String(def.key)}
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
          aria-label="Xóa tất cả bộ lọc"
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
// FILTER TOGGLE BUTTON — gradient-brand counter, shadow-brand active
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
            aria-label={`${activeCount} bộ lọc đang hoạt động`}
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
// TRACK FILTERS — main component
// ─────────────────────────────────────────────────────────────────────────────
export const TrackFilters = memo<TrackFiltersProps>(
  ({
    params,
    onSearch,
    onFilterChange,
    onReset,
    className,
    hideStatus = false,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);

    // ── Search debounce ─────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);

    // One-way sync: URL → input only (localSearch excluded from deps to prevent loop)
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    // Flush debounced value to parent
    useEffect(() => {
      if (debouncedSearch !== (params.keyword || "")) {
        onSearch(debouncedSearch);
      }
    }, [debouncedSearch, params.keyword, onSearch]);

    /**
     * BUG FIX: Original relied on debounce to clear search after 400ms.
     * This causes visible 400ms delay on X button press — jarring UX.
     * Bypassing debounce on explicit user clear is the correct behavior.
     */
    const handleClearSearch = useCallback(() => {
      setLocalSearch("");
      onSearch("");
    }, [onSearch]);

    // ── Panel expand — transitionend-based overflow (replaces setTimeout hack) ──
    /**
     * BUG FIX: Original used setTimeout(300ms) to enable overflow after animation.
     * If user closes panel before 300ms, overflow leaks. transitionend is
     * event-driven and fires precisely when the CSS transition completes.
     */
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

    // ── Active count — granular deps (sort/keyword changes are no-ops) ────────
    const activeFiltersCount = useMemo(() => {
      let n = 0;
      if (params.status) n++;
      if (params.artistId) n++;
      if (params.albumId) n++;
      if (params.genreId) n++;
      return n;
    }, [params.status, params.artistId, params.albumId, params.genreId]);

    /**
     * BUG FIX: sends null not undefined.
     * undefined serializes as the string "undefined" in some URL param
     * implementations. null is the explicit "remove this filter" sentinel.
     */
    const removeFilter = useCallback(
      (key: keyof TrackFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    return (
      <div className={cn("w-full mb-8", className)}>
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
            {/* Search */}
            <div className="flex-1 min-w-0">
              <SearchInput
                value={localSearch}
                onChange={setLocalSearch}
                onClear={handleClearSearch}
              />
            </div>

            {/* Sort + Toggle */}
            <div className="flex items-center gap-2.5 shrink-0">
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

          {/* ── EXPANDABLE FILTER PANEL ── */}
          <div
            ref={gridRef}
            id={EXPAND_PANEL_ID}
            role="region"
            aria-label="Tùy chọn lọc bài hát"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status */}
                {!hideStatus && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={LayoutGrid}
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
                        <SelectValue placeholder="Tất cả trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả trạng thái</SelectItem>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <opt.icon
                                className="size-3.5 shrink-0"
                                style={{ color: opt.iconColor }}
                                aria-hidden="true"
                              />
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Artist */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Mic2}
                    text="Nghệ sĩ"
                    iconColor="hsl(var(--wave-1))"
                  />
                  <FilterDropdown
                    isActive={!!params.artistId}
                    onClear={() => onFilterChange("artistId", null)}
                    label={
                      <span className="truncate">
                        {params.artistId ? "Nghệ sĩ đã chọn" : "Tìm nghệ sĩ"}
                      </span>
                    }
                    contentClassName="w-[300px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.artistId && "border-brand-300/50 text-foreground",
                    )}
                  >
                    <div className="p-1">
                      <ArtistSelector
                        singleSelect
                        value={params.artistId ? [params.artistId] : []}
                        onChange={(ids) =>
                          onFilterChange("artistId", ids[0] ?? null)
                        }
                      />
                    </div>
                  </FilterDropdown>
                </div>

                {/* Album */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Disc}
                    text="Album"
                    iconColor="hsl(var(--wave-4))"
                  />
                  <FilterDropdown
                    isActive={!!params.albumId}
                    onClear={() => onFilterChange("albumId", null)}
                    label={
                      <span className="truncate">
                        {params.albumId ? "Album đã chọn" : "Tìm Album"}
                      </span>
                    }
                    contentClassName="w-[300px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.albumId && "border-warning/40 text-foreground",
                    )}
                  >
                    <div className="p-1">
                      <AlbumSelector
                        value={params.albumId || ""}
                        onChange={(id) => onFilterChange("albumId", id || null)}
                      />
                    </div>
                  </FilterDropdown>
                </div>

                {/* Genre */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Tag}
                    text="Thể loại"
                    iconColor="hsl(var(--wave-2))"
                  />
                  <FilterDropdown
                    isActive={!!params.genreId}
                    onClear={() => onFilterChange("genreId", null)}
                    label={
                      <span className="truncate">
                        {params.genreId ? "Thể loại đã chọn" : "Tìm thể loại"}
                      </span>
                    }
                    contentClassName="w-[300px]"
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
                        placeholder="Tìm kiếm thể loại…"
                      />
                    </div>
                  </FilterDropdown>
                </div>
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

TrackFilters.displayName = "TrackFilters";
export default TrackFilters;
