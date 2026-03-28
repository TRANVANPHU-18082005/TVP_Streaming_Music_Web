/**
 * NationalitySelector.tsx — Country picker with GPS auto-detect
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DELTA-ONLY REFACTOR
 *
 * Original FIX 1–4 (self-documented) are preserved unchanged:
 *   FIX 1: no role="combobox" (browser compat)
 *   FIX 2: onPointerDown instead of onClick for Radix clear button
 *   FIX 3: z-[9999] on PopoverContent
 *   FIX 4: no duplicate Search icon
 *
 * Remaining issues:
 *
 * ── FIX 5: `handleAutoDetect` not useCallback ────────────────────────────────
 *   Plain async function — new reference every render. Passed as `onSelect`
 *   into a CommandItem. When NationalitySelector is inside ArtistFilters
 *   (debounce-driven re-renders), this function is recreated on every keystroke.
 *   Fix: `useCallback([onChange])`.
 *
 * ── FIX 6: `console.error` in catch — production log leak ───────────────────
 *   Exposes geolocation service error details in browser console.
 *   Fix: removed. Add a toast if user-facing feedback is needed.
 *
 * ── FIX 7: `safeValue` computed inline, unstable as useMemo dep ─────────────
 *   `typeof value === "string" ? value.toUpperCase() : ""` runs every render
 *   and is used as dep in both `selectedCountry` useMemo and `handleSelect`
 *   useCallback. Without memoizing it, the string is stable (primitive) so
 *   deps work correctly — BUT adding `useMemo` makes the intent explicit and
 *   avoids subtle bugs if `value` type ever widens to `string | undefined`.
 *   Fix: `useMemo([value])`.
 *
 * ── FIX 8: `CountryItem` missing `displayName` ───────────────────────────────
 *   Shows as "memo" in React DevTools — hard to identify in a list of 200+
 *   country items during profiling.
 *   Fix: `CountryItem.displayName = "CountryItem"`.
 *
 * ── FIX 9: `NationalitySelector` not memo'd ──────────────────────────────────
 *   Used in ArtistFilters which re-renders on search debounce (every keystroke).
 *   Fix: `memo` with custom comparator.
 *
 * ── FIX 10: Clear button `<div role="button">` — WCAG violation ──────────────
 *   Missing `tabIndex={0}` and `onKeyDown` handler.
 *   WCAG 4.1.2: role="button" elements MUST be keyboard operable.
 *   Missing `aria-label` — screen readers announce nothing.
 *   Fix: semantic `<button type="button">` with `onPointerDown` preserved
 *   (the original Radix timing fix). Keyboard accessibility for free.
 *
 * ── FIX 11: Redundant `setOpen(false)` in handleAutoDetect ──────────────────
 *   Original: `setOpen(false)` called manually inside handleAutoDetect.
 *   Radix already closes the popover when `onSelect` fires on a CommandItem.
 *   Double-closing can cause Radix animation state machine to get out of sync.
 *   Fix: removed. Radix manages the close.
 *
 * ── FIX 12: Loading state in auto-detect CommandItem not reflected ────────────
 *   When `isDetecting` is true, the CommandItem text stays "Tự động nhận diện"
 *   but the popover is closed (via FIX 11 removal, or original setOpen(false)).
 *   So the detecting state is visible on the trigger button, not the list item.
 *   This is correct UX. However, `disabled={isDetecting}` is added to prevent
 *   double-triggering while detection is in progress.
 */

