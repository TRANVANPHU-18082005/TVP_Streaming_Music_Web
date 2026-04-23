import { memo } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_COUNT = 10;

const SKELETON_WIDTHS = [
  { title: "42%", artist: "26%" },
  { title: "55%", artist: "32%" },
  { title: "38%", artist: "20%" },
  { title: "48%", artist: "28%" },
  { title: "61%", artist: "35%" },
  { title: "44%", artist: "24%" },
  { title: "52%", artist: "30%" },
  { title: "39%", artist: "22%" },
  { title: "58%", artist: "34%" },
  { title: "46%", artist: "27%" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

interface SkProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Base shimmer block — inherits shape from className */
const Sk = memo(({ className, style }: SkProps) => (
  <div aria-hidden="true" className={cn("skeleton", className)} style={style} />
));
Sk.displayName = "Sk";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON
// Live badge  →  #Charts title  →  subtitle
// ─────────────────────────────────────────────────────────────────────────────

const HeroSkeleton = memo(() => (
  <section
    aria-hidden="true"
    className="relative pt-12 pb-12 md:pt-20 md:pb-16 overflow-hidden"
  >
    {/* Ambient blobs — same markup as real HeroSection, no shimmer needed */}
    <div
      className="absolute inset-0 pointer-events-none -z-10"
      style={{ contain: "strict" }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(1000px,100%)] h-80 blur-[100px] rounded-full"
        style={{ background: "hsl(var(--primary)/0.05)" }}
      />
    </div>

    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
      {/* Live badge pill */}
      <div className="flex justify-center mb-7">
        <Sk className="skeleton-pill h-7 w-36" />
      </div>

      {/* Title block */}
      <div className="flex flex-col items-center gap-3 mb-11">
        <Sk
          className="rounded-2xl"
          style={{
            width: "clamp(200px, 45vw, 380px)",
            height: "clamp(52px, 10vw, 84px)",
          }}
        />
        <Sk className="skeleton-pill h-4 w-56" />
      </div>

      {/* Chart card */}
      <div className="rounded-2xl border border-border/50 dark:border-primary/15 shadow-brand p-0 md:p-4">
        <div className="rounded-2xl overflow-hidden border border-border/50 dark:border-border/30 glass-frosted shadow-elevated">
          {/* Card header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 dark:border-border/25 bg-muted/20 dark:bg-muted/10">
            {/* Left: icon + labels */}
            <div className="flex items-center gap-3">
              <Sk className="w-9 h-9 rounded-xl shrink-0" />
              <div className="flex flex-col gap-1.5">
                <Sk className="skeleton-pill h-[13px] w-32" />
                <Sk className="skeleton-pill h-[11px] w-24" />
              </div>
            </div>
            {/* Right: leader avatars */}
            <div className="flex items-center gap-3">
              <Sk className="skeleton-pill h-[10px] w-9 hidden sm:block" />
              <div className="flex -space-x-2.5">
                {[0, 1, 2].map((i) => (
                  <Sk
                    key={i}
                    className="skeleton-avatar w-8 h-8 border-[2.5px] border-background"
                    style={{ zIndex: 3 - i }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ChartLine area */}
          <div className="p-4 sm:p-5">
            <ChartLineSkeleton />
          </div>
        </div>
      </div>
    </div>
  </section>
));
HeroSkeleton.displayName = "HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// CHART LINE SKELETON
// Three faint polylines that mimic real trend lines, plus a shimmer overlay.
// ─────────────────────────────────────────────────────────────────────────────

const ChartLineSkeleton = memo(() => (
  <div style={{ height: 120 }}>
    <svg
      width="100%"
      height="120"
      viewBox="0 0 820 120"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,90 60,72 120,60 200,45 280,55 360,38 440,50 520,30 600,42 680,28 760,38 820,35"
        opacity="0.7"
      />
      <polyline
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,100 60,88 120,80 200,70 280,78 360,65 440,72 520,58 600,68 680,55 760,62 820,58"
        opacity="0.45"
      />
      <polyline
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,108 60,98 120,92 200,85 280,90 360,80 440,86 520,75 600,82 680,70 760,76 820,72"
        opacity="0.28"
      />
    </svg>
  </div>
));
ChartLineSkeleton.displayName = "ChartLineSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE TRACK ROW SKELETON
// rank column  →  cover  →  title + artist  →  [hidden cols]  →  duration
// ─────────────────────────────────────────────────────────────────────────────

const TrackRowSkeleton = memo(({ index }: { index: number }) => {
  const w = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl"
      style={{ animationDelay: `${index * 52}ms` }}
      aria-hidden="true"
    >
      {/* Rank column */}
      <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
        <Sk className="skeleton-pill h-[17px] w-5" />
        <Sk className="skeleton-pill h-3 w-6" />
      </div>

      {/* Cover */}
      <Sk className="skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

      {/* Title + artist */}
      <div className="flex-1 space-y-2 min-w-0">
        <Sk className="skeleton-pill h-[13px]" style={{ width: w.title }} />
        <Sk className="skeleton-pill h-3" style={{ width: w.artist }} />
      </div>

      {/* Album / genre — hidden on small screens */}
      <Sk className="skeleton-pill h-3 w-[140px] hidden lg:block" />

      {/* Duration */}
      <Sk className="skeleton-pill h-3 w-9 hidden sm:block" />
    </div>
  );
});
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SKELETON
// Section header  →  N track rows  →  show-more button
// ─────────────────────────────────────────────────────────────────────────────

const TrackListSkeleton = memo(() => (
  <section
    aria-label="Loading chart rankings"
    className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-2 pb-4"
  >
    {/* Static header: flame icon + "Top N" + Vietnam badge + rules button */}
    <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <Sk className="skeleton-avatar w-[18px] h-[18px] shrink-0" />
        <Sk className="rounded-lg h-6 w-16" />
        <Sk className="rounded-lg h-6 w-16" />
      </div>
      <Sk className="skeleton-pill h-8 w-24" />
    </div>

    {/* Track rows */}
    <div
      className="flex flex-col gap-0.5"
      role="status"
      aria-label="Loading tracks"
      aria-live="polite"
    >
      {Array.from({ length: TRACK_COUNT }, (_, i) => (
        <TrackRowSkeleton key={i} index={i} />
      ))}
    </div>

    {/* Show-more button */}
    <div className="mt-10 flex justify-center">
      <Sk className="skeleton-pill h-10 w-44" />
    </div>
  </section>
));
TrackListSkeleton.displayName = "TrackListSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TOP CHART PAGE SKELETON — default export
// Drop-in replacement for <PageLoader /> while data is fetching.
// Matches the exact layout of <TopChartPage /> so there is zero layout shift
// when real content arrives.
// ─────────────────────────────────────────────────────────────────────────────

export const TopChartPageSkeleton = memo(() => (
  <main
    aria-busy="true"
    aria-label="Loading chart"
    className="min-h-screen bg-background overflow-x-hidden pb-24"
  >
    <HeroSkeleton />
    <TrackListSkeleton />
  </main>
));
TopChartPageSkeleton.displayName = "TopChartPageSkeleton";

export default TopChartPageSkeleton;
