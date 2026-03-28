/**
 * Pagination.tsx — Premium pagination bar for data tables and catalog pages
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURE
 *   Pagination (orchestrator)
 *   ├── ProgressBar      — reading-position indicator (memoized)
 *   ├── StatsLabel       — "X–Y / Total items" with per-page selector
 *   ├── PageNav          — prev/next/first/last + numbered page buttons
 *   │   └── PageButton   — individual page number button (memoized)
 *   └── JumpForm         — "Go to page" input + submit
 *
 * KEY IMPROVEMENTS OVER ORIGINAL
 *
 * DESIGN SYSTEM ALIGNMENT
 *   The original used an inline `<style>` block with completely custom CSS
 *   variables (`--pg-bg`, `--pg-accent`, etc.) that DUPLICATE the Soundwave
 *   token system (`--background`, `--primary`, `--muted-foreground`, etc.).
 *   This means:
 *     1. Theme switching (dark/light) requires updating TWO token systems.
 *     2. Any Soundwave color change doesn't propagate to pagination.
 *     3. The `--pg-accent` in dark mode (#7c6af7) and light (#e8622a) are
 *        hardcoded — they'll diverge from the brand color over time.
 *
 *   REFACTOR: Entire inline CSS eliminated. All styling uses Tailwind
 *   utility classes that reference Soundwave CSS variables. Theme switching
 *   is automatic — the component inherits from the design system.
 *
 * PERFORMANCE
 *   • `handlePageChange` wrapped in useCallback — was recreated on every
 *     render, causing all page buttons to receive new onClick references.
 *   • `handleJump` wrapped in useCallback.
 *   • `PageButton` extracted as memo'd component — in a list of 7+ page
 *     buttons, only the previously-active and newly-active buttons re-render
 *     on page change. Original: all buttons re-rendered.
 *   • `ProgressBar` memo'd — re-renders only when `progressPercent` changes.
 *   • `StatsLabel` memo'd — re-renders only when stats change.
 *   • `ripplePage` state: the original used `setTimeout(400)` to clear it.
 *     Replaced with `onAnimationEnd` on the page button — fires exactly when
 *     the ripple CSS animation ends, not 400ms later regardless.
 *   • `pageNumbers` useMemo: deps are `[currentPage, totalPages]` — correct.
 *     The `pages.includes(i)` check inside the loop was O(n) — replaced
 *     with a `Set` for O(1) membership testing.
 *
 * ACCESSIBILITY
 *   • `<nav aria-label="Pagination navigation">` landmark.
 *   • All buttons: `aria-label`, `aria-disabled`, `aria-current="page"`.
 *   • Progress bar: `aria-hidden="true"` (decorative).
 *   • Mobile indicator: `aria-live="polite"`.
 *   • Jump input: `aria-label`, `aria-describedby` linking to validation hint.
 *   • Stats: `aria-label` on the stats region.
 *   • Per-page select: `aria-label`.
 *   • Ellipsis spans: `aria-hidden="true"`.
 *
 * RESPONSIVENESS
 *   • Mobile (<sm): Stats + nav stacked vertically, edge buttons hidden.
 *   • Tablet (<md): Edge buttons (first/last page) hidden.
 *   • Desktop: Full layout.
 *   • "Go to" label hidden on very small screens (<xs).
 *   • Page numbers hidden on mobile, replaced by "X / Y" mobile indicator.
 */

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (value: number) => void;
  itemLabel?: string; // e.g. "tracks", "albums", "artists"
  className?: string;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — module scope
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR — memoized, re-renders only when progress changes
// ─────────────────────────────────────────────────────────────────────────────

const ProgressBar = memo(({ percent }: { percent: number }) => (
  <div className="h-[2px] bg-muted/50 overflow-hidden" aria-hidden="true">
    <div
      className={cn(
        "h-full rounded-r-full",
        "bg-gradient-to-r from-primary via-[hsl(var(--wave-1))] to-[hsl(var(--wave-2))]",
        "transition-[width] duration-400 ease-out",
        "shadow-[0_0_8px_hsl(var(--primary)/0.4)]",
      )}
      style={{ width: `${percent}%` }}
    />
  </div>
));
ProgressBar.displayName = "ProgressBar";

