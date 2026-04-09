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
  Calendar,
  Mic2,
  Music,
  LayoutGrid,
  Eye,
  Trash2,
  ListFilter,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { YearPicker } from "@/components/ui/YearPicker";
import FilterDropdown from "@/components/ui/FilterDropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArtistSelector } from "@/features/artist/components/ArtistSelector";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
import { useAppSelector } from "@/store/hooks";
import { AlbumFilterParams } from "../schemas/album.schema";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface AlbumFilterProps {
  params: AlbumFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof AlbumFilterParams,
    value: AlbumFilterParams[keyof AlbumFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TAG DEFS — wave-color icon system (dark-mode adaptive tokens)
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_TAG_DEFS = [
  {
    key: "type" as const,
    label: "Type",
    icon: LayoutGrid,
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
  },
  {
    key: "year" as const,
    label: "Year",
    icon: Calendar,
    iconColor: "hsl(var(--success))",
    bgClass: "bg-success/10",
  },
  {
    key: "isPublic" as const,
    label: "Visibility",
    icon: Eye,
    iconColor: "hsl(var(--wave-1))",
    bgClass: "bg-brand-100/60",
  },
  {
    key: "genreId" as const,
    label: "Genre",
    icon: Music,
    iconColor: "hsl(var(--wave-4))",
    bgClass: "bg-warning/10",
  },
  {
    key: "artistId" as const,
    label: "Artist",
    icon: Mic2,
    iconColor: "hsl(var(--wave-2))",
    bgClass: "bg-pink-500/10",
  },
] as const;

type FilterTagKey = (typeof FILTER_TAG_DEFS)[number]["key"];

/** Pure — no closure deps */
function getTagDisplayValue(
  key: FilterTagKey,
  params: AlbumFilterParams,
): string | null {
  switch (key) {
    case "type":
      return params.type ?? null;
    case "year":
      return params.year ? String(params.year) : null;
    case "isPublic":
      return params.isPublic !== undefined
        ? params.isPublic
          ? "Public"
          : "Private"
        : null;
    case "genreId":
      return params.genreId ? "Genre" : null;
    case "artistId":
      return params.artistId ? "Artist" : null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — premium design with animated focus ring + brand glow
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
          "transition-opacity duration-300",
          "blur-sm",
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
        placeholder="Search albums by title, artist, or genre…"
        aria-label="Search albums"
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
            "text-muted-foreground/60 hover:text-foreground",
            "hover:bg-muted/70",
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
// FILTER SECTION LABEL — .text-overline token
// ─────────────────────────────────────────────────────────────────────────────
const FilterLabel = memo(
  ({
    icon: Icon,
    text,
    htmlFor,
    iconColor,
  }: {
    icon: React.ElementType;
    text: string;
    htmlFor?: string;
    iconColor?: string;
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
// ACTIVE FILTER TAG — isolated memo, wave-color icon pill
// Extracted so each chip only re-renders on its own data change.
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
      {/* Colored icon container */}
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
// ACTIVE TAGS BAR — premium frosted strip
// ─────────────────────────────────────────────────────────────────────────────
const ActiveTagsBar = memo(
  ({
    params,
    activeCount,
    onRemoveFilter,
    onReset,
  }: {
    params: AlbumFilterParams;
    activeCount: number;
    onRemoveFilter: (key: keyof AlbumFilterParams) => void;
    onReset: () => void;
  }) => {
    if (activeCount === 0) return null;

    return (
      <div
        className={cn(
          "px-4 py-3",
          "border-t border-border/50",
          "bg-muted/10 backdrop-blur-sm",
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
          return (
            <ActiveFilterTag
              key={def.key}
              label={def.label}
              displayValue={displayValue}
              icon={def.icon}
              iconColor={def.iconColor}
              bgClass={def.bgClass}
              onRemove={() => onRemoveFilter(def.key)}
            />
          );
        })}

        <button
          type="button"
          onClick={onReset}
          aria-label="Clear all filters"
          className={cn(
            "btn-danger btn-sm ml-auto h-7 px-3 gap-1.5",
            "text-[11px]",
          )}
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
// FILTER EXPAND BUTTON — brand-active state with glow shadow
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
              "hover:bg-accent/50 hover:border-border-strong shadow-raised",
              "backdrop-blur-sm",
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
              "rounded-full text-[10px] font-black",
              "orb-float--brand text-white",
              "shadow-glow-xs",
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
// ALBUM FILTER — main orchestrator
// ─────────────────────────────────────────────────────────────────────────────
const EXPAND_PANEL_ID = "album-filter-panel";

const AlbumFilter = memo<AlbumFilterProps>(
  ({ params, onSearch, onFilterChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);
    const { user } = useAppSelector((s) => s.auth);

    // ── Search debounce ─────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);
    const isClearingRef = useRef(false);
    // FIX 6: one-way sync URL → input only
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      // Nếu đang trong quá trình Clear, bỏ qua hiệu ứng Debounce này
      if (isClearingRef.current) {
        isClearingRef.current = false;
        return;
      }

      if (debouncedSearch !== (params.keyword || "")) {
        onSearch(debouncedSearch);
      }
    }, [debouncedSearch, params.keyword, onSearch]);
    // FIX 5: immediate clear bypasses debounce
    const handleClearSearch = useCallback(() => {
      isClearingRef.current = true;
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
      if (params.artistId) n++;
      if (params.year) n++;
      if (params.type) n++;
      if (params.isPublic !== undefined) n++;
      return n;
    }, [
      params.genreId,
      params.artistId,
      params.year,
      params.type,
      params.isPublic,
    ]);

    // FIX 4: null not undefined
    const removeFilter = useCallback(
      (key: keyof AlbumFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    return (
      <div className="w-full">
        {/* ── MAIN CARD WRAPPER ── */}
        <div
          className={cn(
            "relative overflow-hidden",
            "rounded-2xl",
            "bg-card/50 dark:bg-surface-1/2 backdrop-blur-md",
            "transition-shadow duration-300",
            "hover:shadow-elevated",
            activeFiltersCount > 0 && "border-primary/20 shadow-brand",
          )}
        >
          {/* ── TOP ROW: Search + Sort + Toggle ── */}
          <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search — flex-1 */}
            <div className="flex-1 min-w-0">
              <SearchInput
                value={localSearch}
                onChange={setLocalSearch}
                onClear={handleClearSearch}
              />
            </div>

            {/* Sort + Toggle row */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Sort */}
              <Select
                value={(params.sort || "newest").toLowerCase()}
                onValueChange={(val) => onFilterChange("sort", val)}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 w-[148px]",
                    "bg-background/60 dark:bg-surface-1/60 backdrop-blur-sm",
                    "border-border/70 hover:border-border-strong",
                    "rounded-xl text-sm shadow-raised",
                    "transition-all duration-150",
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
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="name">A – Z</SelectItem>
                </SelectContent>
              </Select>

              <Separator
                orientation="vertical"
                className="h-6 hidden sm:block opacity-50"
                aria-hidden="true"
              />

              {/* Filters toggle */}
              <FilterToggleButton
                isExpanded={isExpanded}
                activeCount={activeFiltersCount}
                onClick={toggleExpanded}
                panelId={EXPAND_PANEL_ID}
              />
            </div>
          </div>

          {/* ── EXPANDABLE FILTER PANEL — FIX 2: gridRef on outer wrapper ── */}
          <div
            ref={gridRef}
            id={EXPAND_PANEL_ID}
            role="region"
            aria-label="Album filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out relative",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            <div className="divider-glow absolute top-0 left-4 right-4 h-px" />

            {/* FIX 1: overflow only enabled after transitionend */}
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {/* Visibility — admin only */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={Eye}
                      text="Visibility"
                      iconColor="hsl(var(--wave-1))"
                    />
                    <Select
                      value={
                        params.isPublic === undefined
                          ? "all"
                          : String(params.isPublic)
                      }
                      onValueChange={(val) =>
                        onFilterChange(
                          "isPublic",
                          val === "all" ? null : val === "true",
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="true">Public</SelectItem>
                        <SelectItem value="false">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Type */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={LayoutGrid}
                    text="Type"
                    iconColor="hsl(var(--info))"
                  />
                  <Select
                    value={params.type || "all"}
                    onValueChange={(val) =>
                      onFilterChange("type", val === "all" ? null : val)
                    }
                  >
                    <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="album">Album</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="ep">EP</SelectItem>
                      <SelectItem value="compilation">Compilation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Genre */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Music}
                    text="Genre"
                    iconColor="hsl(var(--wave-4))"
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
                      params.genreId && "border-warning/40 text-foreground",
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

                {/* Artist */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Mic2}
                    text="Artist"
                    iconColor="hsl(var(--wave-2))"
                  />
                  <FilterDropdown
                    isActive={!!params.artistId}
                    onClear={() => onFilterChange("artistId", null)}
                    label={
                      <span className="truncate">
                        {params.artistId ? "Artist selected" : "Select Artist"}
                      </span>
                    }
                    contentClassName="w-[280px]"
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.artistId && "border-pink-500/40 text-foreground",
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

                {/* Year — FIX 9: z-index + isolate wrapper */}
                {/* Year Selector — Dùng FilterDropdown để đồng bộ và chống bị che */}
                <div className="space-y-0">
                  <FilterLabel
                    icon={Calendar}
                    text="Year"
                    iconColor="hsl(var(--success))"
                  />
                  <FilterDropdown
                    isActive={!!params.year}
                    onClear={() => onFilterChange("year", null)}
                    label={params.year ? `Year: ${params.year}` : "Select Year"}
                    className={cn(
                      "w-full bg-background/80 h-9 text-sm font-normal px-3",
                      "justify-start shadow-raised rounded-lg border-border/70",
                      "focus:ring-1 focus:ring-primary/30",
                      params.year && "border-success/40 text-foreground",
                    )}
                    contentClassName="w-[260px] p-0" // p-0 để YearGrid khít với khung
                  >
                    <div className="max-h-[320px] overflow-hidden">
                      <YearPicker
                        variant="form" // Dùng bản inline để nó hiển thị ngay trong Dropdown
                        value={params.year}
                        onChange={(val) => onFilterChange("year", val)}
                        className="border-none shadow-none" // Bỏ viền của YearPicker vì Dropdown đã có
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

AlbumFilter.displayName = "AlbumFilter";
export default AlbumFilter;
