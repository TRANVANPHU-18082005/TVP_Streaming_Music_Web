import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// STABLE ANIMATION OBJECTS — matches MiniPlayer entrance animation
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_ANIMATE = { y: 0, opacity: 1 };
const PLAYER_INITIAL = { y: 120, opacity: 0 };
const PLAYER_TRANSITION = {
  type: "spring",
  stiffness: 340,
  damping: 30,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER PULSE — shared pulse animation class via Tailwind
// Using the same "animate-pulse" but with a slight stagger via delay utilities
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerProps {
  className?: string;
  style?: React.CSSProperties;
}

const Shimmer = memo(({ className, style }: ShimmerProps) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-foreground/[0.08]",
      className,
    )}
    style={style}
    aria-hidden="true"
  />
));
Shimmer.displayName = "Shimmer";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP TOP PROGRESS LINE — mirrors DesktopProgressLine
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonProgressLine = memo(() => (
  <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-10">
    <div className="absolute inset-0 bg-foreground/[0.06]" />
    {/* Indeterminate shimmer sweep */}
    <div
      className="absolute left-0 top-0 h-full w-1/3 bg-primary/30"
      style={{
        animation: "skeleton-sweep 1.6s ease-in-out infinite",
      }}
    />
  </div>
));
SkeletonProgressLine.displayName = "SkeletonProgressLine";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE PROGRESS BAR SKELETON — mirrors MobileProgressBar bottom strip
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonMobileProgressBar = memo(() => (
  <div className="absolute bottom-1 left-3 right-3 h-[2.5px] rounded-full overflow-hidden">
    <div className="absolute inset-0 bg-foreground/[0.08]" />
    <div
      className="absolute left-0 top-0 h-full w-1/3 bg-primary/30"
      style={{
        animation: "skeleton-sweep 1.6s ease-in-out infinite",
      }}
    />
  </div>
));
SkeletonMobileProgressBar.displayName = "SkeletonMobileProgressBar";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL ARTWORK SKELETON — mirrors VinylArtwork (40px default)
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonVinylProps {
  size?: number;
}

