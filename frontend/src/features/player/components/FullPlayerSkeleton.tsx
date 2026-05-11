import { memo } from "react";
import { motion } from "framer-motion";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// KEYFRAMES — injected once, matches FullPlayer's PLAYER_STYLE_ID pattern
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_STYLE_ID = "__fps-styles__";
const SKELETON_CSS = `
  @keyframes fps-sweep {
    0%   { transform: translateX(-100%); }
    60%  { transform: translateX(350%); }
    100% { transform: translateX(350%); }
  }
  @keyframes fps-slide-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .fps-enter { animation: fps-slide-in 360ms cubic-bezier(0.22,1,0.36,1) both; }

  .fps-shimmer {
    position: relative;
    overflow: hidden;
    background: hsl(var(--foreground) / 0.07);
    border-radius: 6px;
  }
  .fps-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      hsl(var(--foreground) / 0.10) 40%,
      hsl(var(--foreground) / 0.14) 50%,
      hsl(var(--foreground) / 0.10) 60%,
      transparent 100%
    );
    animation: fps-sweep 1.8s ease-in-out infinite;
  }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById(SKELETON_STYLE_ID)
) {
  const s = document.createElement("style");
  s.id = SKELETON_STYLE_ID;
  s.textContent = SKELETON_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE — reusable shimmer block
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerProps {
  className?: string;
  style?: React.CSSProperties;
  rounded?: "sm" | "md" | "lg" | "full";
}

const Shimmer = memo(({ className, style, rounded = "md" }: ShimmerProps) => {
  const radiusMap = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-xl",
    full: "rounded-full",
  };
  return (
    <div
      className={cn("fps-shimmer", radiusMap[rounded], className)}
      style={style}
      aria-hidden="true"
    />
  );
});
Shimmer.displayName = "Shimmer";

// ─────────────────────────────────────────────────────────────────────────────
// HEADER SKELETON — mirrors ViewHeader
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonHeader = memo(() => (
  <header className="flex items-center justify-between px-4 h-16 shrink-0">
    {/* ChevronDown ghost */}
    <div className="flex items-center justify-center size-10 rounded-full text-muted-foreground/20">
      <ChevronDown className="size-7" strokeWidth={2} />
    </div>

    {/* Center: label + dots */}
    <div className="flex flex-col items-center gap-2">
      <Shimmer className="h-2 w-16" style={{ animationDelay: "60ms" }} />
      <div className="flex gap-1.5">
        {[20, 6, 6, 6].map((w, i) => (
          <div
            key={i}
            className="h-[3px] rounded-full fps-shimmer"
            style={{ width: w, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    </div>

    {/* MoreHorizontal ghost */}
    <div className="flex items-center justify-center size-10 rounded-full text-muted-foreground/20">
      <MoreHorizontal className="size-6" strokeWidth={2} />
    </div>
  </header>
));
SkeletonHeader.displayName = "SkeletonHeader";

// ─────────────────────────────────────────────────────────────────────────────
// VINYL SKELETON — mirrors VinylDisk
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonVinylDisk = memo(() => (
  <div className="relative flex items-center justify-center w-full p-8 lg:p-10">
    {/* Outer glow ring ghost */}
    <div
      className="absolute rounded-full border border-primary/10"
      style={{
        width: "calc(min(200px, 100%) + 12px)",
        height: "calc(min(200px, 100%) + 12px)",
      }}
      aria-hidden="true"
    />
    {/* Disc */}
    <Shimmer
      rounded="full"
      className="aspect-square w-full max-w-[200px] lg:max-w-[300px] border-[5px] border-border"
      style={{ animationDelay: "0ms" }}
    />
  </div>
));
SkeletonVinylDisk.displayName = "SkeletonVinylDisk";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO ROW SKELETON — mirrors TrackInfoRow
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonTrackInfoRowProps {
  size?: "sm";
}

const SkeletonTrackInfoRow = memo(({ size }: SkeletonTrackInfoRowProps) => (
  <div className="flex items-center gap-3">
    {size === "sm" ? (
      <Shimmer rounded="lg" className="size-10 shrink-0" />
    ) : (
      /* EyeViewBadge placeholder */
      <Shimmer rounded="lg" className="h-5 w-12" style={{ animationDelay: "40ms" }} />
    )}

    <div className={cn("flex-1 min-w-0", size !== "sm" && "text-center space-y-1.5")}>
      {/* Title */}
      <Shimmer
        className="h-4 mx-auto"
        style={{ width: "55%", animationDelay: "20ms" }}
      />
      {/* Artist */}
      <Shimmer
        className="h-2.5 mx-auto"
        style={{ width: "38%", animationDelay: "60ms" }}
      />
    </div>

    {/* Like button ghost */}
    <Shimmer rounded="full" className="size-6 shrink-0" style={{ animationDelay: "80ms" }} />
  </div>
));
SkeletonTrackInfoRow.displayName = "SkeletonTrackInfoRow";

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR SKELETON — mirrors IsolatedProgress / ProgressBar
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonProgressProps {
  hasLabels?: boolean;
}

const SkeletonProgress = memo(({ hasLabels }: SkeletonProgressProps) => (
  <div className="space-y-1.5">
    {/* Track */}
    <div className="relative h-1.5 rounded-full overflow-hidden fps-shimmer">
      <div
        className="absolute left-0 top-0 h-full w-[28%] bg-primary/25 rounded-full"
        aria-hidden="true"
      />
    </div>
    {/* Time labels */}
    {hasLabels && (
      <div className="flex justify-between">
        <Shimmer className="h-2 w-7" style={{ animationDelay: "100ms" }} />
        <Shimmer className="h-2 w-7" style={{ animationDelay: "100ms" }} />
      </div>
    )}
  </div>
));
SkeletonProgress.displayName = "SkeletonProgress";

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLS ROW SKELETON — mirrors ControlsRow (size lg)
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonControlsRowProps {
  size?: "md" | "lg";
}

const SkeletonControlsRow = memo(({ size = "lg" }: SkeletonControlsRowProps) => {
  const isLg = size === "lg";
  return (
    <div className="flex items-center justify-between w-full">
      {/* Shuffle */}
      <Shimmer rounded="full" className={isLg ? "size-10" : "size-9"} style={{ animationDelay: "40ms" }} />
      {/* Prev */}
      <Shimmer rounded="full" className={isLg ? "size-9" : "size-7"} style={{ animationDelay: "60ms" }} />
      {/* Play — larger */}
      <Shimmer
        rounded="full"
        className={isLg ? "size-[76px]" : "size-16"}
        style={{ animationDelay: "0ms" }}
      />
      {/* Next */}
      <Shimmer rounded="full" className={isLg ? "size-9" : "size-7"} style={{ animationDelay: "60ms" }} />
      {/* Repeat */}
      <Shimmer rounded="full" className={isLg ? "size-10" : "size-9"} style={{ animationDelay: "40ms" }} />
    </div>
  );
});
SkeletonControlsRow.displayName = "SkeletonControlsRow";

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR SKELETON — mirrors Toolbar
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonToolbar = memo(() => (
  <div
    className="flex items-center justify-between pt-3"
    style={{ borderTop: "1px solid hsl(var(--border) / 0.12)" }}
  >
    {/* Sleep timer */}
    <Shimmer rounded="lg" className="size-9" style={{ animationDelay: "0ms" }} />
    {/* Focus */}
    <Shimmer rounded="lg" className="size-9" style={{ animationDelay: "30ms" }} />
    {/* Bitrate badge */}
    <Shimmer rounded="lg" className="h-7 w-12" style={{ animationDelay: "50ms" }} />
    {/* Autoplay */}
    <Shimmer rounded="lg" className="size-9" style={{ animationDelay: "70ms" }} />
    {/* Queue */}
    <Shimmer rounded="lg" className="size-9" style={{ animationDelay: "90ms" }} />
  </div>
));
SkeletonToolbar.displayName = "SkeletonToolbar";

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP RIGHT PANEL SKELETON — mirrors right panel controls column
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonDesktopRightPanel = memo(() => (
  <div
    className="hidden lg:flex flex-col lg:w-[50%] xl:w-[45%] border-l overflow-hidden relative"
    style={{ borderColor: "hsl(var(--border) / 0.12)" }}
  >
    <div className="absolute inset-0 shrink-0 px-10 pt-16 pb-6 flex flex-col">
      {/* Track title + artist + like */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-7 w-4/5" style={{ animationDelay: "0ms" }} />
          <Shimmer className="h-4 w-2/5" style={{ animationDelay: "40ms" }} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Shimmer rounded="lg" className="h-6 w-12" style={{ animationDelay: "60ms" }} />
          <Shimmer rounded="full" className="size-7" style={{ animationDelay: "80ms" }} />
        </div>
      </div>

      {/* Progress */}
      <SkeletonProgress hasLabels />

      {/* Controls */}
      <div className="mt-8">
        <SkeletonControlsRow size="lg" />
      </div>

      {/* Toolbar */}
      <div className="mt-8">
        <SkeletonToolbar />
      </div>
    </div>
  </div>
));
SkeletonDesktopRightPanel.displayName = "SkeletonDesktopRightPanel";

// ─────────────────────────────────────────────────────────────────────────────
// FULL PLAYER SKELETON — public export
// Drop-in replacement for FullPlayer while isLoading === true
// ─────────────────────────────────────────────────────────────────────────────

export interface FullPlayerSkeletonProps {
  /** Called when user swipes/taps down — mirrors FullPlayer's onCollapse */
  onCollapse?: () => void;
  visible?: boolean;
}

export const FullPlayerSkeleton = memo(
  ({ onCollapse, visible = true }: FullPlayerSkeletonProps) => {
    if (!visible) return null;

    return (
      <motion.div
        className="fps-enter fixed inset-0 z-[60] flex flex-col h-dvh overflow-hidden select-none bg-background isolate"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.13 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 500) onCollapse?.();
        }}
        role="status"
        aria-label="Đang tải trình phát nhạc"
        aria-busy="true"
      >
        {/* Background dimmed layer — matches PlayerBackground */}
        <div
          className="absolute inset-0 bg-background/90 z-0 pointer-events-none"
          aria-hidden="true"
        />

        <div className="mx-auto w-full h-full relative z-10 flex flex-col lg:flex-row lg:items-stretch lg:max-w-4xl xl:max-w-5xl">

          {/* ── LEFT PANEL ── */}
          <div className="flex flex-col flex-1 min-h-0 lg:flex-initial lg:w-[50%] xl:w-[55%]">

            {/* Header */}
            <SkeletonHeader />

            {/* Main view area — vinyl artwork placeholder */}
            <main className="relative flex-1 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <SkeletonVinylDisk />
              </div>
            </main>

            {/* ── MOBILE BOTTOM CONTROLS (lg:hidden) ── */}
            <div className="lg:hidden bg-transparent">
              <div className="px-6 pb-2 pt-2 space-y-5 shrink-0">
                {/* Track info row */}
                <SkeletonTrackInfoRow />

                {/* Divider */}
                <div
                  className="fps-shimmer"
                  style={{ height: 1, borderRadius: 0 }}
                  aria-hidden="true"
                />

                {/* Progress */}
                <SkeletonProgress hasLabels />

                {/* Controls */}
                <SkeletonControlsRow size="lg" />

                {/* Toolbar */}
                <SkeletonToolbar />
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL (desktop) ── */}
          <SkeletonDesktopRightPanel />
        </div>
      </motion.div>
    );
  },
);

FullPlayerSkeleton.displayName = "FullPlayerSkeleton";
export default FullPlayerSkeleton;