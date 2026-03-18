import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface YearPickerProps {
  value?: number;
  onChange: (year?: number) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  /**
   * form   – Inline open panel, always visible (e.g. inside a form drawer/modal)
   * filter – Compact trigger button + popover dropdown (default, for filter bars)
   */
  variant?: "form" | "filter";
  /** Label shown above the picker in form mode */
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Decade grouping helper
// ─────────────────────────────────────────────────────────────

interface DecadeGroup {
  label: string;
  years: number[];
}

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

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

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
  placeholder = "Năm phát hành",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredDecade, setHoveredDecade] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [minYear, maxYear],
  );

  const decades = useMemo(() => groupByDecade(years), [years]);

  // ── Close on outside click
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

  // ── Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Scroll selected year into view when panel opens
  useLayoutEffect(() => {
    if (!isOpen && variant !== "form") return;
    if (!value || !scrollRef.current) return;
    // slight defer so DOM is rendered
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

  // ─────────────────────────────────────────────────────────────
  // Shared year grid panel
  // ─────────────────────────────────────────────────────────────
  const YearPanel = (
    <div
      ref={scrollRef}
      className="overflow-y-auto custom-scrollbar"
      style={{ maxHeight: variant === "form" ? 280 : 260 }}
    >
      <div className="p-2 space-y-3">
        {decades.map(({ label: decadeLabel, years: decadeYears }) => {
          const decadeNum = parseInt(decadeLabel);
          const isHovered = hoveredDecade === decadeNum;
          const hasSelected = decadeYears.includes(value ?? -1);

          return (
            <div
              key={decadeLabel}
              onMouseEnter={() => setHoveredDecade(decadeNum)}
              onMouseLeave={() => setHoveredDecade(null)}
            >
              {/* Decade header */}
              <div
                className={cn(
                  "flex items-center gap-2 px-1.5 mb-1 transition-colors duration-150",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.12em] transition-colors duration-150",
                    hasSelected
                      ? "text-primary"
                      : isHovered
                        ? "text-foreground/60"
                        : "text-muted-foreground/40",
                  )}
                >
                  {decadeLabel}
                </span>
                <div
                  className={cn(
                    "flex-1 h-px transition-colors duration-150",
                    hasSelected ? "bg-primary/20" : "bg-border/40",
                  )}
                />
                {hasSelected && (
                  <span className="text-[9px] font-bold text-primary/70 tracking-wide">
                    ✓
                  </span>
                )}
              </div>

              {/* Year buttons grid */}
              <div className="grid grid-cols-4 gap-1">
                {decadeYears.map((year) => {
                  const isSelected = value === year;
                  const isCurrent = year === new Date().getFullYear();

                  return (
                    <button
                      key={year}
                      data-year={year}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelect(year)}
                      className={cn(
                        "relative h-8 rounded-lg text-[13px] font-semibold transition-all duration-100 select-none",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-105 font-bold"
                          : isCurrent
                            ? "bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15"
                            : "text-foreground/70 hover:bg-muted/60 hover:text-foreground active:scale-95",
                        disabled &&
                          "opacity-40 cursor-not-allowed pointer-events-none",
                      )}
                    >
                      {year}
                      {/* Current year dot */}
                      {isCurrent && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary/50" />
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

  // ─────────────────────────────────────────────────────────────
  // FORM variant — inline panel, always expanded
  // ─────────────────────────────────────────────────────────────
  if (variant === "form") {
    return (
      <div className={cn("w-full flex flex-col gap-2", className)}>
        {label && (
          <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1 ml-0.5">
            {label}
            {required && <span className="text-rose-500">*</span>}
          </label>
        )}

        <div
          className={cn(
            "rounded-2xl bg-card border overflow-hidden transition-all duration-200",
            error
              ? "border-rose-500/50 ring-1 ring-rose-500/20"
              : "border-border/60 shadow-sm",
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                {value ? `Đã chọn: ${value}` : placeholder}
              </span>
            </div>
            {value && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-rose-500 transition-colors px-2 py-0.5 rounded-md hover:bg-rose-500/10"
              >
                <X className="size-3" />
                Xóa
              </button>
            )}
          </div>

          {YearPanel}
        </div>

        {error && (
          <p className="text-[12px] font-semibold text-rose-500 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
            <span className="size-3.5 rounded-full border border-rose-500 flex items-center justify-center shrink-0 text-[9px] font-black">
              !
            </span>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FILTER variant — compact trigger + popover
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold uppercase text-muted-foreground tracking-widest mb-1.5 ml-0.5">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex items-center justify-between gap-2 h-9 pl-3 pr-2.5 rounded-xl border",
          "text-sm font-semibold transition-all duration-200 select-none whitespace-nowrap w-full",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          "bg-card hover:bg-muted/50",
          isOpen
            ? "border-primary/50 ring-1 ring-primary/20 text-primary"
            : value
              ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/8"
              : "border-border/60 text-foreground/80 hover:text-foreground hover:border-border",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          error && "border-rose-500/50",
        )}
      >
        {/* Left: icon + label */}
        <span className="flex items-center gap-1.5 truncate">
          <Calendar
            className={cn(
              "size-3.5 shrink-0 transition-colors",
              value ? "text-primary" : "text-muted-foreground/60",
            )}
          />
          <span className="truncate">
            {value ? `Năm ${value}` : placeholder}
          </span>
        </span>

        {/* Right: clear or chevron */}
        <span className="flex items-center shrink-0 ml-1">
          {value ? (
            <span
              role="button"
              aria-label="Xóa năm"
              onClick={handleClear}
              className={cn(
                "flex items-center justify-center size-5 rounded-full",
                "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-150",
              )}
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown
              className={cn(
                "size-3.5 text-muted-foreground/50 transition-transform duration-200",
                isOpen && "rotate-180 text-primary",
              )}
            />
          )}
        </span>
      </button>

      {/* ── Popover ── */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Chọn năm phát hành"
          className={cn(
            "absolute z-50 mt-1.5 w-56 rounded-2xl",
            "bg-popover border border-border/60 shadow-xl shadow-black/10 overflow-hidden",
            "animate-in fade-in zoom-in-95 duration-150",
          )}
          style={{ top: "100%", left: 0 }}
        >
          {/* Popover header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/20">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {value ? `Đã chọn: ${value}` : "Chọn năm"}
            </span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-rose-500/10"
              >
                <X className="size-2.5" />
                Xóa
              </button>
            )}
          </div>

          {YearPanel}

          {/* Footer */}
          <div className="border-t border-border/40 px-3 py-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-primary hover:text-primary/80 px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors"
            >
              Xong
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[12px] font-semibold text-rose-500 flex items-center gap-1.5 mt-1.5 animate-in slide-in-from-top-1 duration-200">
          <span className="size-3.5 rounded-full border border-rose-500 flex items-center justify-center shrink-0 text-[9px] font-black">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
};

export default YearPicker;