const SkeletonVinyl = memo(({ size = 40 }: SkeletonVinylProps) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    {/* Pulsing ring placeholder */}
    <div
      className="absolute rounded-full border border-foreground/[0.08] animate-pulse"
      style={{ inset: -3 }}
      aria-hidden="true"
    />
    {/* Disc placeholder */}
    <div
      className="rounded-full bg-foreground/[0.08] animate-pulse border border-black/10 dark:border-white/10"
      style={{ width: size, height: size }}
    />
  </div>
));
SkeletonVinyl.displayName = "SkeletonVinyl";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO SKELETON — mirrors TrackInfo left section
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonTrackInfo = memo(() => (
  <div className="flex items-center gap-2.5 flex-1 md:w-[32%] md:flex-none min-w-0">
    <SkeletonVinyl size={40} />
    <div className="min-w-0 flex flex-col gap-1.5 flex-1">
      {/* Title line */}
      <Shimmer className="h-3.5 w-28 max-w-[70%]" />
      {/* Artist line */}
      <Shimmer className="h-2.5 w-20 max-w-[50%]" style={{ animationDelay: "80ms" }} />
    </div>
  </div>
));
SkeletonTrackInfo.displayName = "SkeletonTrackInfo";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP CENTER SKELETON — mirrors DesktopCenter controls + scrubber
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonDesktopCenter = memo(() => (
  <div className="hidden md:flex flex-col items-center justify-center flex-1 gap-1.5">
    {/* Transport controls row */}
    <div className="flex items-center gap-3">
      {/* Shuffle */}
      <Shimmer className="h-4 w-4 rounded-full" style={{ animationDelay: "40ms" }} />
      {/* Prev */}
      <Shimmer className="h-7 w-7 rounded-full" style={{ animationDelay: "60ms" }} />
      {/* Play/pause — larger */}
      <Shimmer className="h-9 w-9 rounded-full" style={{ animationDelay: "0ms" }} />
      {/* Next */}
      <Shimmer className="h-7 w-7 rounded-full" style={{ animationDelay: "60ms" }} />
      {/* Repeat */}
      <Shimmer className="h-4 w-4 rounded-full" style={{ animationDelay: "40ms" }} />
    </div>

    {/* Progress bar row */}
    <div className="w-full max-w-[480px] flex items-center gap-2.5">
      {/* Current time */}
      <Shimmer className="h-2.5 w-9 rounded" style={{ animationDelay: "120ms" }} />
      {/* Track */}
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-foreground/[0.08]">
        <div
          className="h-full w-1/4 bg-primary/25 animate-pulse rounded-full"
          style={{ animationDelay: "100ms" }}
        />
      </div>
      {/* Remaining time */}
      <Shimmer className="h-2.5 w-9 rounded" style={{ animationDelay: "120ms" }} />
    </div>
  </div>
));
SkeletonDesktopCenter.displayName = "SkeletonDesktopCenter";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP RIGHT SKELETON — mirrors DesktopRight waveform + volume + buttons
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonDesktopRight = memo(() => (
  <div className="hidden md:flex items-center justify-end md:w-[32%] gap-2">
    {/* Waveform bars placeholder */}
    <div className="flex items-end gap-px h-4" aria-hidden="true">
      {[3, 5, 7, 5, 3, 6, 4].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm bg-foreground/[0.10] animate-pulse"
          style={{
            height: `${h * 2}px`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>

    {/* Volume control */}
    <div className="flex items-center gap-1.5 w-24">
      <Shimmer className="h-3.5 w-3.5 rounded-full" style={{ animationDelay: "80ms" }} />
      <div className="flex-1 h-1 rounded-full overflow-hidden bg-foreground/[0.08]">
        <Shimmer className="h-full w-2/3 rounded-full" style={{ animationDelay: "100ms" }} />
      </div>
    </div>

    {/* Divider */}
    <div className="h-5 w-px mx-0.5 bg-border" aria-hidden="true" />

    {/* Expand button */}
    <Shimmer className="h-8 w-8 rounded-full" style={{ animationDelay: "60ms" }} />
    {/* Stop button */}
    <Shimmer className="h-8 w-8 rounded-full" style={{ animationDelay: "80ms" }} />
  </div>
));
SkeletonDesktopRight.displayName = "SkeletonDesktopRight";

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CONTROLS SKELETON — mirrors mobile PlayerControls + stop button
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonMobileControls = memo(() => (
  <>
    {/* Transport */}
    <div className="flex md:hidden items-center gap-2 shrink-0">
      <Shimmer className="h-8 w-8 rounded-full" style={{ animationDelay: "40ms" }} />
      <Shimmer className="h-9 w-9 rounded-full" />
      <Shimmer className="h-8 w-8 rounded-full" style={{ animationDelay: "40ms" }} />
    </div>
    {/* Stop / like */}
    <div className="md:hidden flex items-center gap-1 shrink-0">
      <Shimmer className="h-7 w-7 rounded-full" style={{ animationDelay: "80ms" }} />
    </div>
  </>
));
SkeletonMobileControls.displayName = "SkeletonMobileControls";

// ─────────────────────────────────────────────────────────────────────────────
// MINI PLAYER SKELETON — public export
// Drop-in replacement for MiniPlayer while isLoading === true
// ─────────────────────────────────────────────────────────────────────────────

export interface MiniPlayerSkeletonProps {
  /** When false, component renders nothing — lets parent toggle with AnimatePresence */
  visible?: boolean;
  /** Callback function to handle expand action */
  onExpand?: () => void;
}

export const MiniPlayerSkeleton = memo(
  ({ visible = true, onExpand }: MiniPlayerSkeletonProps) => {
    if (!visible) return null;

    return (
      <>
        {/* Keyframe for the indeterminate sweep on progress lines */}
        <style>{`
          @keyframes skeleton-sweep {
            0%   { transform: translateX(-100%); }
            60%  { transform: translateX(400%); }
            100% { transform: translateX(400%); }
          }
        `}</style>

        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:pointer-events-auto"
          role="status"
          aria-label="Đang tải trình phát nhạc"
          aria-busy="true"
          onClick={onExpand}
        >
          <motion.div
            initial={PLAYER_INITIAL}
            animate={PLAYER_ANIMATE}
            transition={PLAYER_TRANSITION}
            className={cn(
              "pointer-events-auto relative overflow-hidden select-none",
              // Mobile: floating glass capsule
              "w-[calc(100%-1.25rem)] mb-3 h-[72px] rounded-2xl",
              "shadow-brand glass-heavy",
              // Desktop: full-width player bar
              "md:w-full md:mb-0 md:h-[76px] md:rounded-none md:player-bar",
            )}
          >
            {/* Desktop: top indeterminate progress sweep */}
            <div className="hidden md:block">
              <SkeletonProgressLine />
            </div>

            {/* Mobile: bottom indeterminate bar */}
            <div className="md:hidden">
              <SkeletonMobileProgressBar />
            </div>

            {/* Desktop: ambient glow (kept for visual parity) */}
            <div
              className="hidden dark:md:block absolute left-0 top-0 bottom-0 w-48 pointer-events-none z-0"
              style={{
                background:
                  "radial-gradient(ellipse at left center, hsl(var(--primary) / 0.04) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />

            {/* ── MAIN CONTENT ROW ── */}
            <div className="relative z-10 h-full px-3 md:px-6 pt-2 pb-2 flex items-center gap-2 md:gap-0">
              {/* LEFT — artwork + track info */}
              <SkeletonTrackInfo />

              {/* CENTER (desktop) — transport + scrubber */}
              <SkeletonDesktopCenter />

              {/* CENTER + RIGHT (mobile) — transport + stop */}
              <SkeletonMobileControls />

              {/* RIGHT (desktop) — waveform + volume + expand + stop */}
              <SkeletonDesktopRight />
            </div>
          </motion.div>
        </div>
      </>
    );
  },
);

MiniPlayerSkeleton.displayName = "MiniPlayerSkeleton";
export default MiniPlayerSkeleton;