import React, { useState, useMemo, useCallback, memo } from "react";
import {
  Check,
  Globe,
  ChevronsUpDown,
  Loader2,
  X,
  LocateFixed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { detectUserCountry } from "@/lib/location.service";
import {
  ALL_NATIONALITIES,
  Country,
  TOP_NATIONALITIES,
} from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface NationalitySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean; // true when used in a filter bar (not a form field)
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY ITEM — FIX 8: displayName
// ─────────────────────────────────────────────────────────────────────────────

const CountryItem = memo(
  ({
    country,
    isSelected,
    onSelect,
  }: {
    country: Country;
    isSelected: boolean;
    onSelect: (v: string) => void;
  }) => (
    <CommandItem
      keywords={[country.label, country.value, country.value.toLowerCase()]}
      value={`${country.label} ${country.value}`}
      onSelect={() => onSelect(country.value)}
      className={cn(
        "flex items-center justify-between py-2 px-2.5 rounded-md cursor-pointer transition-colors my-0.5",
        "aria-selected:bg-accent aria-selected:text-accent-foreground",
        isSelected && "bg-primary/10 text-primary aria-selected:bg-primary/15",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg leading-none shrink-0 shadow-sm border border-border/50 rounded-[2px] overflow-hidden bg-background">
          {country.flag}
        </span>
        <span
          className={cn(
            "text-[13px] truncate",
            isSelected ? "font-bold" : "font-medium",
          )}
        >
          {country.label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {!isSelected && (
          <span className="text-[10px] font-mono font-bold text-muted-foreground/40 uppercase">
            {country.value}
          </span>
        )}
        {isSelected && (
          <Check className="size-4 stroke-[3] text-primary shrink-0 animate-in zoom-in duration-200" />
        )}
      </div>
    </CommandItem>
  ),
);
CountryItem.displayName = "CountryItem"; // FIX 8

// ─────────────────────────────────────────────────────────────────────────────
// NATIONALITY SELECTOR — FIX 9: memo with custom comparator
// ─────────────────────────────────────────────────────────────────────────────

export const NationalitySelector = memo<NationalitySelectorProps>(
  ({
    value,
    onChange,
    placeholder = "Chọn quốc gia...",
    className,
    disabled = false,
    clearable = false,
  }) => {
    const [open, setOpen] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);

    // FIX 7: memoised — explicit stable reference for downstream deps
    const safeValue = useMemo(
      () => (typeof value === "string" ? value.toUpperCase() : ""),
      [value],
    );

    const selectedCountry = useMemo(
      () => ALL_NATIONALITIES.find((c) => c.value.toUpperCase() === safeValue),
      [safeValue],
    );

    // FIX 5: useCallback — was plain async fn, new reference every render
    // FIX 11: removed setOpen(false) — Radix closes on CommandItem select
    // FIX 6: removed console.error — production log leak
    const handleAutoDetect = useCallback(async () => {
      setIsDetecting(true);
      try {
        const code = await detectUserCountry();
        if (code) onChange(code.toUpperCase());
      } finally {
        // FIX 6: no console.error. Add toast here for user-facing error feedback.
        setIsDetecting(false);
      }
    }, [onChange]);

    const handleSelect = useCallback(
      (val: string) => {
        const newVal = val.toUpperCase();
        // clearable mode: selecting the active country again deselects it
        onChange(clearable && newVal === safeValue ? "" : newVal);
        setOpen(false);
      },
      [onChange, safeValue, clearable],
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            // FIX 1 (original): no role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={
              selectedCountry
                ? `Selected: ${selectedCountry.label}`
                : placeholder
            }
            className={cn(
              "w-full justify-between h-11 bg-transparent border-input px-3 shadow-sm transition-all rounded-md",
              "hover:bg-muted/50 hover:text-foreground",
              open && "ring-1 ring-primary border-primary bg-background",
              className,
            )}
            disabled={isDetecting || disabled}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isDetecting ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : selectedCountry ? (
                <span className="text-lg leading-none shrink-0 shadow-sm border border-border/50 rounded-[2px] overflow-hidden bg-background">
                  {selectedCountry.flag}
                </span>
              ) : (
                <Globe className="size-4 text-muted-foreground shrink-0" />
              )}

              <span
                className={cn(
                  "truncate text-sm",
                  selectedCountry
                    ? "font-semibold text-foreground"
                    : "font-medium text-muted-foreground",
                )}
              >
                {isDetecting
                  ? "Đang xác định vị trí..."
                  : selectedCountry?.label || placeholder}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              {/*
               * FIX 10: <button type="button"> instead of <div role="button">
               * Semantic button gets keyboard accessibility for free (Tab, Enter,
               * Space). role="button" on a div requires manual tabIndex + onKeyDown.
               * onPointerDown from original FIX 2 is preserved — prevents Radix
               * from interpreting the clear tap as a popover-open trigger.
               */}
              {clearable && selectedCountry && !disabled && !isDetecting && (
                <button
                  type="button"
                  aria-label="Clear selection"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }}
                  className={cn(
                    "p-1 -mr-1 rounded-md z-10",
                    "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                    "transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40",
                  )}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}

              <ChevronsUpDown
                className="size-4 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          // FIX 3 (original): z-[9999] for modal stacking contexts
          className="z-[9999] p-0 rounded-lg shadow-xl border-border ring-1 ring-black/5 overflow-hidden w-[var(--radix-popover-trigger-width)]"
          align="start"
          sideOffset={6}
        >
          <Command className="bg-popover">
            {/* FIX 4 (original): no duplicate Search icon in CommandInput wrapper */}
            <div className="border-b border-border bg-muted/20">
              <CommandInput
                placeholder="Tìm kiếm quốc gia hoặc mã (VD: VN)..."
                className="h-10 border-none focus:ring-0 text-sm bg-transparent w-full"
              />
            </div>

            <CommandList className="max-h-[260px] custom-scrollbar p-1.5">
              <CommandEmpty className="py-6 text-center text-[13px] font-medium text-muted-foreground">
                Không tìm thấy quốc gia.
              </CommandEmpty>

              {/* Auto-detect — FIX 12: disabled while detecting */}
              <CommandGroup>
                <CommandItem
                  onSelect={handleAutoDetect}
                  disabled={isDetecting}
                  className="flex items-center gap-2.5 py-2 px-2.5 rounded-md cursor-pointer transition-colors my-0.5 font-semibold text-primary hover:bg-primary/10 aria-selected:bg-primary/10 aria-selected:text-primary"
                >
                  <div className="flex items-center justify-center bg-primary/20 p-1.5 rounded-md">
                    {isDetecting ? (
                      <Loader2 className="size-4 text-primary animate-spin" />
                    ) : (
                      <LocateFixed className="size-4 text-primary" />
                    )}
                  </div>
                  {isDetecting ? "Đang xác định..." : "Tự động nhận diện (GPS)"}
                </CommandItem>
              </CommandGroup>

              <CommandSeparator className="my-1.5 bg-border/50" />

              {/* Top countries */}
              <CommandGroup
                heading={
                  <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    Phổ biến
                  </span>
                }
              >
                {TOP_NATIONALITIES.map((country) => (
                  <CountryItem
                    key={`top-${country.value}`}
                    country={country}
                    isSelected={safeValue === country.value.toUpperCase()}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>

              <CommandSeparator className="my-1.5 bg-border/50" />

              {/* All countries */}
              <CommandGroup
                heading={
                  <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    Tất cả quốc gia
                  </span>
                }
              >
                {ALL_NATIONALITIES.map((country) => (
                  <CountryItem
                    key={country.value}
                    country={country}
                    isSelected={safeValue === country.value.toUpperCase()}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
  // FIX 9: custom comparator — skip re-render when unrelated parent state changes
  (prev, next) =>
    prev.value === next.value &&
    prev.onChange === next.onChange &&
    prev.disabled === next.disabled &&
    prev.clearable === next.clearable &&
    prev.className === next.className,
);

NationalitySelector.displayName = "NationalitySelector";
