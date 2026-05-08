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
  Mic2,
  Disc,
  Tag,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  BookOpen,
  ArrowUpDown,
  Eye,
  CheckCircle2,
  Loader,
  Clock3,
  AlertTriangle,
  FileText,
  Video,
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
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { TrackFilterParams } from "../schemas/track.schema";
import { APP_CONFIG } from "@/config/constants";
import { MoodVideoPicker } from "@/features/mood-video/components/MoodVideoPicker";

const ArtistSelector = lazy(() =>
  import("@/features/artist/components/ArtistSelector").then((m) => ({
    default: m.ArtistSelector,
  })),
);

const AlbumSelector = lazy(() =>
  import("@/features/album/components/AlbumSelector").then((m) => ({
    default: m.AlbumSelector,
  })),
);

const GenreSelector = lazy(() =>
  import("@/features/genre/components/GenreSelector").then((m) => ({
    default: m.GenreSelector,
  })),
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface TrackFiltersProps {
  params: TrackFilterParams;
  isAdmin?: boolean;
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
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Phổ biến nhất", value: "popular" },
  { label: "Tên (A–Z)", value: "name" },
  { label: "Xu hướng", value: "trending" },
] as const;

const LIMIT_OPTIONS = [
  {
    label: `${APP_CONFIG.PAGINATION_LIMIT}`,
    value: APP_CONFIG.PAGINATION_LIMIT,
  },
  {
    label: `${APP_CONFIG.PAGINATION_LIMIT * 2}`,
    value: APP_CONFIG.PAGINATION_LIMIT * 2,
  },
  {
    label: `${APP_CONFIG.PAGINATION_LIMIT * 3}`,
    value: APP_CONFIG.PAGINATION_LIMIT * 3,
  },
] as const;

const EXPAND_PANEL_ID = "track-filter-panel";

// Tag meta — mỗi filter key có màu + icon riêng
const TAG_DEFS = {
  status: {
    label: "Trạng thái",
    icon: CheckCircle2,
    color: "hsl(var(--info))",
  },
  artistId: { label: "Nghệ sĩ", icon: Mic2, color: "hsl(var(--wave-1))" },
  albumId: { label: "Album", icon: Disc, color: "hsl(var(--wave-4))" },
  genreId: { label: "Thể loại", icon: Tag, color: "hsl(var(--wave-2))" },
  isPublic: { label: "Công khai", icon: Eye, color: "#378ADD" },
  isDeleted: { label: "Đã xóa", icon: Trash2, color: "#E24B4A" },
  moodVideoId: { label: "Video cảm xúc", icon: Video, color: "#8B4513" },
  lyricType: { label: "Lời nhạc", icon: FileText, color: "#D85A30" },
  limit: { label: "Limit", icon: LayoutGrid, color: "#7F77DD" },
  page: { label: "Trang", icon: BookOpen, color: "#BA7517" },
} as const;

interface StatusOption {
  value: string;
  label: string;
  iconColor: string;
  icon: React.ElementType;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "ready",
    label: "Đã xử lý",
    iconColor: "hsl(var(--success))",
    icon: CheckCircle2,
  },
  {
    value: "processing",
    label: "Đang xử lý",
    iconColor: "hsl(var(--info))",
    icon: Loader,
  },
  {
    value: "pending",
    label: "Chờ xử lý",
    iconColor: "hsl(var(--warning))",
    icon: Clock3,
  },
  {
    value: "failed",
    label: "Lỗi",
    iconColor: "hsl(var(--error))",
    icon: AlertTriangle,
  },
];

