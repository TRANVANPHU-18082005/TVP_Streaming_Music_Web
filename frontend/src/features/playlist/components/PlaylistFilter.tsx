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
  Globe,
  Eye,
  ListFilter,
  ChevronDown,
  LayoutTemplate,
  Trash2,
  Lock,
  Link,
  Server,
  User,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useAppSelector } from "@/store/hooks";
import { PlaylistFilterParams } from "../schemas/playlist.schema";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PlaylistFilterProps {
  params: PlaylistFilterParams;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof PlaylistFilterParams,
    value: PlaylistFilterParams[keyof PlaylistFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TAG DEFS — wave-4 (gold) spectrum for playlist identity
// bgClass drives colored mini icon-bubble per chip
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_TAG_DEFS = [
  {
    key: "isSystem" as const,
    label: "Nguồn",
    icon: Server,
    iconColor: "hsl(var(--info))",
    bgClass: "bg-info/10",
  },
  {
    key: "visibility" as const,
    label: "Có thể xem",
    icon: Eye,
    iconColor: "hsl(var(--wave-3))",
    bgClass: "bg-cyan-500/10",
  },
] as const;

type FilterTagKey = (typeof FILTER_TAG_DEFS)[number]["key"];

/** Pure — no closure deps, module-scoped safe */
function getTagDisplayValue(
  key: FilterTagKey,
  params: PlaylistFilterParams,
): string | null {
  switch (key) {
    case "isSystem":
      return params.isSystem !== undefined
        ? params.isSystem
          ? "Hệ thống"
          : "Người dùng"
        : null;
    case "visibility":
      return params.visibility
        ? params.visibility.charAt(0).toUpperCase() + params.visibility.slice(1)
        : null;
    default:
      return null;
  }
}

const EXPAND_PANEL_ID = "playlist-filter-panel";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT — ambient focus glow in wave-4/wave-2 gold-pink spectrum
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
      {/* Ambient glow — wave-4 gold identity */}
      <div
        className={cn(
          "absolute -inset-px rounded-xl pointer-events-none",
          "bg-gradient-to-r from-wave-4/20 via-brand-500/15 to-wave-2/20",
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
        placeholder="Tìm kiếm playlists"
        aria-label="Tìm kiếm playlists"
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
// Context-aware icon override for visibility (public/private/unlisted)
// ─────────────────────────────────────────────────────────────────────────────
const ActiveTagsBar = memo(
  ({
    params,
    activeCount,
    onRemoveFilter,
    onReset,
  }: {
    params: PlaylistFilterParams;
    activeCount: number;
    onRemoveFilter: (key: keyof PlaylistFilterParams) => void;
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
            Bộ lọc:
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
          className="btn-danger btn-sm ml-auto h-7 px-3 gap-1.5 text-[11px]"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Xóa tất cả
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
        <span className="hidden sm:block">Bộ lọc</span>
      </div>

      <div className="flex items-center gap-1.5 ml-1">
        {activeCount > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 px-1 items-center justify-center",
              "rounded-full text-[10px] font-black text-white",
              "orb-float--brand shadow-glow-xs",
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
// SELECT ITEM WITH ICON — reusable rich select option
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
// PLAYLIST FILTER — main orchestrator (FIX 3: memo)
// ─────────────────────────────────────────────────────────────────────────────
const PlaylistFilter = memo<PlaylistFilterProps>(
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
      if (params.isSystem !== undefined) n++;
      if (params.visibility) n++;
      return n;
    }, [params.isSystem, params.visibility]);

    // FIX 4+16: null sentinel
    const removeFilter = useCallback(
      (key: keyof PlaylistFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    // FIX 10: stable ref
    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    return (
      <div className="w-full">
        <div
          className={cn(
            "relative overflow-hidden",
            "rounded-2xl",
            "bg-card/50 dark:bg-surface-1/2 backdrop-blur-md",
            "transition-shadow duration-300 hover:shadow-elevated",
            activeFiltersCount > 0 && "border-primary/20 shadow-brand",
          )}
        >
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
                  <SelectItem value="newest">Mới nhất</SelectItem>
                  <SelectItem value="popular">Phổ biến</SelectItem>
                  <SelectItem value="followers">Người theo dõi</SelectItem>
                  <SelectItem value="name">Tên</SelectItem>
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
            aria-label="Playlist filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out relative",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/50"
                : "grid-rows-[0fr]",
            )}
          >
            <div className="divider-glow absolute top-0 left-4 right-4 h-px" />
            {/* FIX 1: overflow only after transitionend on outer el */}
            <div
              className={cn(
                "bg-muted/10",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Source — admin only. FIX 9+16: null for "all" */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={LayoutTemplate}
                      text="Nguồn"
                      iconColor="hsl(var(--info))"
                    />
                    <Select
                      value={
                        params.isSystem === undefined
                          ? "all"
                          : String(params.isSystem)
                      }
                      onValueChange={(val) =>
                        onFilterChange(
                          "isSystem",
                          val === "all" ? null : val === "true",
                        )
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="Tất cả nguồn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả nguồn</SelectItem>
                        <IconSelectItem
                          value="true"
                          icon={Server}
                          iconColor="hsl(var(--info))"
                          label="Hệ thống"
                        />
                        <IconSelectItem
                          value="false"
                          icon={User}
                          iconColor="hsl(var(--wave-2))"
                          label="Người dùng tạo"
                        />
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Visibility — admin only. FIX 9: null for "all" */}
                {user?.role === "admin" && (
                  <div className="space-y-0">
                    <FilterLabel
                      icon={Eye}
                      text="Có thể xem"
                      iconColor="hsl(var(--wave-3))"
                    />
                    <Select
                      value={params.visibility || "all"}
                      onValueChange={(val) =>
                        onFilterChange("visibility", val === "all" ? null : val)
                      }
                    >
                      <SelectTrigger className="w-full bg-background/80 h-9 text-sm shadow-raised rounded-lg border-border/70 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="Tất cả trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả trạng thái</SelectItem>
                        <IconSelectItem
                          value="public"
                          icon={Globe}
                          iconColor="hsl(var(--success))"
                          label="Công khai"
                        />
                        <IconSelectItem
                          value="private"
                          icon={Lock}
                          iconColor="hsl(var(--warning))"
                          label="Riêng tư"
                        />
                        <IconSelectItem
                          value="unlisted"
                          icon={Link}
                          iconColor="hsl(var(--info))"
                          label="Không công khai"
                        />
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Reserved slot — Tag, Collaborators, Duration range etc. */}
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

PlaylistFilter.displayName = "PlaylistFilter";
export default PlaylistFilter;
