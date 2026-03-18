/**
 * @file PublicGenreSelector.tsx
 * @description Genre selector với 2 layout:
 *  - "filter" variant: dùng trong FilterDropdown (compact, single-select)
 *  - "form"   variant: dùng trong form nhập liệu (multi-select, có badge tags)
 *
 * Visual hierarchy:
 *  - Parent genres → grid card (2 cột mobile, 3 cột desktop)
 *  - Sub-genres    → list nhỏ gọn xuất hiện khi parent được expand
 *  - Khi search    → flat list kết quả
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  Check,
  X,
  Loader2,
  Music,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenreTreeQuery } from "@/features/genre/hooks/useGenresQuery";
import type { Genre } from "@/features/genre/types";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

// ── Types ─────────────────────────────────────────────────────────────────────

type GenreNode = Genre & {
  children: Genre[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve parentId bất kể dạng string hay populated object */
const resolveParentId = (genre: Genre): string | null => {
  if (!genre.parentId) return null;
  if (typeof genre.parentId === "object" && "_id" in (genre.parentId as any)) {
    return (genre.parentId as any)._id as string;
  }
  return genre.parentId as string;
};

/** Build 2-level tree: chỉ parent + children trực tiếp, không đệ quy sâu hơn */
const buildTwoLevelTree = (
  items: Genre[],
  excludeIds: string[] = [],
): GenreNode[] => {
  const filtered = items.filter((g) => !excludeIds.includes(g._id));
  const parents = filtered
    .filter((g) => !resolveParentId(g))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return parents.map((parent) => ({
    ...parent,
    children: filtered
      .filter((g) => resolveParentId(g) === parent._id)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
  }));
};

