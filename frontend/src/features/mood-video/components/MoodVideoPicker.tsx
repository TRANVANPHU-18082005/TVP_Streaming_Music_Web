"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  useEffect,
  useId,
  RefObject,
} from "react";
import {
  Search,
  Video,
  Check,
  Play,
  X,
  Flame,
  Info,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  Tag,
  SlidersHorizontal,
  ChevronUp,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMoodVideosQuery } from "../hooks/useMoodVideoQuery";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoodVideo {
  _id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  tags: string[];
  duration?: number;
  mood?: string;
}

/**
 * variant="picker"  — full 2-column picker UI (dùng trong form/modal)
 * variant="filter"  — compact trigger + dropdown (dùng như filter trên listing page)
 */
type PickerVariant = "picker" | "filter";

interface MoodVideoPickerProps {
  value?: string | null;
  onChange: (videoId: string | null) => void;
  className?: string;
  disabled?: boolean;
  label?: string;
  variant?: PickerVariant;
  /** Chỉ dùng cho filter variant: text hiển thị khi chưa chọn */
  placeholder?: string;
}

type SortOption = "default" | "title_asc" | "title_desc";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── VideoSkeleton ────────────────────────────────────────────────────────────

const VideoSkeleton = () => (
  <div className="aspect-[9/16] rounded-xl bg-white/5 animate-pulse" />
);

// ─── VideoCard ────────────────────────────────────────────────────────────────

const VideoCard = memo(
  ({
    video,
    isSelected,
    onSelect,
    isKeyFocused,
    compact = false,
  }: {
    video: MoodVideo;
    isSelected: boolean;
    onSelect: () => void;
    isKeyFocused: boolean;
    compact?: boolean;
  }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    return (
      <button
        type="button"
        onClick={onSelect}
        role="option"
        aria-selected={isSelected}
        aria-label={`${isSelected ? "Bỏ chọn" : "Chọn"} video: ${video.title}`}
        className={cn(
          "group relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer w-full",
          "transition-all duration-200 ease-out border-2 outline-none text-left",
          "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isSelected
            ? "border-primary shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.18)] scale-[0.97]"
            : "border-transparent hover:border-white/25 hover:scale-[0.99]",
          isKeyFocused && !isSelected && "border-white/30",
        )}
      >
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-white/5 animate-pulse" />
        )}
        {imgError ? (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
            <Video className="size-6 text-white/20" />
          </div>
        ) : (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              "group-hover:opacity-100 group-hover:scale-105",
              isSelected ? "opacity-75" : "opacity-60",
              imgLoaded ? "visible" : "invisible",
            )}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-2">
          <p
            className={cn(
              "font-bold text-white leading-tight",
              compact ? "text-[9px] line-clamp-1" : "text-[10px] line-clamp-2",
            )}
          >
            {video.title}
          </p>
          {!compact && video.tags.length > 0 && (
            <p className="text-[9px] text-white/50 mt-0.5 truncate">
              #{video.tags[0]}
              {video.tags.length > 1 && ` +${video.tags.length - 1}`}
            </p>
          )}
        </div>

        {video.duration != null && (
          <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-black/60 text-[8px] font-mono text-white/80">
            {formatDuration(video.duration)}
          </div>
        )}

        {isSelected && (
          <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary flex items-center justify-center shadow-md">
            <Check className="size-2.5 text-white stroke-[3px]" />
          </div>
        )}

        {!isSelected && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div
              className={cn(
                "rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20",
                compact ? "size-7" : "size-9",
              )}
            >
              <Play
                className={cn(
                  "fill-white text-white ml-0.5",
                  compact ? "size-3" : "size-4",
                )}
              />
            </div>
          </div>
        )}
      </button>
    );
  },
);
VideoCard.displayName = "VideoCard";

// ─── VideoPreview ─────────────────────────────────────────────────────────────