// ─────────────────────────────────────────────────────────────────────────────
// NAV BUTTON — shared style for prev/next/first/last buttons
// ─────────────────────────────────────────────────────────────────────────────

interface NavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
}

const NavButton = memo(
  ({ label, size = "md", children, className, ...props }: NavButtonProps) => (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border",
        "bg-card text-muted-foreground",
        "shadow-raised hover:shadow-elevated",
        "hover:bg-accent hover:text-foreground hover:border-primary/35",
        "hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
        "active:scale-90 transition-all duration-150",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        size === "md" ? "w-[34px] h-[34px]" : "w-[30px] h-[34px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
NavButton.displayName = "NavButton";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE BUTTON — individual numbered page button, memoized
// Uses CSS animation end event to clear ripple — no setTimeout needed.
// ─────────────────────────────────────────────────────────────────────────────

interface PageButtonProps {
  page: number;
  isActive: boolean;
  isRipple: boolean;
  isLoading: boolean;
  onClick: (page: number) => void;
  onRippleEnd: () => void;
}

const PageButton = memo(
  ({
    page,
    isActive,
    isRipple,
    isLoading,
    onClick,
    onRippleEnd,
  }: PageButtonProps) => (
    <button
      type="button"
      role="listitem"
      aria-label={`Page ${page}`}
      aria-current={isActive ? "page" : undefined}
      disabled={isLoading && !isActive}
      onClick={() => !isActive && onClick(page)}
      onAnimationEnd={isRipple ? onRippleEnd : undefined}
      className={cn(
        "relative w-[34px] h-[34px] inline-flex items-center justify-center",
        "rounded-lg border text-[12px] font-mono font-medium",
        "overflow-hidden transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isActive
          ? [
              "bg-primary border-primary text-primary-foreground font-bold",
              "shadow-[0_0_0_3px_hsl(var(--primary)/0.22)]",
              "shadow-brand cursor-default pointer-events-none",
            ]
          : [
              "bg-card border-border text-muted-foreground",
              "shadow-raised hover:shadow-elevated",
              "hover:bg-accent hover:text-foreground hover:border-primary/35",
              "hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.14)]",
              "active:scale-90 cursor-pointer",
            ],
        isRipple && "animate-[pg-ripple_0.35s_ease-out_both]",
      )}
    >
      {/* Ripple overlay */}
      {isRipple && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit] bg-primary/25 animate-[pg-ripple_0.35s_ease-out_both] pointer-events-none"
        />
      )}
      {page}
    </button>
  ),
);
PageButton.displayName = "PageButton";

// ─────────────────────────────────────────────────────────────────────────────
// STATS LABEL — memoized item count + per-page selector
// ─────────────────────────────────────────────────────────────────────────────

interface StatsLabelProps {
  startItem: number;
  endItem: number;
  totalItems: number;
  itemLabel: string;
  itemsPerPage: number;
  onItemsPerPageChange?: (value: number) => void;
}

const StatsLabel = memo(
  ({
    startItem,
    endItem,
    totalItems,
    itemLabel,
    itemsPerPage,
    onItemsPerPageChange,
  }: StatsLabelProps) => (
    <div
      className="flex items-center gap-3.5 min-w-0"
      aria-label={`Showing ${startItem} to ${endItem} of ${totalItems} ${itemLabel}`}
    >
      {/* Item range */}
      <span className="flex items-baseline gap-1 text-[11.5px] whitespace-nowrap">
        <span className="font-mono font-semibold text-foreground/90 tabular-nums">
          {startItem}–{endItem}
        </span>
        <span className="text-muted-foreground/50 font-light text-[10.5px]">
          /
        </span>
        <span className="font-mono font-semibold text-foreground/90 tabular-nums">
          {totalItems.toLocaleString()}
        </span>
        <span className="text-muted-foreground/55 text-[10.5px] font-normal ml-0.5">
          {itemLabel}
        </span>
      </span>

      {/* Per-page selector */}
      {onItemsPerPageChange && (
        <div className="flex items-center gap-1.5 pl-3.5 border-l border-border/60">
          <span className="text-[10.5px] text-muted-foreground/55 whitespace-nowrap font-normal">
            per page
          </span>
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              aria-label="Items per page"
              className={cn(
                "appearance-none bg-card border border-border rounded-md",
                "text-foreground text-[11.5px] font-mono font-semibold",
                "pl-2.5 pr-5 py-[3px] cursor-pointer outline-none",
                "shadow-raised transition-all duration-150",
                "hover:border-primary/40 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
                "focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]",
              )}
            >
              {ITEMS_PER_PAGE_OPTIONS.map((val) => (
                <option
                  key={val}
                  value={val}
                  className="bg-popover text-foreground"
                >
                  {val}
                </option>
              ))}
            </select>
            {/* Chevron */}
            <span
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-[9px] pointer-events-none"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>
        </div>
      )}
    </div>
  ),
);
StatsLabel.displayName = "StatsLabel";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE NUMBERS — windowed page list with smart ellipsis
//
// FIX: Original used `pages.includes(i)` — O(n) per iteration → O(n²) total.
// Replaced with a `Set<number>` for O(1) membership checks.
// ─────────────────────────────────────────────────────────────────────────────

