/**
 * YearPicker.tsx — Year selection popover / inline panel
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPROVEMENTS
 *   • `YearPanel` JSX: moved from inline variable inside `render` to a
 *     named memo component `YearGrid`. The original assigned JSX to a
 *     `const YearPanel` variable — this isn't memoized; React re-creates
 *     the full VDOM tree on every render. As a `memo` component it
 *     re-renders only when `decades`, `value`, `disabled`, or handlers change.
 *
 *   • `groupByDecade` extracted to module scope — pure function, never
 *     recreated.
 *
 *   • `handleSelect` / `handleClear`: `useCallback` deps are minimal and
 *     correct in the original; preserved.
 *
 *   • Close-on-outside-click: the original's `useEffect` with `mousedown`
 *     is correct. Preserved with a comment explaining why `mousedown` (not
 *     `click`) is used — prevents same-event re-open after portal renders.
 *
 *   • `scrollIntoView` on open: `requestAnimationFrame` preserved — correct
 *     approach since we need one frame for the DOM to render before measuring.
 *
 *   • Popover positioning: original used inline `style={{ top: "100%", left: 0 }}`
 *     which breaks in containers with `overflow: hidden`. Changed to use
 *     Tailwind's `top-full` + `left-0` — same behavior but composable.
 *
 *   • `role="listbox"` on popover, `role="option"` on year buttons,
 *     `aria-selected` on each year.
 *
 *   • `aria-haspopup="listbox"` on trigger (was `"listbox"` — correct).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cn } from "@/lib/utils";
import { Calendar, ChevronDown, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ═════════════════════════════════════════════════════════════════════════════
// YEAR PICKER
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface YearPickerProps {
  value?: number;
  onChange: (year?: number) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  variant?: "form" | "filter";
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface DecadeGroup {
  label: string;
  years: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — module scope, pure functions, zero allocation per render
// ─────────────────────────────────────────────────────────────────────────────

const groupByDecade = (years: number[]): DecadeGroup[] => {
  const map = new Map<number, number[]>();
  for (const y of years) {
    const decade = Math.floor(y / 10) * 10;
    if (!map.has(decade)) map.set(decade, []);
    map.get(decade)!.push(y);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([decade, ys]) => ({
      label: `${decade}s`,
      years: ys.sort((a, b) => b - a),
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// YEAR GRID — memoized panel content
// Extracted from inline JSX variable (original `const YearPanel = (...)`)
// to a proper memo'd component — only re-renders when selection changes.
// ─────────────────────────────────────────────────────────────────────────────

interface YearGridProps {
  decades: DecadeGroup[];
  value?: number;
  disabled: boolean;
  maxHeight: number;
  onSelect: (year: number) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

const YearGrid = memo(
  ({
    decades,
    value,
    disabled,
    maxHeight,
    onSelect,
    scrollRef,
  }: YearGridProps) => {
    const currentYear = new Date().getFullYear();

    return (
      <div
        ref={scrollRef}
        role="listbox"
        aria-label="Select year"
        className="overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        <div className="p-2 space-y-3">
          {decades.map(({ label: decadeLabel, years }) => {
            const hasSelected = years.includes(value ?? -1);

            return (
              <div key={decadeLabel}>
                {/* Decade header */}
                <div className="flex items-center gap-2 px-1.5 mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-[0.12em] transition-colors duration-150",
                      hasSelected ? "text-primary" : "text-muted-foreground/35",
                    )}
                  >
                    {decadeLabel}
                  </span>
                  <div
                    className={cn(
                      "flex-1 h-px transition-colors duration-150",
                      hasSelected ? "bg-primary/22" : "bg-border/35",
                    )}
                    aria-hidden="true"
                  />
                  {hasSelected && (
                    <span
                      className="text-[9px] font-bold text-primary/65"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* Year grid */}
                <div className="grid grid-cols-4 gap-1">
                  {years.map((year) => {
                    const isSelected = value === year;
                    const isCurrent = year === currentYear;

                    return (
                      <button
                        key={year}
                        data-year={year}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={disabled}
                        onClick={() => onSelect(year)}
                        className={cn(
                          "relative h-8 rounded-lg text-[13px] font-semibold transition-all duration-100 select-none",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/22 scale-105 font-bold"
                            : isCurrent
                              ? "bg-primary/[0.08] text-primary border border-primary/22 hover:bg-primary/14"
                              : "text-foreground/65 hover:bg-muted/60 hover:text-foreground active:scale-95",
                          disabled &&
                            "opacity-40 cursor-not-allowed pointer-events-none",
                        )}
                      >
                        {year}
                        {/* Current year dot */}
                        {isCurrent && !isSelected && (
                          <span
                            className="absolute bottom-[3px] left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary/45"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
YearGrid.displayName = "YearGrid";

// ─────────────────────────────────────────────────────────────────────────────
// YEAR PICKER — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const YearPicker: React.FC<YearPickerProps> = ({
  value,
  onChange,
  minYear = 1960,
  maxYear = new Date().getFullYear(),
  className,
  variant = "filter",
  label,
  required,
  error,
  placeholder = "Release year",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [minYear, maxYear],
  );

  const decades = useMemo(() => groupByDecade(years), [years]);

  // Close on outside click — `mousedown` not `click` prevents
  // re-open when the same click event bubbles back up from a portal.
  useEffect(() => {
    if (variant !== "filter" || !isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [variant, isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Scroll selected year into view — rAF defers until DOM is rendered
  useLayoutEffect(() => {
    if (!isOpen && variant !== "form") return;
    if (!value || !scrollRef.current) return;

    const id = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-year="${value}"]`,
      );
      if (el) el.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, value, variant]);

  const handleSelect = useCallback(
    (year: number) => {
      onChange(year === value ? undefined : year);
      if (variant === "filter") setIsOpen(false);
    },
    [value, onChange, variant],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(undefined);
      if (variant === "filter") setIsOpen(false);
    },
    [onChange, variant],
  );

  // ── FORM VARIANT — always-visible inline panel ───────────────────────────

  if (variant === "form") {
    return (
      <div className={cn("w-full flex flex-col gap-2", className)}>
        {label && (
          <label className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1 ml-0.5">
            {label}
            {required && (
              <span className="text-rose-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div
          className={cn(
            "rounded-xl bg-card border overflow-hidden transition-all duration-200",
            error
              ? "border-rose-500/50 ring-1 ring-rose-500/22"
              : "border-border/60 shadow-sm",
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/18">
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <Calendar className="size-3.5" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {value ? `Selected: ${value}` : placeholder}
              </span>
            </div>
            {value && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/55 hover:text-rose-500 transition-colors px-2 py-0.5 rounded-md hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/40"
              >
                <X className="size-3" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>

          <YearGrid
            decades={decades}
            value={value}
            disabled={disabled}
            maxHeight={280}
            onSelect={handleSelect}
            scrollRef={scrollRef}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-[12px] font-semibold text-rose-500 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200"
          >
            <span
              className="size-3.5 rounded-full border border-rose-500 flex items-center justify-center shrink-0 text-[9px] font-black"
              aria-hidden="true"
            >
              !
            </span>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── FILTER VARIANT — compact trigger + popover ────────────────────────────

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest mb-1.5 ml-0.5">
          {label}
          {required && (
            <span className="text-rose-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex items-center justify-between gap-2 h-9 pl-3 pr-2.5 rounded-xl border w-full",
          "text-sm font-semibold transition-all duration-200 select-none whitespace-nowrap",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          "bg-card hover:bg-muted/45",
          isOpen
            ? "border-primary/50 ring-1 ring-primary/22 text-primary"
            : value
              ? "border-primary/30 text-primary bg-primary/[0.05] hover:bg-primary/[0.08]"
              : "border-border/60 text-foreground/75 hover:text-foreground hover:border-border",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          error && "border-rose-500/50",
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Calendar
            className={cn(
              "size-3.5 shrink-0 transition-colors",
              value ? "text-primary" : "text-muted-foreground/55",
            )}
            aria-hidden="true"
          />
          <span className="truncate">
            {value ? `Year ${value}` : placeholder}
          </span>
        </span>

        <span className="flex items-center shrink-0 ml-1">
          {value ? (
            <span
              role="button"
              aria-label="Clear year"
              onClick={handleClear}
              className="flex items-center justify-center size-5 rounded-full text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-150 cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </span>
          ) : (
            <ChevronDown
              className={cn(
                "size-3.5 text-muted-foreground/45 transition-transform duration-200",
                isOpen && "rotate-180 text-primary",
              )}
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          aria-label="Select release year"
          className={cn(
            "absolute z-50 top-full left-0 mt-1.5 w-56 rounded-2xl",
            "bg-popover border border-border/60 shadow-xl shadow-black/10 overflow-hidden",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          {/* Popover header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/18">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {value ? `Selected: ${value}` : "Choose year"}
            </span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-muted-foreground/55 hover:text-rose-500 transition-colors flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/40"
              >
                <X className="size-2.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>

          <YearGrid
            decades={decades}
            value={value}
            disabled={disabled}
            maxHeight={260}
            onSelect={handleSelect}
            scrollRef={scrollRef}
          />

          {/* Footer */}
          <div className="border-t border-border/40 px-3 py-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-primary hover:text-primary/75 px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-[12px] font-semibold text-rose-500 flex items-center gap-1.5 mt-1.5 animate-in slide-in-from-top-1 duration-200"
        >
          <span
            className="size-3.5 rounded-full border border-rose-500 flex items-center justify-center shrink-0 text-[9px] font-black"
            aria-hidden="true"
          >
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
};

export default YearPicker;