const VideoPreview = memo(
  ({ video, onDeselect }: { video: MoodVideo; onDeselect: () => void }) => {
    const [isMuted, setIsMuted] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      setIsMuted(true);
      setIsPaused(false);
      setVideoError(false);
    }, [video._id]);

    const togglePause = () => {
      const v = videoRef.current;
      if (!v) return;
      isPaused ? v.play().catch(() => {}) : v.pause();
      setIsPaused(!isPaused);
    };

    const toggleMute = () => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !v.muted;
      setIsMuted(v.muted);
    };

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="relative flex-1 min-h-0 bg-black rounded-t-xl overflow-hidden">
          {videoError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-3">
              <Video className="size-10" />
              <p className="text-xs">Không tải được video</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-white/50"
                onClick={() => setVideoError(false)}
              >
                <RotateCcw className="size-3 mr-1" /> Thử lại
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                key={video._id}
                src={video.videoUrl}
                autoPlay
                muted={isMuted}
                loop
                playsInline
                onError={() => setVideoError(true)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200">
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={togglePause}
                    className="size-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label={isPaused ? "Phát video" : "Tạm dừng video"}
                  >
                    {isPaused ? (
                      <Play className="size-5 fill-white text-white ml-0.5" />
                    ) : (
                      <Pause className="size-5 fill-white text-white" />
                    )}
                  </button>
                </div>
                <div className="absolute bottom-3 right-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="size-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                    aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                  >
                    {isMuted ? (
                      <VolumeX className="size-3.5 text-white" />
                    ) : (
                      <Volume2 className="size-3.5 text-white" />
                    )}
                  </button>
                </div>
              </div>
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1.5 pointer-events-none">
                <Play className="size-2.5 fill-white" /> Preview
              </div>
            </>
          )}
        </div>

        <div className="p-4 space-y-3 bg-card/60 rounded-b-xl border border-t-0 border-border/30">
          <div>
            <h4 className="text-sm font-black text-foreground uppercase tracking-tight truncate">
              {video.title}
            </h4>
            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {video.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[9px] h-4 px-1.5 bg-white/5 border-white/10 text-white/60"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDeselect}
            className="w-full text-destructive hover:bg-destructive/10 h-8 rounded-lg text-xs font-semibold"
          >
            <X className="size-3 mr-1.5" /> Bỏ chọn video này
          </Button>
        </div>
      </div>
    );
  },
);
VideoPreview.displayName = "VideoPreview";

// ─── SmartMatchingPanel ───────────────────────────────────────────────────────

const SmartMatchingPanel = () => (
  <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4">
    <div className="size-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
      <Flame className="size-8 text-primary/50" />
    </div>
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-foreground">Smart Matching</p>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
        Hệ thống sẽ tự động chọn Video Canvas phù hợp nhất dựa trên{" "}
        <span className="font-semibold text-wave-3">Tags cảm xúc</span> của bài
        hát.
      </p>
    </div>
  </div>
);

// ─── Shared FilterBar ─────────────────────────────────────────────────────────

