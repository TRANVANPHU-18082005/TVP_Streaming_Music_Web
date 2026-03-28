// ═════════════════════════════════════════════════════════════════════════════
// FILTER DROPDOWN
// ═════════════════════════════════════════════════════════════════════════════
/**
 * FilterDropdown.tsx — Popover wrapper for filter selectors
 *
 * IMPROVEMENTS
 *   • `onClear` button: changed from `<div role="button">` to a proper
 *     `<button type="button">` — fixes the interactive element role violation.
 *
 *   • `ChevronDown` rotation: `group-data-[state=open]:rotate-180` relies on
 *     the Radix `data-state` attribute being present on a parent with `group`
 *     class. Radix `PopoverTrigger` does set `data-state`, but the `group`
 *     class must be on the trigger itself — moved to the trigger wrapper.
 *
 *   • `PopoverContent`: `z-[100]` preserved. Added `onOpenAutoFocus` to prevent
 *     Radix's default focus-trap from moving focus to the popover container
 *     (we want focus to go to the search input inside, not the container).
 */

import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterDropdownProps {
  label: React.ReactNode;
  isActive: boolean;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
}

export const FilterDropdown = ({
  label,
  isActive,
  onClear,
  children,
  className,
  contentClassName,
  align = "start",
}: FilterDropdownProps) => (
  <Popover>
    {/*
     * `group` on the trigger enables `group-data-[state=open]` for ChevronDown.
     * Radix sets `data-state="open"` on the trigger when the popover is open.
     */}
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "group h-10 px-3.5 rounded-xl border-input bg-background shadow-sm",
          "transition-all duration-200",
          "hover:bg-accent/50 hover:text-accent-foreground hover:border-accent-foreground/25",
          "data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/12",
          isActive && [
            "bg-primary/10 border-primary/30 text-primary",
            "hover:bg-primary/18 hover:border-primary/45",
            "font-semibold",
          ],
          className,
        )}
      >
        <div className="flex items-center gap-2 max-w-[200px]">
          {/* Label */}
          <span
            className={cn(
              "truncate text-sm tracking-tight transition-colors",
              isActive
                ? "text-primary font-bold"
                : "text-foreground font-medium",
            )}
          >
            {label}
          </span>

          {/* Action icons */}
          <div className="flex items-center shrink-0">
            {isActive && onClear ? (
              /*
               * FIX: original used `<div role="button">` — invalid HTML.
               * Must be `<button>` for keyboard access and ARIA compliance.
               */
              <button
                type="button"
                tabIndex={0}
                aria-label="Clear filter"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="ml-1 p-0.5 rounded-full text-primary hover:bg-primary/18 hover:text-destructive transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
              >
                <X className="size-3.5 stroke-[2.5]" aria-hidden="true" />
              </button>
            ) : (
              /*
               * `group-data-[state=open]:rotate-180` works because Radix sets
               * `data-state="open"` on the trigger (which has `group` class).
               */
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200 ease-out",
                  "group-data-[state=open]:rotate-180",
                  isActive ? "text-primary" : "text-muted-foreground/65",
                )}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      align={align}
      sideOffset={8}
      /*
       * `onOpenAutoFocus`: prevent Radix from moving focus to the popover
       * container — the search input inside should handle its own focus.
       */
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "z-[100] p-1.5 overflow-hidden rounded-xl",
        "border border-border bg-popover shadow-lg",
        "animate-in fade-in zoom-in-95 duration-150",
        "w-auto min-w-[240px] max-w-[95vw]",
        contentClassName,
      )}
    >
      <div className="flex flex-col max-h-[400px]">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-0.5">
          {children}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

export default FilterDropdown;
