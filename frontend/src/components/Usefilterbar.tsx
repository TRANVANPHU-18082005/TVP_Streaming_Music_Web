/**
 * useFilterBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared primitives used by every public filter bar in the music streaming app.
 *
 * Exports:
 *   PILL_BASE / PILL_IDLE / PILL_ACTIVE / PILL_INVERSE / PILL_ROSE
 *   SEARCH_INPUT
 *   useDragScroll()
 *   ScrollFades
 *   FilterRow        ← draggable pills container, just wrap your pills in it
 *   SearchBox        ← reusable search input with icon + clear
 *   FilterShell      ← outermost layout (search + pills, responsive 2→1 row)
 */

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// Style tokens
// ─────────────────────────────────────────────────────────────────────────────

export const PILL_BASE = [
  "inline-flex items-center gap-1.5",
  "h-9 rounded-full px-4",
  "text-[13px] font-semibold whitespace-nowrap select-none",
  "border shadow-sm",
  "transition-all duration-200",
  "shrink-0 cursor-pointer",
  "focus:ring-0 focus:ring-offset-0 focus-visible:outline-none",
].join(" ");

/** Default / unselected */
export const PILL_IDLE =
  "bg-card border-border/55 text-foreground/72 hover:bg-accent hover:border-border/80 hover:text-foreground";

/** Active — primary violet tint */
export const PILL_ACTIVE =
  "bg-primary/10 border-primary/28 text-primary hover:bg-primary/15";

/** Active — inverse contrast (Spotify-style: black on white / white on black) */
export const PILL_INVERSE =
  "bg-foreground text-background border-transparent hover:bg-foreground/85";

/** Active — rose/trending */
export const PILL_ROSE =
  "bg-rose-500 text-white border-transparent hover:bg-rose-600";

/** Shared Input className for all search boxes */
export const SEARCH_INPUT = cn(
  "pl-10 pr-9 h-10 rounded-full",
  "text-[13.5px] font-medium",
  "bg-background border-border/60 shadow-sm",
  "placeholder:text-muted-foreground/50 placeholder:font-normal",
  "hover:border-border/80",
  "focus-visible:ring-2 focus-visible:ring-primary/12 focus-visible:border-primary focus-visible:bg-background",
  "transition-all duration-200",
);

// ─────────────────────────────────────────────────────────────────────────────
// useDragScroll
// ─────────────────────────────────────────────────────────────────────────────

export interface DragScrollHandlers {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export function useDragScroll(): DragScrollHandlers {
  const ref = useRef<HTMLDivElement | null>(null);
  const active = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const savedLeft = useRef(0);
  const prevX = useRef(0);
  const vel = useRef(0);
  const raf = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!ref.current) return;
    active.current = true;
    didDrag.current = false;
    startX.current = e.clientX;
    prevX.current = e.clientX;
    savedLeft.current = ref.current.scrollLeft;
    vel.current = 0;
    if (raf.current) cancelAnimationFrame(raf.current);
    ref.current.setPointerCapture(e.pointerId);
    ref.current.style.cursor = "grabbing";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!active.current || !ref.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) didDrag.current = true;
    vel.current = e.clientX - prevX.current;
    prevX.current = e.clientX;
    ref.current.scrollLeft = savedLeft.current - dx;
  }, []);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (!ref.current) return;
    active.current = false;
    ref.current.style.cursor = "grab";
    let v = vel.current * 1.55;
    const step = () => {
      if (!ref.current || Math.abs(v) < 0.4) return;
      ref.current.scrollLeft -= v;
      v *= 0.88;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) {
      e.stopPropagation();
      didDrag.current = false;
    }
  }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp, onClick };
}

// ─────────────────────────────────────────────────────────────────────────────
// ScrollFades
// ─────────────────────────────────────────────────────────────────────────────

export function ScrollFades({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setLeft(scrollLeft > 4);
      setRight(scrollLeft < scrollWidth - clientWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [containerRef]);

  return (
    <>
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 bg-gradient-to-r from-background to-transparent"
        style={{ opacity: left ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none z-10 transition-opacity duration-200 bg-gradient-to-l from-background to-transparent"
        style={{ opacity: right ? 1 : 0 }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterRow — the draggable pills track
// ─────────────────────────────────────────────────────────────────────────────

export function FilterRow({ children }: { children: ReactNode }) {
  const drag = useDragScroll();
  return (
    <div className="relative flex-1 min-w-0 border-t border-border/20 sm:border-0">
      <ScrollFades containerRef={drag.ref} />
      <div
        ref={drag.ref}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
        onClick={drag.onClick}
        className="flex items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing touch-pan-x"
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
        {children}
        <div className="w-3 shrink-0" aria-hidden />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchBox
// ─────────────────────────────────────────────────────────────────────────────

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Tailwind max-width on sm+ e.g. "sm:max-w-[340px] lg:max-w-[400px]" */
  maxWidth?: string;
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  maxWidth = "sm:max-w-[340px] lg:max-w-[400px]",
}: SearchBoxProps) {
  return (
    <div className={cn("relative w-full shrink-0 group", maxWidth)}>
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-muted-foreground/60 transition-colors duration-150 group-focus-within:text-primary">
        <Search className="size-4" />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        className={SEARCH_INPUT}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-all"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterShell — outermost responsive layout
// ─────────────────────────────────────────────────────────────────────────────

interface FilterShellProps {
  search: ReactNode; // pass <SearchBox … />
  pills: ReactNode; // pass your pill elements (NOT wrapped in FilterRow)
  className?: string;
}

/**
 * Mobile:   search full-width on row1 | pills scrollable on row2
 * sm+:      search + divider + pills all on one row
 */
export function FilterShell({ search, pills, className }: FilterShellProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
        {/* Search — padded on mobile, flush on sm+ */}
        <div className="px-3 pt-3 pb-1 sm:p-0 w-full sm:w-auto sm:shrink-0">
          {search}
        </div>
        {/* Vertical divider — desktop only */}
        <div className="hidden lg:block w-px h-6 bg-border/50 shrink-0" />
        {/* Draggable pill track */}
        <FilterRow>{pills}</FilterRow>
      </div>
    </div>
  );
}