interface FilterBarProps {
  searchId: string;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  allTags: string[];
  activeTagFilter: string | null;
  onTagFilter: (tag: string | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
  totalCount: number;
  isLoading: boolean;
  value?: string | null;
  /** compact=true = dùng trong filter dropdown, dùng horizontal scroll tags */
  compact?: boolean;
}

const FilterBar = ({
  searchId,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  allTags,
  activeTagFilter,
  onTagFilter,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  totalCount,
  isLoading,
  value,
  compact = false,
}: FilterBarProps) => (
  <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
    {/* Search + Sort row */}
    <div className="flex gap-2 items-center">
      <div className="relative flex-1 min-w-0">
        <label htmlFor={searchId} className="sr-only">
          Tìm video
        </label>
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          id={searchId}
          placeholder="Tìm tên hoặc tag..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "pl-8 bg-background/50 border-border/40",
            compact ? "h-8 text-xs" : "h-9",
          )}
          autoComplete="off"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Xoá tìm kiếm"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Sort select */}
      <div className="relative flex-shrink-0">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className={cn(
            "appearance-none pl-7 pr-6 rounded-lg text-xs font-medium",
            "bg-background/50 border border-border/40 text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "cursor-pointer hover:border-border/60 transition-colors",
            compact ? "h-8" : "h-9",
          )}
          aria-label="Sắp xếp"
        >
          <option value="default">Mặc định</option>
          <option value="title_asc">A → Z</option>
          <option value="title_desc">Z → A</option>
        </select>
        <SlidersHorizontal
          className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <ChevronDown
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none"
          aria-hidden
        />
      </div>

      {/* Auto match hint (picker only) */}
      {!compact && !value && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-[10px] font-bold text-wave-3 uppercase tracking-wider cursor-help select-none flex-shrink-0 hidden sm:flex">
              <Info className="size-3.5" aria-hidden />
              Auto
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            Để trống để hệ thống tự khớp video theo Tags cảm xúc.
          </TooltipContent>
        </Tooltip>
      )}
    </div>

    {/* Tag pills */}
    {!isLoading && allTags.length > 0 && (
      <div
        className={cn(
          "flex gap-1.5 pb-0.5",
          compact ? "flex-nowrap overflow-x-auto scrollbar-none" : "flex-wrap",
        )}
        role="group"
        aria-label="Lọc theo tags"
      >
        <button
          type="button"
          onClick={() => onTagFilter(null)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-semibold transition-all flex-shrink-0",
            compact ? "h-5 px-2 text-[9px]" : "h-6 px-2.5 text-[10px]",
            activeTagFilter === null
              ? "bg-primary text-primary-foreground"
              : "bg-white/5 text-muted-foreground border border-border/30 hover:border-border/60",
          )}
          aria-pressed={activeTagFilter === null}
        >
          Tất cả
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTagFilter(activeTagFilter === tag ? null : tag)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-semibold transition-all flex-shrink-0",
              compact ? "h-5 px-2 text-[9px]" : "h-6 px-2.5 text-[10px]",
              activeTagFilter === tag
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-muted-foreground border border-border/30 hover:border-border/60",
            )}
            aria-pressed={activeTagFilter === tag}
          >
            <Tag className={compact ? "size-2" : "size-2.5"} aria-hidden />
            {tag}
          </button>
        ))}
      </div>
    )}

    {/* Count + clear */}
    {!isLoading && (
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-muted-foreground">
          {hasActiveFilters ? (
            <>
              <span className="font-semibold text-foreground">
                {resultCount}
              </span>{" "}
              / {totalCount} video
            </>
          ) : (
            <>{totalCount} video</>
          )}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Xoá bộ lọc
          </button>
        )}
      </div>
    )}
  </div>
);

// ─── Shared VideoGrid ─────────────────────────────────────────────────────────