const LYRIC_TYPES = [
  { value: "none", label: "Không có" },
  { value: "plain", label: "Lời thường" },
  { value: "synced", label: "Lời đồng bộ" },
  { value: "karaoke", label: "Karaoke" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENTED CONTROL
// ─────────────────────────────────────────────────────────────────────────────
interface SegmentedProps<T extends string | number> {
  options: readonly { label: string; value: T }[];
  value: T | undefined;
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
// SELECTOR FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
const SelectorFallback = () => (
  <div className="p-3">
    <WaveformLoader />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TRACK FILTERS — MAIN
// ─────────────────────────────────────────────────────────────────────────────
export const TrackFilters = memo<TrackFiltersProps>(
  ({
    params,
    isAdmin = false,
    onSearch,
    onFilterChange,
    onReset,
    className,
    hideStatus = false,
  }) => {
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

    // ── Active count ─────────────────────────────────────────────────────────
    const activeCount = useMemo(() => {
      let n = 0;
      if (params.status) n++;
      if (params.artistId) n++;
      if (params.albumId) n++;
      if (params.genreId) n++;
      if (params.lyricType) n++;
      if (params.isPublic !== undefined) n++;
      if (params.isDeleted !== undefined) n++;
      if (params.moodVideoId !== undefined) n++;
      if (params.limit && params.limit !== APP_CONFIG.PAGINATION_LIMIT) n++;
      if (params.page && params.page > 1) n++;
      return n;
    }, [params]);

    // ── Stable handlers ──────────────────────────────────────────────────────
    const removeFilter = useCallback(
      (key: keyof TrackFilterParams) => onFilterChange(key, null),
      [onFilterChange],
    );

    const handleSortChange = useCallback(
      (val: string) => onFilterChange("sort", val as TrackFilterParams["sort"]),
      [onFilterChange],
    );

    const handleStatusChange = useCallback(
      (val: string) =>
        onFilterChange(
          "status",
          val === "all" ? null : (val as TrackFilterParams["status"]),
        ),
      [onFilterChange],
    );

    const handleArtistChange = useCallback(
      (ids: string[]) => onFilterChange("artistId", ids[0] ?? null),
      [onFilterChange],
    );

    const handleAlbumChange = useCallback(
      (id: string) => onFilterChange("albumId", id || null),
      [onFilterChange],
    );

    const handleGenreChange = useCallback(
      (val: string | null | undefined) =>
        onFilterChange("genreId", val ?? null),
      [onFilterChange],
    );
    const handleMoodVideoChange = useCallback(
      (val: string | null | undefined) =>
        onFilterChange("moodVideoId", val ?? null),
      [onFilterChange],
    );

    const handleLyricTypeChange = useCallback(
      (val: string) =>
        onFilterChange(
          "lyricType",
          val === "all" ? null : (val as TrackFilterParams["lyricType"]),
        ),
      [onFilterChange],
    );

    const handleIsPublicChange = useCallback(
      (val: string) =>
        onFilterChange("isPublic", val === "" ? null : val === "true"),
      [onFilterChange],
    );

    const handleIsDeletedChange = useCallback(
      (val: string) =>
        onFilterChange("isDeleted", val === "" ? null : val === "true"),
      [onFilterChange],
    );

    const handleLimitChange = useCallback(
      (val: number) => onFilterChange("limit", val),
      [onFilterChange],
    );

    const handlePageChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
        onFilterChange("page", v);
      },
      [onFilterChange],
    );

    // ── Active tags build ────────────────────────────────────────────────────
    const activeTags = useMemo(() => {
      const tags: { key: keyof TrackFilterParams; displayValue: string }[] = [];

      if (params.status) {
        const opt = STATUS_OPTIONS.find((o) => o.value === params.status);
        tags.push({ key: "status", displayValue: opt?.label ?? params.status });
      }
      if (params.artistId) {
        tags.push({ key: "artistId", displayValue: "Đã chọn" });
      }
      if (params.albumId) {
        tags.push({ key: "albumId", displayValue: "Đã chọn" });
      }
      if (params.genreId) {
        tags.push({ key: "genreId", displayValue: "Đã chọn" });
      }
      if (params.lyricType) {
        const lt = LYRIC_TYPES.find((l) => l.value === params.lyricType);
        tags.push({
          key: "lyricType",
          displayValue: lt?.label ?? params.lyricType,
        });
      }
      if (params.isPublic !== undefined) {
        tags.push({
          key: "isPublic",
          displayValue: params.isPublic ? "Công khai" : "Riêng tư",
        });
      }
      if (params.isDeleted !== undefined) {
        tags.push({
          key: "isDeleted",
          displayValue: params.isDeleted ? "Đã xóa" : "Chưa xóa",
        });
      }
      if (params.moodVideoId) {
        tags.push({ key: "moodVideoId", displayValue: "Đã chọn" });
      }
      if (params.limit && params.limit !== APP_CONFIG.PAGINATION_LIMIT) {
        tags.push({ key: "limit", displayValue: `${params.limit} / trang` });
      }
      if (params.page && params.page > 1) {
        tags.push({ key: "page", displayValue: `Trang ${params.page}` });
      }
      return tags;
    }, [params]);

    // ── Segmented option sets ────────────────────────────────────────────────
    const boolAllOptions = [
      { label: "Tất cả", value: "" },
      { label: "Có", value: "true" },
      { label: "Không", value: "false" },
    ] as const;

    return (
      <div className={cn("w-full", className)}>
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
                placeholder="Tìm bài hát, ISRC, lời nhạc…"
                aria-label="Search tracks"
                autoComplete="off"
                spellCheck={false}
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
              value={params.sort || "newest"}
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
            aria-label="Track filter options"
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
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                )}
              >
                {/* ── 1. status (user + admin, unless hideStatus) */}
                {!hideStatus && (
                  <FilterField
                    icon={CheckCircle2}
                    label="Trạng thái"
                    iconColor="hsl(var(--info))"
                  >
                    <Select
                      value={params.status || "all"}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="h-9 w-full bg-background/80 text-sm rounded-lg border-border/60 focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="Tất cả" />
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
                  </FilterField>
                )}

                {/* ── 2. artistId (user + admin) */}
                <FilterField
                  icon={Mic2}
                  label="Nghệ sĩ"
                  iconColor="hsl(var(--wave-1))"
                >
                  <FilterDropdown
                    isActive={!!params.artistId}
                    onClear={() => onFilterChange("artistId", null)}
                    label={
                      <span className="truncate text-sm font-normal">
                        {params.artistId ? "Nghệ sĩ đã chọn" : "Tìm nghệ sĩ"}
                      </span>
                    }
                    contentClassName="w-[300px] max-w-[90vw]"
                    className={cn(
                      "w-full h-9 text-sm font-normal px-3 justify-start rounded-lg border-border/60",
                      "bg-background/80 shadow-raised transition-all",
                      "hover:border-border focus:ring-1 focus:ring-primary/30",
                      params.artistId && "border-brand-300/50",
                    )}
                  >
                    <div className="p-1">
                      <Suspense fallback={<SelectorFallback />}>
                        <ArtistSelector
                          singleSelect
                          value={params.artistId ? [params.artistId] : []}
                          onChange={handleArtistChange}
                        />
                      </Suspense>
                    </div>
                  </FilterDropdown>
                </FilterField>

                {/* ── 3. albumId (user + admin) */}
                <FilterField
                  icon={Disc}
                  label="Album"
                  iconColor="hsl(var(--wave-4))"
                >
                  <FilterDropdown
                    isActive={!!params.albumId}
                    onClear={() => onFilterChange("albumId", null)}
                    label={
                      <span className="truncate text-sm font-normal">
                        {params.albumId ? "Album đã chọn" : "Tìm album"}
                      </span>
                    }
                    contentClassName="w-[300px] max-w-[90vw]"
                    className={cn(
                      "w-full h-9 text-sm font-normal px-3 justify-start rounded-lg border-border/60",
                      "bg-background/80 shadow-raised transition-all",
                      "hover:border-border focus:ring-1 focus:ring-primary/30",
                      params.albumId && "border-warning/40",
                    )}
                  >
                    <div className="p-1">
                      <Suspense fallback={<SelectorFallback />}>
                        <AlbumSelector
                          value={params.albumId || ""}
                          onChange={handleAlbumChange}
                        />
                      </Suspense>
                    </div>
                  </FilterDropdown>
                </FilterField>

                {/* ── 4. genreId (user + admin) */}
                <FilterField
                  icon={Tag}
                  label="Thể loại"
                  iconColor="hsl(var(--wave-2))"
                >
                  <FilterDropdown
                    isActive={!!params.genreId}
                    onClear={() => onFilterChange("genreId", null)}
                    label={
                      <span className="truncate text-sm font-normal">
                        {params.genreId ? "Thể loại đã chọn" : "Tìm thể loại"}
                      </span>
                    }
                    contentClassName="w-[280px] max-w-[90vw]"
                    className={cn(
                      "w-full h-9 text-sm font-normal px-3 justify-start rounded-lg border-border/60",
                      "bg-background/80 shadow-raised transition-all",
                      "hover:border-border focus:ring-1 focus:ring-primary/30",
                      params.genreId && "border-pink-500/40",
                    )}
                  >
                    <div className="p-1">
                      <Suspense fallback={<SelectorFallback />}>
                        <GenreSelector
                          variant="filter"
                          singleSelect
                          value={params.genreId}
                          onChange={handleGenreChange}
                          placeholder="Tìm kiếm thể loại…"
                        />
                      </Suspense>
                    </div>
                  </FilterDropdown>
                </FilterField>
                {/* ── 8. moodVideoId (user + admin) */}
                <FilterField
                  icon={Tag}
                  label="Mood Video"
                  iconColor="hsl(var(--wave-2))"
                >
                  <div className="p-1">
                    <Suspense fallback={<SelectorFallback />}>
                      <MoodVideoPicker
                        value={params.moodVideoId || ""}
                        onChange={handleMoodVideoChange}
                        variant="filter"
                        placeholder="Lọc theo video..."
                      />
                    </Suspense>
                  </div>
                </FilterField>

                {/* ── 5. lyricType (user + admin) */}
                <FilterField
                  icon={FileText}
                  label="Lời nhạc"
                  iconColor="#D85A30"
                >
                  <Select
                    value={params.lyricType || "all"}
                    onValueChange={handleLyricTypeChange}
                  >
                    <SelectTrigger className="h-9 w-full bg-background/80 text-sm rounded-lg border-border/60 focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {LYRIC_TYPES.map((lt) => (
                        <SelectItem key={lt.value} value={lt.value}>
                          {lt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                {/* ── 6. limit */}
                <FilterField icon={LayoutGrid} label="Kết quả / trang">
                  <Segmented
                    options={LIMIT_OPTIONS}
                    value={params.limit ?? (APP_CONFIG.VIRTUALIZER_LIMIT || 50)}
                    onChange={handleLimitChange}
                  />
                </FilterField>

                {/* ── 7. page */}
                <FilterField icon={BookOpen} label="Trang">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={params.page ?? 1}
                      onChange={handlePageChange}
                      aria-label="Page number"
                      className={cn(
                        "w-20 h-9 px-3 text-sm text-center rounded-lg",
                        "border border-border/60 bg-background/80",
                        "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                        "transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      )}
                    />
                    <span className="text-xs text-muted-foreground">
                      / trang
                    </span>
                  </div>
                </FilterField>

                {/* ── 8. isPublic — admin only */}
                {showAdminFields && (
                  <FilterField
                    icon={Eye}
                    label="Công khai"
                    iconColor="#378ADD"
                    adminOnly
                  >
                    <Segmented
                      options={boolAllOptions}
                      value={
                        params.isPublic === undefined
                          ? ""
                          : String(params.isPublic)
                      }
                      onChange={handleIsPublicChange}
                    />
                  </FilterField>
                )}

                {/* ── 9. isDeleted — admin only */}
                {showAdminFields && (
                  <FilterField
                    icon={Trash2}
                    label="isDeleted"
                    iconColor="#E24B4A"
                    adminOnly
                  >
                    <Segmented
                      options={boolAllOptions}
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

              {activeTags.map(({ key, displayValue }) => {
                const def = TAG_DEFS[key as keyof typeof TAG_DEFS];
                if (!def) return null;

                // Override status icon to contextual icon
                let icon: React.ElementType = def.icon;
                let color: string = def.color;
                if (key === "status" && params.status) {
                  const opt = STATUS_OPTIONS.find(
                    (o) => o.value === params.status,
                  );
                  if (opt) {
                    icon = opt.icon;
                    color = opt.iconColor;
                  }
                }

                return (
                  <ActiveFilterTag
                    key={key}
                    label={def.label}
                    value={displayValue}
                    color={color}
                    icon={icon}
                    onRemove={() => removeFilter(key)}
                  />
                );
              })}

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

TrackFilters.displayName = "TrackFilters";
export default TrackFilters;
