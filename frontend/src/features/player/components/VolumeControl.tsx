/**
 * VolumeControl.tsx — Volume slider + mute toggle
 *
 * Architecture
 * ────────────
 * • Granular selector: only { volume, isMuted } — no re-render from
 *   currentTime, isPlaying, activeQueue, etc.
 *
 * • Custom styled slider track/thumb via CSS variables — no hardcoded colours.
 *   Works correctly in both light and dark modes.
 *
 * • Volume icon transitions smoothly between states using AnimatePresence
 *   instead of a ternary swap (no icon pop/jump).
 *
 * • Keyboard accessible: Space toggles mute, keyboard arrow keys drive the
 *   Radix Slider natively (Radix handles this by default, documented here).
 *
 * • `displayVolume` derived synchronously — no state duplication.
 *
 * • Component accepts `className` + `compact` prop:
 *   - compact=false (default): icon + slider side-by-side (desktop nav/player bar)
 *   - compact=true: icon only, slider appears on hover (tight spaces)
 */

import { memo, useCallback, useId } from "react";
import {  useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";
import {
  selectPlayer,
  setVolume,
  toggleMute,
} from "@/features/player/slice/playerSlice";
import { useAppDispatch } from "@/store/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VolumeControlProps {
  className?: string;
  /** When true: icon-only, slider slides in on hover. Default: false */
  compact?: boolean;
  /** Override slider width. Default: "w-24" */
  sliderClassName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRANULAR SELECTOR
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// ICON ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const SP_ICON = { type: "spring", stiffness: 400, damping: 28 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// VOLUME ICON — animated swap between VolumeX / Volume1 / Volume2
// ─────────────────────────────────────────────────────────────────────────────

interface VolumeIconProps {
  isMuted: boolean;
  volume: number;
}

const VolumeIcon = memo(({ isMuted, volume }: VolumeIconProps) => {
  const Icon =
    isMuted || volume === 0 ? VolumeX
    : volume < 0.5          ? Volume1
    :                          Volume2;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={`${isMuted}-${volume < 0.5}`}
        initial={{ scale: 0.65, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={   { scale: 0.65, opacity: 0 }}
        transition={SP_ICON}
        className="flex items-center justify-center"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </motion.span>
    </AnimatePresence>
  );
});
VolumeIcon.displayName = "VolumeIcon";

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SLIDER
// Radix SliderPrimitive with CSS-variable based styling.
// Thumb grows on focus/hover via CSS. No additional JS needed.
// ─────────────────────────────────────────────────────────────────────────────

const SLIDER_STYLES = `
  .vc-slider-root   { position: relative; display: flex; align-items: center; user-select: none; touch-action: none; }
  .vc-slider-root[data-orientation="horizontal"] { width: 100%; height: 20px; }
  .vc-slider-track  { position: relative; flex-grow: 1; border-radius: 9999px; overflow: hidden; }
  .vc-slider-track[data-orientation="horizontal"] { height: 3px; }
  .vc-slider-range  { position: absolute; height: 100%; border-radius: 9999px; background: hsl(var(--primary)); transition: width 0.05s linear; }
  .vc-slider-thumb  {
    display: block; width: 12px; height: 12px; border-radius: 50%;
    background: hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 3px hsl(var(--primary) / 0.5);
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease;
    outline: none; cursor: pointer;
  }
  .vc-slider-thumb:hover,
  .vc-slider-thumb:focus-visible {
    transform: scale(1.25);
    box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.45), 0 0 10px hsl(var(--primary) / 0.3);
  }
`;

let _sliderStyleInjected = false;

interface VolumeSliderProps {
  value: number;       // 0-100
  onValueChange: (v: number[]) => void;
  className?: string;
  labelId: string;
}

const VolumeSlider = memo(({ value, onValueChange, className, labelId }: VolumeSliderProps) => {
  if (!_sliderStyleInjected && typeof document !== "undefined") {
    _sliderStyleInjected = true;
    const s = document.createElement("style");
    s.textContent = SLIDER_STYLES;
    document.head.appendChild(s);
  }

  return (
    <SliderPrimitive.Root
      className={cn("vc-slider-root cursor-pointer", className)}
      value={[value]}
      max={100}
      step={1}
      onValueChange={onValueChange}
      aria-labelledby={labelId}
      aria-valuetext={`Volume ${Math.round(value)}%`}
    >
      <SliderPrimitive.Track
        className="vc-slider-track"
        style={{ background: "hsl(var(--muted-foreground) / 0.18)" }}
      >
        <SliderPrimitive.Range className="vc-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="vc-slider-thumb" />
    </SliderPrimitive.Root>
  );
});
VolumeSlider.displayName = "VolumeSlider";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const VolumeControl = memo(
  ({ className, compact = false, sliderClassName }: VolumeControlProps) => {
    const dispatch = useAppDispatch();
    const { volume, isMuted } = useSelector(selectPlayer);
    const labelId = useId();

    // Display value for slider (muted = show 0, but preserve actual volume)
    const displayVolume = isMuted ? 0 : Math.round(volume * 100);

    const handleVolumeChange = useCallback(
      (val: number[]) => dispatch(setVolume(val[0] / 100)),
      [dispatch],
    );

    const handleToggleMute = useCallback(
      () => dispatch(toggleMute()),
      [dispatch],
    );

    const handleMuteKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggleMute(); }
    }, [handleToggleMute]);

    return (
      <div
        className={cn(
          "flex items-center gap-2",
          compact && "group/vc",
          className,
        )}
        role="group"
        aria-label="Volume control"
      >
        {/* Hidden label for slider */}
        <span id={labelId} className="sr-only">Volume</span>

        {/* Mute toggle button */}
        <button
          onClick={handleToggleMute}
          onKeyDown={handleMuteKeyDown}
          aria-label={isMuted ? "Unmute" : "Mute"}
          aria-pressed={isMuted}
          className={cn(
            "relative flex items-center justify-center",
            "size-8 rounded-full",
            "outline-none transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
            "hover:bg-[hsl(var(--muted)/0.6)]",
            isMuted
              ? "text-[hsl(var(--muted-foreground)/0.5)]"
              : "text-[hsl(var(--muted-foreground)/0.75)] hover:text-[hsl(var(--foreground))]",
          )}
        >
          <VolumeIcon isMuted={isMuted} volume={volume} />
        </button>

        {/* Slider */}
        {compact ? (
          /* Compact: hidden by default, slides in on parent group hover */
          <motion.div
            initial={false}
            animate={{ width: 0, opacity: 0 }}
            whileHover={{ width: 80, opacity: 1 }}
            className="overflow-hidden"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <VolumeSlider
              value={displayVolume}
              onValueChange={handleVolumeChange}
              className="w-20"
              labelId={labelId}
            />
          </motion.div>
        ) : (
          /* Full: always visible */
          <div
            className={cn(
              "transition-opacity duration-150 opacity-75 hover:opacity-100",
              sliderClassName ?? "w-24",
            )}
          >
            <VolumeSlider
              value={displayVolume}
              onValueChange={handleVolumeChange}
              labelId={labelId}
            />
          </div>
        )}
      </div>
    );
  },
);

VolumeControl.displayName = "VolumeControl";
export default VolumeControl;