interface VideoGridProps {
  gridRef: RefObject<HTMLDivElement>;
  isLoading: boolean;
  isError: boolean;
  filteredVideos: MoodVideo[];
  hasActiveFilters: boolean;
  value?: string | null;
  focusedIndex: number;
  onSelect: (id: string, idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClearFilters: () => void;
  refetch: () => void;
  compact?: boolean;
}

const VideoGrid = ({
  gridRef,
  isLoading,
  isError,
  filteredVideos,
  hasActiveFilters,
  value,
  focusedIndex,
  onSelect,
  onKeyDown,
  onClearFilters,
  refetch,
  compact = false,
}: VideoGridProps) => {
  const skeletonCount = compact ? 6 : 8;
  // compact = filter dropdown: more columns (smaller cards), tight gap
  // picker = full picker: fewer columns (larger cards), more gap
  const gridCols = compact
    ? "grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6"
    : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
  const gap = compact ? "gap-1.5" : "gap-2.5";

  if (isLoading) {
    return (
      <div
        className={cn("grid", gridCols, gap)}
        aria-label="Đang tải..."
        aria-busy="true"
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <VideoSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Video className="size-8 opacity-20" />
        <p className="text-sm font-medium">Không tải được danh sách video</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={refetch}
          className="text-xs h-8"
        >
          <RotateCcw className="size-3.5 mr-1.5" /> Thử lại
        </Button>
      </div>
    );
  }

  if (filteredVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Search className="size-8 opacity-20" />
        <div className="text-center">
          <p className="text-sm font-medium">Không tìm thấy video nào</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-primary hover:underline mt-1"
            >
              Xoá bộ lọc để xem tất cả
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      role="listbox"
      aria-label="Danh sách video"
      aria-multiselectable="false"
      onKeyDown={onKeyDown}
      className={cn("grid", gridCols, gap)}
    >
      {filteredVideos.map((video, idx) => (
        <VideoCard
          key={video._id}
          video={video}
          isSelected={value === video._id}
          onSelect={() => onSelect(video._id, idx)}
          isKeyFocused={focusedIndex === idx}
          compact={compact}
        />
      ))}
    </div>
  );
};

// ─── FILTER VARIANT ───────────────────────────────────────────────────────────
// Trigger bar → dropdown panel. Dùng như một filter trên trang listing.
// Mobile: full-width, dropdown bám vào trigger
// Desktop: dropdown mở xuống, có max-height + scroll

interface FilterVariantProps {
  value?: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  videos: MoodVideo[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  allTags: string[];
  filteredVideos: MoodVideo[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  activeTagFilter: string | null;
  setActiveTagFilter: (v: string | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
  totalCount: number;
  focusedIndex: number;
  setFocusedIndex: (n: number) => void;
  gridRef: React.RefObject<HTMLDivElement>;
  handleSelect: (id: string) => void;
  handleDeselect: () => void;
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
  searchId: string;
}

const FilterVariant = ({
  value,
  disabled,
  placeholder = "Chọn video nền...",
  videos,
  isLoading,
  isError,
  refetch,
  allTags,
  filteredVideos,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  activeTagFilter,
  setActiveTagFilter,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  totalCount,
  focusedIndex,
  setFocusedIndex,
  gridRef,
  handleSelect,
  handleDeselect,
  handleGridKeyDown,
  searchId,
}: FilterVariantProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedVideo = useMemo(
    () => videos.find((v) => v._id === value) ?? null,
    [videos, value],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2.5 h-10 px-3 rounded-xl text-sm text-left",
          "border border-border/50 bg-background/70 backdrop-blur-sm",
          "hover:border-border/80 hover:bg-background/90 transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          disabled && "opacity-50 cursor-not-allowed",
          open && "border-primary/50 ring-2 ring-primary/20",
        )}
      >
        {/* Thumbnail or icon */}
        {selectedVideo ? (
          <div className="size-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/30">
            <img
              src={selectedVideo.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="size-7 rounded-lg bg-white/5 border border-border/30 flex items-center justify-center flex-shrink-0">
            <Video className="size-3.5 text-muted-foreground" />
          </div>
        )}

        {/* Label */}
        <span
          className={cn(
            "flex-1 truncate min-w-0",
            !selectedVideo && "text-muted-foreground",
          )}
        >
          {selectedVideo ? selectedVideo.title : placeholder}
        </span>

        {/* Tags chips — desktop only */}
        {selectedVideo && selectedVideo.tags.length > 0 && (
          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            {selectedVideo.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-border/20 text-muted-foreground"
              >
                #{t}
              </span>
            ))}
            {selectedVideo.tags.length > 2 && (
              <span className="text-[9px] text-muted-foreground">
                +{selectedVideo.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeselect();
              }}
              className="size-5 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Xoá lựa chọn"
            >
              <X className="size-3" />
            </button>
          )}
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className={cn(
            "absolute z-50 left-0 right-0 mt-2",
            "rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl",
            "overflow-hidden flex flex-col",
            // Responsive height
            "max-h-[min(70vh,520px)]",
          )}
          role="dialog"
          aria-label="Chọn video canvas"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                Video Canvas
              </span>
              {!isLoading && (
                <span className="text-[10px] text-muted-foreground">
                  {totalCount} video
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="size-6 rounded-lg hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Đóng"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-4 pt-3 pb-2 flex-shrink-0">
            <FilterBar
              searchId={searchId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortBy={sortBy}
              onSortChange={setSortBy}
              allTags={allTags}
              activeTagFilter={activeTagFilter}
              onTagFilter={setActiveTagFilter}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={onClearFilters}
              resultCount={resultCount}
              totalCount={totalCount}
              isLoading={isLoading}
              value={value}
              compact
            />
          </div>

          {/* Scrollable grid */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
            {/* Currently selected strip */}
            {selectedVideo && (
              <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-primary/5 border border-primary/15">
                <div className="size-9 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={selectedVideo.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {selectedVideo.title}
                  </p>
                  <p className="text-[10px] text-primary/70 font-medium">
                    Đang chọn
                  </p>
                </div>
                <div className="size-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="size-3 text-white stroke-[3px]" />
                </div>
              </div>
            )}

            <VideoGrid
              gridRef={gridRef}
              isLoading={isLoading}
              isError={isError}
              filteredVideos={filteredVideos}
              hasActiveFilters={hasActiveFilters}
              value={value}
              focusedIndex={focusedIndex}
              onSelect={(id, idx) => {
                setFocusedIndex(idx);
                handleSelect(id);
                setOpen(false); // auto-close after pick
              }}
              onKeyDown={handleGridKeyDown}
              onClearFilters={onClearFilters}
              refetch={refetch}
              compact
            />
          </div>

          {/* Smart match footer */}
          {!value && (
            <div className="px-4 py-2.5 border-t border-border/20 flex-shrink-0 flex items-center gap-2">
              <Flame className="size-3.5 text-wave-3 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-snug">
                Để trống →{" "}
                <span className="font-semibold text-wave-3">Smart Match</span>{" "}
                tự chọn theo Tags bài hát.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── PICKER VARIANT ───────────────────────────────────────────────────────────
// Full 2-column layout (form / modal)

interface PickerVariantLayoutProps {
  value?: string | null;
  videos: MoodVideo[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  allTags: string[];
  filteredVideos: MoodVideo[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  activeTagFilter: string | null;
  setActiveTagFilter: (v: string | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
  totalCount: number;
  focusedIndex: number;
  setFocusedIndex: (n: number) => void;
  gridRef: React.RefObject<HTMLDivElement>;
  handleSelect: (id: string) => void;
  handleDeselect: () => void;
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
  searchId: string;
}

const PickerVariantLayout = ({
  value,
  videos,
  isLoading,
  isError,
  refetch,
  allTags,
  filteredVideos,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  activeTagFilter,
  setActiveTagFilter,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  totalCount,
  focusedIndex,
  setFocusedIndex,
  gridRef,
  handleSelect,
  handleDeselect,
  handleGridKeyDown,
  searchId,
}: PickerVariantLayoutProps) => {
  const selectedVideo = useMemo(
    () => videos.find((v) => v._id === value) ?? null,
    [videos, value],
  );

  return (
    <div className="space-y-4">
      <FilterBar
        searchId={searchId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        allTags={allTags}
        activeTagFilter={activeTagFilter}
        onTagFilter={setActiveTagFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        resultCount={resultCount}
        totalCount={totalCount}
        isLoading={isLoading}
        value={value}
      />

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: grid */}
        <div className="lg:col-span-8">
          <ScrollArea className="h-[440px] rounded-2xl border border-border/40 bg-card/20 p-3 shadow-inner">
            <VideoGrid
              gridRef={gridRef}
              isLoading={isLoading}
              isError={isError}
              filteredVideos={filteredVideos}
              hasActiveFilters={hasActiveFilters}
              value={value}
              focusedIndex={focusedIndex}
              onSelect={(id, idx) => {
                setFocusedIndex(idx);
                handleSelect(id);
              }}
              onKeyDown={handleGridKeyDown}
              onClearFilters={onClearFilters}
              refetch={refetch}
            />
          </ScrollArea>
        </div>

        {/* Right: preview */}
        <div className="lg:col-span-4">
          <div
            className={cn(
              "h-full rounded-2xl border border-border/40 overflow-hidden bg-card/40 backdrop-blur-md",
              !selectedVideo &&
                "flex items-center justify-center border-dashed",
            )}
            style={{ minHeight: "320px" }}
            aria-live="polite"
            aria-atomic="true"
            aria-label={
              selectedVideo
                ? `Đang xem trước: ${selectedVideo.title}`
                : "Chưa chọn video"
            }
          >
            {selectedVideo ? (
              <VideoPreview video={selectedVideo} onDeselect={handleDeselect} />
            ) : (
              <SmartMatchingPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const MoodVideoPicker = memo(
  ({
    value,
    onChange,
    className,
    disabled = false,
    label,
    variant = "picker",
    placeholder,
  }: MoodVideoPickerProps) => {
    const searchId = useId();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("default");
    const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const gridRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const { data, isLoading, isError, refetch } = useMoodVideosQuery({
      isActive: true,
      limit: 100,
    });

    const videos: MoodVideo[] = data?.videos ?? [];

    // Debounced search
    useEffect(() => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => setDebouncedSearch(searchTerm),
        200,
      );
      return () => clearTimeout(debounceRef.current);
    }, [searchTerm]);

    const allTags = useMemo(() => {
      const set = new Set<string>();
      videos.forEach((v) => v.tags.forEach((t) => set.add(t)));
      return Array.from(set).slice(0, 12);
    }, [videos]);

    const filteredVideos = useMemo(() => {
      let r = videos;
      if (activeTagFilter)
        r = r.filter((v) => v.tags.includes(activeTagFilter));
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        r = r.filter(
          (v) =>
            v.title.toLowerCase().includes(s) ||
            v.tags.some((t) => t.toLowerCase().includes(s)),
        );
      }
      if (sortBy === "title_asc")
        r = [...r].sort((a, b) => a.title.localeCompare(b.title));
      else if (sortBy === "title_desc")
        r = [...r].sort((a, b) => b.title.localeCompare(a.title));
      return r;
    }, [videos, debouncedSearch, activeTagFilter, sortBy]);

    const handleSelect = useCallback(
      (id: string) => {
        if (disabled) return;
        onChange(value === id ? null : id);
      },
      [value, onChange, disabled],
    );

    const handleDeselect = useCallback(() => onChange(null), [onChange]);

    const handleClearFilters = useCallback(() => {
      setSearchTerm("");
      setDebouncedSearch("");
      setActiveTagFilter(null);
      setSortBy("default");
    }, []);

    const handleGridKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!filteredVideos.length) return;
        // Filter variant có nhiều cột hơn
        const cols = variant === "filter" ? 5 : 3;
        const len = filteredVideos.length;
        let next = focusedIndex;

        if (e.key === "ArrowRight") next = Math.min(focusedIndex + 1, len - 1);
        else if (e.key === "ArrowLeft") next = Math.max(focusedIndex - 1, 0);
        else if (e.key === "ArrowDown")
          next = Math.min(focusedIndex + cols, len - 1);
        else if (e.key === "ArrowUp") next = Math.max(focusedIndex - cols, 0);
        else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (focusedIndex >= 0 && filteredVideos[focusedIndex]) {
            handleSelect(filteredVideos[focusedIndex]._id);
          }
          return;
        } else if (e.key === "Escape") {
          handleDeselect();
          return;
        } else return;

        e.preventDefault();
        setFocusedIndex(next);
        const buttons =
          gridRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]");
        buttons?.[next]?.focus();
      },
      [filteredVideos, focusedIndex, handleSelect, handleDeselect, variant],
    );

    const hasActiveFilters =
      !!debouncedSearch || !!activeTagFilter || sortBy !== "default";

    // Props chung cho cả 2 variant
    const sharedProps = {
      value,
      onChange,
      disabled,
      videos,
      isLoading,
      isError,
      refetch,
      allTags,
      filteredVideos,
      searchTerm,
      setSearchTerm,
      sortBy,
      setSortBy,
      activeTagFilter,
      setActiveTagFilter,
      hasActiveFilters,
      onClearFilters: handleClearFilters,
      resultCount: filteredVideos.length,
      totalCount: videos.length,
      focusedIndex,
      setFocusedIndex,
      gridRef,
      handleSelect,
      handleDeselect,
      handleGridKeyDown,
      searchId,
    };

    return (
      <TooltipProvider delayDuration={300}>
        <div
          className={cn(
            disabled && "opacity-50 pointer-events-none",
            className,
          )}
          aria-label={label ?? "Chọn video nền"}
        >
          {variant === "filter" ? (
            <FilterVariant placeholder={placeholder} {...sharedProps} />
          ) : (
            <PickerVariantLayout {...sharedProps} />
          )}
        </div>
      </TooltipProvider>
    );
  },
);

MoodVideoPicker.displayName = "MoodVideoPicker";