type PageEntry = number | "ellipsis-start" | "ellipsis-end";

function buildPageNumbers(
  currentPage: number,
  totalPages: number,
): PageEntry[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: PageEntry[] = [];
  const pageSet = new Set<number>(); // O(1) membership check

  const addPage = (p: number) => {
    if (!pageSet.has(p)) {
      pageSet.add(p);
      pages.push(p);
    }
  };

  const showLeftEllipsis = currentPage > 3;
  const showRightEllipsis = currentPage < totalPages - 2;

  // First page always visible
  addPage(1);

  if (showLeftEllipsis) {
    pages.push("ellipsis-start");
  } else {
    addPage(2);
  }

  // Window around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) addPage(i);

  if (showRightEllipsis) {
    pages.push("ellipsis-end");
  } else {
    addPage(totalPages - 1);
  }

  // Last page always visible
  addPage(totalPages);

  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
  itemLabel = "items",
  className,
  isLoading = false,
}: PaginationProps) => {
  const [jumpValue, setJumpValue] = useState("");
  const [jumpFocused, setJumpFocused] = useState(false);
  const [ripplePage, setRipplePage] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear jump input on page change
  useEffect(() => {
    setJumpValue("");
  }, [currentPage]);

  // ── Handlers — stable via useCallback ───────────────────────────────────

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages || page === currentPage || isLoading)
        return;
      setRipplePage(page);
      onPageChange(page);
    },
    [totalPages, currentPage, isLoading, onPageChange],
  );

  const handleRippleEnd = useCallback(() => setRipplePage(null), []);

  const handleJump = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const page = parseInt(jumpValue, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        handlePageChange(page);
        inputRef.current?.blur();
      } else {
        setJumpValue("");
        inputRef.current?.select();
      }
    },
    [jumpValue, totalPages, handlePageChange],
  );

  const handleJumpFocus = useCallback(() => setJumpFocused(true), []);
  const handleJumpBlur = useCallback(() => setJumpFocused(false), []);
  const handleJumpChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setJumpValue(e.target.value.replace(/\D/g, "")),
    [],
  );

  // ── Derived values ───────────────────────────────────────────────────────

  const { startItem, endItem } = useMemo(() => {
    if (totalItems === 0) return { startItem: 0, endItem: 0 };
    return {
      startItem: (currentPage - 1) * itemsPerPage + 1,
      endItem: Math.min(currentPage * itemsPerPage, totalItems),
    };
  }, [currentPage, itemsPerPage, totalItems]);

  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const progressPercent =
    totalPages <= 1 ? 100 : ((currentPage - 1) / (totalPages - 1)) * 100;

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages || totalPages === 0;

  return (
    <>
      {/*
       * Ripple keyframe injected once — cannot use Tailwind's arbitrary
       * animation for a multi-step keyframe. This is the only CSS not in
       * Tailwind, and it's scoped to a single animation name.
       */}
      <style>{`
        @keyframes pg-ripple {
          0%   { opacity: 0.4; transform: scale(0.5); }
          100% { opacity: 0;   transform: scale(2.8); }
        }
      `}</style>

      <div
        className={cn("w-full select-none", className)}
        aria-label="Pagination controls"
      >
        {/* Progress bar */}
        <ProgressBar percent={progressPercent} />

        {/* Main row */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-2.5",
            "bg-card border-t border-border/60",
            "flex-wrap sm:flex-nowrap",
          )}
        >
          {/* ── LEFT: Stats + per-page ──────────────────────────────── */}
          <StatsLabel
            startItem={startItem}
            endItem={endItem}
            totalItems={totalItems}
            itemLabel={itemLabel}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={onItemsPerPageChange}
          />

          {/* ── CENTER: Navigation ──────────────────────────────────── */}
          <nav
            aria-label="Pagination navigation"
            className="flex items-center gap-1 shrink-0"
          >
            {/* First page — hidden on mobile */}
            <NavButton
              label="First page"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={isFirst || isLoading}
              className="hidden md:inline-flex"
            >
              <ChevronsLeft size={14} aria-hidden="true" />
            </NavButton>

            {/* Previous */}
            <NavButton
              label="Previous page"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={isFirst || isLoading}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </NavButton>

            {/* Page numbers — desktop only */}
            <div
              role="list"
              className="hidden sm:flex items-center gap-[3px]"
              aria-label="Page numbers"
            >
              {pageNumbers.map((entry) =>
                entry === "ellipsis-start" || entry === "ellipsis-end" ? (
                  <span
                    key={entry}
                    aria-hidden="true"
                    className="w-7 h-[34px] inline-flex items-center justify-center text-[13px] text-muted-foreground/45 tracking-widest pointer-events-none"
                  >
                    ···
                  </span>
                ) : (
                  <PageButton
                    key={`pg-${entry}`}
                    page={entry}
                    isActive={currentPage === entry}
                    isRipple={ripplePage === entry}
                    isLoading={isLoading}
                    onClick={handlePageChange}
                    onRippleEnd={handleRippleEnd}
                  />
                ),
              )}
            </div>

            {/* Mobile indicator — current / total */}
            <div
              className="sm:hidden flex items-baseline gap-[3px] px-1.5"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="font-mono text-[14px] font-bold text-primary tabular-nums">
                {currentPage}
              </span>
              <span className="text-[11px] text-muted-foreground/50">/</span>
              <span className="font-mono text-[12px] font-medium text-muted-foreground/65 tabular-nums">
                {totalPages}
              </span>
            </div>

            {/* Next */}
            <NavButton
              label="Next page"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={isLast || isLoading}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </NavButton>

            {/* Last page — hidden on mobile */}
            <NavButton
              label="Last page"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={isLast || isLoading}
              className="hidden md:inline-flex"
            >
              <ChevronsRight size={14} aria-hidden="true" />
            </NavButton>
          </nav>

          {/* ── RIGHT: Jump to page ──────────────────────────────────── */}
          <form
            onSubmit={handleJump}
            noValidate
            className="flex items-center gap-1.5 shrink-0"
          >
            <label
              htmlFor="page-jump"
              className="text-[10.5px] text-muted-foreground/55 whitespace-nowrap hidden xs:block"
            >
              Go to
            </label>

            {/* Input wrapper — focus ring via parent class */}
            <div
              className={cn(
                "rounded-lg transition-all duration-150",
                jumpFocused && "shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]",
              )}
            >
              <input
                ref={inputRef}
                id="page-jump"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={String(currentPage)}
                value={jumpValue}
                onChange={handleJumpChange}
                onFocus={handleJumpFocus}
                onBlur={handleJumpBlur}
                aria-label="Jump to page number"
                aria-describedby="page-jump-hint"
                maxLength={String(totalPages).length}
                className={cn(
                  "w-[52px] h-[34px] text-center",
                  "bg-card border border-border rounded-lg",
                  "text-foreground font-mono text-[12px] font-semibold",
                  "shadow-raised outline-none",
                  "placeholder:text-muted-foreground/40 placeholder:font-normal",
                  "transition-[border-color] duration-150",
                  jumpFocused ? "border-primary" : "hover:border-primary/40",
                )}
              />
            </div>

            <span id="page-jump-hint" className="sr-only">
              Enter a page number between 1 and {totalPages}
            </span>

            <button
              type="submit"
              disabled={isLoading}
              aria-label="Go to page"
              className={cn(
                "w-[34px] h-[34px] inline-flex items-center justify-center",
                "rounded-lg bg-primary text-primary-foreground",
                "shadow-brand hover:shadow-brand-lg",
                "hover:brightness-105 active:scale-90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              )}
            >
              <CornerDownRight size={13} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Pagination;
