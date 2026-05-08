"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
} from "react";
import {
  Search,
  X,
  ShieldCheck,
  Globe,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  UserCheck,
  UserX,
  ArrowUpDown,
  User,
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
import { useDebounce } from "@/hooks/useDebounce";
import FilterDropdown from "@/components/ui/FilterDropdown";
import { useAppSelector } from "@/store/hooks";
import { ArtistAdminFilterParams } from "../schemas/artist.schema";

const NationalitySelector = lazy(() =>
  import("@/components/ui/NationalitySelector").then((m) => ({
    default: m.NationalitySelector,
  })),
);
// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ArtistFiltersProps {
  params: ArtistAdminFilterParams;
  isAdmin?: boolean;
  onSearch: (keyword: string) => void;
  onFilterChange: (
    key: keyof ArtistAdminFilterParams,
    value: ArtistAdminFilterParams[keyof ArtistAdminFilterParams] | null,
  ) => void;
  onReset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: "Phổ biến", value: "popular" },
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Tên (A–Z)", value: "name" },
  { label: "Người nghe hàng tháng", value: "monthlyListeners" },
] as const;

const EXPAND_PANEL_ID = "artist-filter-panel";

// Tag meta — mỗi filter key có màu + icon riêng
const TAG_DEFS = {
  nationality: { label: "Quốc gia", icon: Globe, color: "#378ADD" },
  isVerified: { label: "Xác minh", icon: ShieldCheck, color: "#1D9E75" },
  isActive: { label: "Trạng thái", icon: UserCheck, color: "#1D9E75" },
  isDeleted: { label: "Đã xóa", icon: Trash2, color: "#E24B4A" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENTED CONTROL
// ─────────────────────────────────────────────────────────────────────────────
interface SegmentedProps<T extends string | number> {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (val: T) => void;
}

const Segmented = memo(function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      className="flex gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/50"
    >
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 h-8 px-3 rounded-md text-xs font-medium transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === opt.value
              ? "bg-background text-foreground shadow-raised border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}) as unknown as <T extends string | number>(
  p: SegmentedProps<T>,
) => React.ReactElement;

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WRAPPER — label + control
// ─────────────────────────────────────────────────────────────────────────────
const FilterField = memo(
  ({
    icon: Icon,
    label,
    iconColor,
    children,
    adminOnly,
  }: {
    icon: React.ElementType;
    label: string;
    iconColor?: string;
    children: React.ReactNode;
    adminOnly?: boolean;
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon
          className="size-3 shrink-0"
          style={iconColor ? { color: iconColor } : undefined}
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {label}
        </span>
        {adminOnly && (
          <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20">
            ADMIN
          </span>
        )}
      </div>
      {children}
    </div>
  ),
);
FilterField.displayName = "FilterField";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE FILTER TAG
// ─────────────────────────────────────────────────────────────────────────────
const ActiveFilterTag = memo(
  ({
    label,
    value,
    color,
    icon: Icon,
    onRemove,
  }: {
    label: string;
    value: string;
    color: string;
    icon: React.ElementType;
    onRemove: () => void;
  }) => (
    <div className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-full border border-border/60 bg-card/70 backdrop-blur-sm animate-fade-in">
      <span
        className="flex items-center justify-center size-4 rounded-full shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="size-2.5" style={{ color }} aria-hidden="true" />
      </span>
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-[10px] font-semibold text-foreground max-w-[100px] truncate capitalize">
        {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Xóa filter ${label}`}
        className="ml-0.5 p-0.5 rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
      >
        <X className="size-2.5" aria-hidden="true" />
      </button>
    </div>
  ),
);
ActiveFilterTag.displayName = "ActiveFilterTag";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST FILTERS — MAIN
// ─────────────────────────────────────────────────────────────────────────────
export const ArtistFilters = memo<ArtistFiltersProps>(
  ({ params, isAdmin = false, onSearch, onFilterChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelOverflow, setPanelOverflow] = useState(false);
    const { user } = useAppSelector((s) => s.auth);
    const showAdminFields = isAdmin && user?.role === "admin";

    // ── Search debounce ──────────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(params.keyword || "");
    const debouncedSearch = useDebounce(localSearch, 400);
    const isClearingRef = useRef(false);

    // One-way sync: URL → input
    useEffect(() => {
      if ((params.keyword || "") === localSearch) return;
      setLocalSearch(params.keyword || "");
    }, [params.keyword]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (isClearingRef.current) {
        isClearingRef.current = false;
        return;
      }
      if (debouncedSearch !== (params.keyword || "")) onSearch(debouncedSearch);
    }, [debouncedSearch, params.keyword, onSearch]);

    const handleClearSearch = useCallback(() => {
      isClearingRef.current = true;
      setLocalSearch("");
      onSearch("");
    }, [onSearch]);

    // ── Panel expand — grid-template-rows transition ─────────────────────────
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = gridRef.current;
      if (!el) return;
      if (isExpanded) {
        const onEnd = (e: TransitionEvent) => {
          if (e.target === el && e.propertyName === "grid-template-rows")
            setPanelOverflow(true);
        };
        el.addEventListener("transitionend", onEnd);
        return () => el.removeEventListener("transitionend", onEnd);
      } else {
        setPanelOverflow(false);
      }
    }, [isExpanded]);

    const toggleExpanded = useCallback(() => setIsExpanded((v) => !v), []);

    // ── Đếm active filters ───────────────────────────────────────────────────
    const activeCount = useMemo(() => {
      let n = 0;
      if (params.nationality) n++;
      if (params.isVerified !== undefined) n++;
      if (params.isActive !== undefined) n++;
      if (params.isDeleted !== undefined) n++;
      return n;
    }, [
      params.nationality,
      params.isVerified,
      params.isActive,
      params.isDeleted,
    ]);

    // ── Stable handlers ──────────────────────────────────────────────────────
    const removeFilter = useCallback(
      (key: keyof ArtistAdminFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    const handleSortChange = useCallback(
      (val: string) => onFilterChange("sort", val),
      [onFilterChange],
    );

    const handleNationalityChange = useCallback(
      (val: string) => onFilterChange("nationality", val || null),
      [onFilterChange],
    );

    const handleIsActiveChange = useCallback(
      (val: string) =>
        onFilterChange("isActive", val === "" ? null : val === "true"),
      [onFilterChange],
    );

    const handleIsVerifiedChange = useCallback(
      (val: string) =>
        onFilterChange("isVerified", val === "" ? null : val === "true"),
      [onFilterChange],
    );
    const handleIsDeletedChange = useCallback(
      (val: string) =>
        onFilterChange("isDeleted", val === "" ? null : val === "true"),
      [onFilterChange],
    );

    // ── Active tags build ────────────────────────────────────────────────────
    const activeTags = useMemo(() => {
      const tags: {
        key: keyof ArtistAdminFilterParams;
        displayValue: string;
        iconOverride?: React.ElementType;
        colorOverride?: string;
      }[] = [];

      if (params.nationality) {
        tags.push({ key: "nationality", displayValue: params.nationality });
      }
      if (params.isVerified !== undefined) {
        tags.push({
          key: "isVerified",
          displayValue: "Chỉ đã xác minh",
        });
      }
      if (params.isActive !== undefined) {
        tags.push({
          key: "isActive",
          displayValue: params.isActive ? "Hoạt động" : "Bị khóa",
          iconOverride: params.isActive ? UserCheck : UserX,
          colorOverride: params.isActive ? "#1D9E75" : "#E24B4A",
        });
      }
      if (params.isDeleted !== undefined) {
        tags.push({
          key: "isDeleted",
          displayValue: params.isDeleted ? "Đã xóa" : "Chưa xóa",
          iconOverride: params.isDeleted ? Trash2 : User,
          colorOverride: params.isDeleted ? "#E24B4A" : "#1D9E75",
        });
      }
      return tags;
    }, [params]);

    // ── Segmented option sets ────────────────────────────────────────────────
    const verifiedOptions = [
      { label: "Tất cả", value: "" },
      { label: "Đã xác minh", value: "true" },
      { label: "Chưa xác minh", value: "false" },
    ] as const;
    const deletedOptions = [
      { label: "Tất cả", value: "" },
      { label: "Đã xóa", value: "true" },
      { label: "Chưa xóa", value: "false" },
    ] as const;
    const activeOptions = [
      { label: "Tất cả", value: "" },
      { label: "Hoạt động", value: "true" },
      { label: "Bị khóa", value: "false" },
    ] as const;

    return (
      <div className="w-full">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl",
            "bg-card/50 dark:bg-surface-1/20 backdrop-blur-md",
            "border transition-all duration-300",
            activeCount > 0
              ? "border-primary/30 shadow-brand"
              : "border-border/50 hover:border-border hover:shadow-elevated",
          )}
        >
          {/* ── TOP ROW ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5 p-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0 group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search
                  className={cn(
                    "size-3.5 transition-colors duration-200",
                    localSearch
                      ? "text-primary"
                      : "text-muted-foreground/40 group-focus-within:text-primary/60",
                  )}
                  aria-hidden="true"
                />
              </div>
              <Input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Tìm kiếm nghệ sĩ…"
                aria-label="Search artists"
                className={cn(
                  "h-10 pl-9 pr-9 text-sm rounded-xl",
                  "bg-background/60 border-border/60",
                  "hover:border-border focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20",
                  "transition-all duration-200",
                )}
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <Separator
              orientation="vertical"
              className="h-5 opacity-50 hidden sm:block"
            />

            {/* Sort */}
            <Select
              value={(params.sort || "popular").toLowerCase()}
              onValueChange={handleSortChange}
            >
              <SelectTrigger
                className={cn(
                  "h-10 w-auto min-w-[46px] sm:min-w-[160px] rounded-xl",
                  "bg-background/60 border-border/60 text-sm",
                  "hover:border-border transition-all",
                )}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown
                    className="size-3.5 text-muted-foreground/50 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:block">
                    <SelectValue />
                  </span>
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
              className="h-5 opacity-50 hidden sm:block"
            />

            {/* Filter toggle */}
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-controls={EXPAND_PANEL_ID}
              className={cn(
                "h-10 px-3.5 gap-2 inline-flex items-center rounded-xl border text-sm font-medium shrink-0",
                "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isExpanded
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/60 text-foreground hover:bg-accent/40 hover:border-border",
              )}
            >
              <SlidersHorizontal
                className="size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="hidden sm:block">Bộ lọc</span>
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-[10px] font-black text-white bg-primary shadow-glow-xs">
                  {activeCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground/50 transition-transform duration-200",
                  isExpanded && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* ── EXPANDABLE PANEL ─────────────────────────────────────────── */}
          <div
            ref={gridRef}
            id={EXPAND_PANEL_ID}
            role="region"
            aria-label="Artist filter options"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-in-out",
              "border-t border-transparent",
              isExpanded
                ? "grid-rows-[1fr] border-border/40"
                : "grid-rows-[0fr]",
            )}
          >
            <div
              className={cn(
                "bg-muted/5",
                panelOverflow ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div
                className={cn(
                  "p-4 grid gap-4",
                  showAdminFields
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2",
                )}
              >
                {/* ── 1. Quốc gia */}
                <FilterField icon={Globe} label="Quốc gia" iconColor="#378ADD">
                  <FilterDropdown
                    isActive={!!params.nationality}
                    onClear={() => onFilterChange("nationality", null)}
                    label={
                      <span className="truncate text-sm font-normal">
                        {params.nationality ?? "Tất cả quốc gia"}
                      </span>
                    }
                    contentClassName="w-[280px] max-w-[90vw]"
                    className={cn(
                      "w-full h-9 text-sm font-normal px-3 justify-start rounded-lg border-border/60",
                      "bg-background/80 shadow-raised transition-all",
                      "hover:border-border focus:ring-1 focus:ring-primary/30",
                      params.nationality && "border-info/40",
                    )}
                  >
                    <div className="p-1">
                      <Suspense fallback={<div className="p-3">Đang tải…</div>}>
                        <NationalitySelector
                          value={params.nationality}
                          onChange={handleNationalityChange}
                          clearable
                        />
                      </Suspense>
                    </div>
                  </FilterDropdown>
                </FilterField>

                {/* ── 2. Xác minh — admin only */}
                {showAdminFields && (
                  <FilterField
                    icon={ShieldCheck}
                    label="Xác minh"
                    iconColor="#1D9E75"
                    adminOnly
                  >
                    <Segmented
                      options={verifiedOptions}
                      value={
                        params.isVerified === undefined
                          ? ""
                          : String(params.isVerified)
                      }
                      onChange={handleIsVerifiedChange}
                    />
                  </FilterField>
                )}

                {/* ── 3. Trạng thái — admin only */}
                {showAdminFields && (
                  <FilterField
                    icon={LayoutGrid}
                    label="Trạng thái"
                    iconColor="#D85A30"
                    adminOnly
                  >
                    <Segmented
                      options={activeOptions}
                      value={
                        params.isActive === undefined
                          ? ""
                          : String(params.isActive)
                      }
                      onChange={handleIsActiveChange}
                    />
                  </FilterField>
                )}
                {/* ── 4. Đã xóa — admin only */}
                {showAdminFields && (
                  <FilterField
                    icon={LayoutGrid}
                    label="Đã xóa"
                    iconColor="#D85A30"
                    adminOnly
                  >
                    <Segmented
                      options={deletedOptions}
                      value={
                        params.isDeleted === undefined
                          ? ""
                          : String(params.isDeleted)
                      }
                      onChange={handleIsDeletedChange}
                    />
                  </FilterField>
                )}
              </div>
            </div>
          </div>

          {/* ── ACTIVE TAGS BAR ─────────────────────────────────────────── */}
          {activeCount > 0 && (
            <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border/40 bg-muted/5 backdrop-blur-sm">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider shrink-0">
                Đang lọc:
              </span>

              {activeTags.map(
                ({ key, displayValue, iconOverride, colorOverride }) => {
                  const def = TAG_DEFS[key as keyof typeof TAG_DEFS];
                  if (!def) return null;
                  return (
                    <ActiveFilterTag
                      key={key}
                      label={def.label}
                      value={displayValue}
                      color={colorOverride ?? def.color}
                      icon={iconOverride ?? def.icon}
                      onRemove={() => removeFilter(key)}
                    />
                  );
                },
              )}

              <button
                type="button"
                onClick={onReset}
                aria-label="Clear all filters"
                className="ml-auto h-7 px-3 gap-1.5 inline-flex items-center text-[11px] font-medium rounded-full border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-all"
              >
                <Trash2 className="size-3" aria-hidden="true" />
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ArtistFilters.displayName = "ArtistFilters";
export default ArtistFilters;