const hexToRgba = (hex: string, opacity: number): string => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? `rgba(${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)},${opacity})`
    : `rgba(139,92,246,${opacity})`;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface PublicGenreSelectorProps {
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PublicGenreSelector: React.FC<PublicGenreSelectorProps> = ({
  label,
  required,
  error,
  value,
  onChange,
  singleSelect = false,
  excludeIds = [],
  className,
  placeholder = "Tìm thể loại...",
  variant = "form",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  // Track which parent is expanded (chỉ 1 tại 1 thời điểm)
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const { data: genres, isLoading } = useGenreTreeQuery();

  // ── Selection helpers ──────────────────────────────────────────────────────

  const selectedIds = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value) return [value];
    return [];
  }, [value]);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const handleSelect = useCallback(
    (id: string | null | undefined) => {
      if (singleSelect) {
        onChange(
          id === (Array.isArray(value) ? value[0] : value) ? undefined : id,
        );
        return;
      }
      if (!id) return;
      const next = isSelected(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange(next);
    },
    [singleSelect, value, selectedIds, isSelected, onChange],
  );

  // ── Data ───────────────────────────────────────────────────────────────────

  const tree = useMemo(
    () => (genres ? buildTwoLevelTree(genres, excludeIds) : []),
    [genres, excludeIds],
  );

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || !genres) return [];
    const q = searchTerm.toLowerCase();
    return genres
      .filter(
        (g) => !excludeIds.includes(g._id) && g.name.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [genres, searchTerm, excludeIds]);

  const isSearching = searchTerm.trim().length > 0;

  // ── Sub-component: Genre avatar ────────────────────────────────────────────

  const GenreAvatar = ({
    genre,
    size = 40,
    className: cls = "",
  }: {
    genre: Genre;
    size?: number;
    className?: string;
  }) => {
    const color = genre.color ?? "#8b5cf6";
    return (
      <div
        className={cn(
          "rounded-xl overflow-hidden shrink-0 flex items-center justify-center",
          cls,
        )}
        style={{
          width: size,
          height: size,
          backgroundColor: hexToRgba(color, 0.15),
        }}
      >
        {genre.image ? (
          <ImageWithFallback
            src={genre.image}
            alt={genre.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="size-4" style={{ color }} />
        )}
      </div>
    );
  };

  // ── Sub-component: Parent card (grid item) ─────────────────────────────────

  const ParentCard = ({ node }: { node: GenreNode }) => {
    const color = node.color ?? "#8b5cf6";
    const active = isSelected(node._id);
    const expanded = expandedParentId === node._id;
    const hasChildren = node.children.length > 0;

    const handleCardClick = () => {
      handleSelect(node._id);
      if (hasChildren) {
        setExpandedParentId(expanded ? null : node._id);
      }
    };

    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleCardClick}
          className={cn(
            "relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200 text-left w-full",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            active
              ? "border-transparent shadow-sm"
              : "border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-border",
          )}
          style={
            active
              ? {
                  backgroundColor: hexToRgba(color, 0.12),
                  borderColor: hexToRgba(color, 0.35),
                }
              : undefined
          }
        >
          {/* Active indicator strip */}
          {active && (
            <div
              className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Check className="size-2.5 text-white" strokeWidth={3} />
            </div>
          )}

          <GenreAvatar genre={node} size={40} />

          <span
            className="text-[12px] font-semibold text-center leading-tight line-clamp-2 w-full"
            style={{ color: active ? color : undefined }}
          >
            {node.name}
          </span>

          {/* Children toggle hint */}
          {hasChildren && !singleSelect && (
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-200",
                expanded ? "rotate-180" : "",
              )}
              style={{ color: active ? color : "var(--color-text-tertiary)" }}
            />
          )}
        </button>

        {/* Sub-genre list — inline expand khi có children */}
        {hasChildren && expanded && (
          <div className="col-span-full flex flex-col gap-0.5 pl-2 border-l-2 border-border/40 ml-2 animate-in slide-in-from-top-1 fade-in duration-200">
            {node.children.map((child) => (
              <SubGenreRow key={child._id} genre={child} parentColor={color} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Sub-component: Sub-genre row ───────────────────────────────────────────

  const SubGenreRow = ({
    genre,
    parentColor,
  }: {
    genre: Genre;
    parentColor: string;
  }) => {
    const color = genre.color ?? parentColor;
    const active = isSelected(genre._id);

    return (
      <button
        type="button"
        onClick={() => handleSelect(genre._id)}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left w-full transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          active
            ? "shadow-sm"
            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
        )}
        style={active ? { backgroundColor: hexToRgba(color, 0.1) } : undefined}
      >
        <GenreAvatar genre={genre} size={28} className="rounded-lg" />

        <span
          className="flex-1 text-[12px] font-medium truncate"
          style={{ color: active ? color : undefined }}
        >
          {genre.name}
        </span>

        {active && (
          <Check
            className="size-3.5 shrink-0"
            style={{ color }}
            strokeWidth={3}
          />
        )}
      </button>
    );
  };

  // ── Sub-component: Flat search result row ──────────────────────────────────

  const SearchRow = ({ genre }: { genre: Genre }) => {
    const color = genre.color ?? "#8b5cf6";
    const active = isSelected(genre._id);

    return (
      <button
        type="button"
        onClick={() => handleSelect(genre._id)}
        className={cn(
          "flex items-center gap-3 px-2 py-2 rounded-xl text-left w-full transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          active ? "shadow-sm" : "hover:bg-muted/50",
        )}
        style={active ? { backgroundColor: hexToRgba(color, 0.1) } : undefined}
      >
        <GenreAvatar genre={genre} size={36} />

        <span
          className="flex-1 text-[13px] font-semibold truncate"
          style={{ color: active ? color : "hsl(var(--foreground))" }}
        >
          {genre.name}
        </span>

        {active && (
          <div
            className="size-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: color }}
          >
            <Check className="size-3 text-white" strokeWidth={3} />
          </div>
        )}
      </button>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("w-full flex flex-col gap-2.5", className)}>
      {/* Label */}
      {label && (
        <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 ml-0.5">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </Label>
      )}

      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex flex-col overflow-hidden transition-all",
          variant === "form"
            ? "rounded-2xl border bg-card shadow-sm"
            : "rounded-xl border-0 bg-transparent",
          error && "ring-1 ring-rose-400/40 border-rose-400/40",
        )}
      >
        {/* Search input */}
        <div
          className={cn(
            "sticky top-0 z-10 px-2 pt-2 pb-2",
            variant === "form"
              ? "bg-card/90 backdrop-blur-md border-b border-border/40"
              : "bg-popover/90 backdrop-blur-md",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 h-10 rounded-xl px-3 transition-all",
              "bg-muted/50 hover:bg-muted/70",
              "focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20",
            )}
          >
            <Search className="size-4 text-muted-foreground/50 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck="false"
              className="flex-1 bg-transparent border-none outline-none text-[13px] placeholder:text-muted-foreground/50 min-w-0"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="size-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div
          className={cn(
            "overflow-y-auto custom-scrollbar scroll-smooth",
            variant === "filter"
              ? "max-h-[320px]"
              : "max-h-[380px] sm:max-h-[420px]",
          )}
        >
          {isLoading ? (
            /* Loading state */
            <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary/60" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                Đang tải...
              </span>
            </div>
          ) : isSearching ? (
            /* ── Search results: flat list ──────────────────────────────── */
            <div className="p-2 flex flex-col gap-0.5">
              {searchResults.length > 0 ? (
                searchResults.map((g) => <SearchRow key={g._id} genre={g} />)
              ) : (
                <EmptyState message={`Không có kết quả cho "${searchTerm}"`} />
              )}
            </div>
          ) : (
            /* ── Browse mode: grid of parents + inline sub-list ────────── */
            <div className="p-2 space-y-4">
              {/* "Tất cả" option (filter mode only) */}
              {variant === "filter" && (
                <button
                  type="button"
                  onClick={() => onChange(undefined)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-[13px] font-semibold",
                    !value
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "size-7 rounded-lg flex items-center justify-center",
                      !value ? "bg-primary/20" : "bg-muted",
                    )}
                  >
                    <Music
                      className={cn(
                        "size-3.5",
                        !value ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  Tất cả thể loại
                  {!value && (
                    <Check
                      className="size-4 ml-auto text-primary"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              )}

              {/* Parent genre grid */}
              {tree.length > 0 ? (
                <>
                  {variant === "form" && (
                    <SectionLabel>Thể loại chính</SectionLabel>
                  )}
                  <div
                    className={cn(
                      "grid gap-2",
                      variant === "filter"
                        ? "grid-cols-3"
                        : "grid-cols-3 sm:grid-cols-4",
                    )}
                  >
                    {tree.map((node) => (
                      <div key={node._id} className="contents">
                        <ParentCard node={node} />
                        {/* Sub-genre rows span full width below expanded parent */}
                        {node.children.length > 0 &&
                          expandedParentId === node._id && (
                            <div className="col-span-3 sm:col-span-4 flex flex-col gap-0.5 border-l-2 border-primary/20 pl-3 ml-1 mt-0.5 mb-1 animate-in slide-in-from-top-2 fade-in duration-200">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 pl-0.5">
                                Thể loại con
                              </p>
                              {node.children.map((child) => (
                                <SubGenreRow
                                  key={child._id}
                                  genre={child}
                                  parentColor={node.color ?? "#8b5cf6"}
                                />
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="Chưa có thể loại nào" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Selected badges (form mode, multi-select) ────────────────────── */}
      {!singleSelect &&
        selectedIds.length > 0 &&
        genres &&
        variant === "form" && (
          <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-300">
            {selectedIds.map((id) => {
              const g = genres.find((x) => x._id === id);
              if (!g) return null;
              const color = g.color ?? "#8b5cf6";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  title="Nhấn để xóa"
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-[12px] font-semibold transition-all hover:opacity-80 active:scale-95"
                  style={{
                    backgroundColor: hexToRgba(color, 0.12),
                    color,
                    border: `1px solid ${hexToRgba(color, 0.3)}`,
                  }}
                >
                  {g.image ? (
                    <img
                      src={g.image}
                      alt=""
                      className="size-5 rounded-full object-cover bg-white/20"
                    />
                  ) : (
                    <div
                      className="size-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: hexToRgba(color, 0.2) }}
                    >
                      <Music className="size-3" style={{ color }} />
                    </div>
                  )}
                  <span className="max-w-[96px] truncate">{g.name}</span>
                  <X className="size-3 opacity-60" />
                </button>
              );
            })}
          </div>
        )}

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-500 animate-in slide-in-from-top-1 duration-200">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 ml-0.5">
    {children}
  </p>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center animate-in fade-in duration-300">
    <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center border border-border/40">
      <Search className="size-5 text-muted-foreground/40" />
    </div>
    <p className="text-[13px] font-semibold text-muted-foreground">{message}</p>
  </div>
);

export default PublicGenreSelector;
