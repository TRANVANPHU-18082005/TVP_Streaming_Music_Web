import React, { useState, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  TooltipProps,
} from "recharts";
import { TrendingUp, Eye, BarChart2 } from "lucide-react";

import { ChartTrack, ITrack } from "@/features/track/types";
import { EqualizerLoader } from "@/components/ui/MusicLoadingEffects";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartLineProps {
  data: ChartDataPoint[];
  tracks: ChartTrack[];
}

interface ChartDataPoint {
  time: string;
  top1?: number;
  top2?: number;
  top3?: number;
  [key: string]: string | number | undefined;
}

// ─── Visual Config ────────────────────────────────────────────────────────────
// Colors chosen for WCAG AA contrast on both
// Light bg (#ffffff / off-white) and dark bg (#0d0f14 / #161921)
const SERIES = [
  {
    key: "top1",
    color: "#6366f1", // indigo-500
    colorDark: "#818cf8", // indigo-400 — brighter on dark bg
    glow: "rgba(99,102,241,0.35)",
    gradId: "areaGrad0",
    filterId: "lineGlow0",
    badge:
      "bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-400/20",
    ring: "ring-indigo-500/30 dark:ring-indigo-400/25",
    trend: "text-indigo-500 dark:text-indigo-400",
    peak: "text-indigo-600 dark:text-indigo-400",
    dot: "#6366f1",
  },
  {
    key: "top2",
    color: "#10b981", // emerald-500
    colorDark: "#34d399", // emerald-400
    glow: "rgba(16,185,129,0.35)",
    gradId: "areaGrad1",
    filterId: "lineGlow1",
    badge:
      "bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-400/20",
    ring: "ring-emerald-500/30 dark:ring-emerald-400/25",
    trend: "text-emerald-500 dark:text-emerald-400",
    peak: "text-emerald-600 dark:text-emerald-400",
    dot: "#10b981",
  },
  {
    key: "top3",
    color: "#f59e0b", // amber-500
    colorDark: "#fbbf24", // amber-400
    glow: "rgba(245,158,11,0.35)",
    gradId: "areaGrad2",
    filterId: "lineGlow2",
    badge:
      "bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-400/20",
    ring: "ring-amber-500/30 dark:ring-amber-400/25",
    trend: "text-amber-500 dark:text-amber-400",
    peak: "text-amber-600 dark:text-amber-400",
    dot: "#f59e0b",
  },
] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function getArtistName(track: ChartTrack): string {
  return (track as ITrack).artist?.name ?? "";
}

// ─── TrackCard ────────────────────────────────────────────────────────────────
interface TrackCardProps {
  track: ChartTrack;
  seriesIndex: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

const TrackCard = React.memo(
  ({
    track,
    seriesIndex,
    isHighlighted,
    isDimmed,
    onClick,
  }: TrackCardProps) => {
    const s = SERIES[seriesIndex];

    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isHighlighted}
        aria-label={`${isHighlighted ? "Bỏ lọc" : "Lọc"} ${track.title}`}
        className={cn(
          "group relative flex items-center gap-2.5 w-full text-left",
          "rounded-xl border px-3 py-2.5",
          "transition-all duration-250 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          "select-none cursor-pointer",
          // Base surface — uses semantic tokens
          "bg-card border-border",
          "hover:bg-accent dark:hover:bg-accent/60",
          // Highlighted
          isHighlighted && cn("ring-1", s.ring),
          // Dimmed
          isDimmed && "opacity-30 scale-[0.982] pointer-events-none",
        )}
      >
        {/* Left accent bar */}
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[52%] rounded-r-full transition-all duration-300"
          style={{
            backgroundColor: s.color,
            opacity: isDimmed ? 0.1 : isHighlighted ? 1 : 0.35,
            boxShadow:
              isHighlighted && !isDimmed ? `0 0 10px ${s.glow}` : "none",
          }}
          aria-hidden
        />

        {/* Rank badge */}
        <span
          className={cn(
            "ml-2 shrink-0 text-[10px] font-black w-[22px] h-[22px]",
            "rounded-md border flex items-center justify-center font-mono leading-none",
            s.badge,
          )}
        >
          #{seriesIndex + 1}
        </span>

        {/* Cover */}
        <div className="relative shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-border/60 shadow-sm">
          <img
            src={track.coverImage}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate leading-snug">
            {track.title}
          </p>
          <p className="text-[10.5px] text-muted-foreground truncate leading-snug mt-[1px] font-medium">
            {getArtistName(track)}
          </p>
        </div>

        {/* Trend icon */}
        <TrendingUp
          className={cn(
            "shrink-0 size-3 transition-opacity duration-200",
            s.trend,
            isHighlighted ? "opacity-55" : "opacity-10",
          )}
          aria-hidden
        />
      </button>
    );
  },
);
TrackCard.displayName = "TrackCard";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
interface ChartTooltipProps extends TooltipProps<number, string> {
  tracks: ChartTrack[];
}

const ChartTooltip = React.memo(
  ({ active, payload, label, tracks }: ChartTooltipProps) => {
    if (!active || !payload?.length) return null;

    const rows = payload
      .map((entry, i) => ({ entry, track: tracks[i], s: SERIES[i] }))
      .filter(({ track, entry }) => track && entry.value != null);

    if (!rows.length) return null;

    return (
      <div
        className={cn(
          "rounded-xl border border-border/80 shadow-2xl dark:shadow-black/50 overflow-hidden",
          "bg-popover/96 dark:bg-popover/98 backdrop-blur-xl",
          "min-w-[200px]",
        )}
        role="tooltip"
      >
        {/* Header */}
        <div className="px-3.5 py-2 border-b border-border/60 bg-muted/40 dark:bg-muted/20">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
            {label}
          </p>
        </div>

        {/* Rows */}
        <div className="px-3 py-2.5 space-y-2.5">
          {rows.map(({ entry, track, s }, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span
                className="shrink-0 w-[3px] h-8 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <img
                src={track.coverImage}
                className="w-8 h-8 rounded-lg object-cover border border-border/60 shrink-0"
                alt=""
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold text-foreground truncate leading-snug">
                  {track.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Eye
                    className="size-[9px] text-muted-foreground/60"
                    aria-hidden
                  />
                  <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    +{Math.round(Number(entry.value)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
ChartTooltip.displayName = "ChartTooltip";

// ─── SVG Defs (gradients + filters) ──────────────────────────────────────────
// Extracted to avoid re-declaring inline on every render
const ChartDefs = React.memo(() => (
  <defs>
    {SERIES.map((s, i) => (
      <React.Fragment key={i}>
        {/* Area fill gradient */}
        <linearGradient id={s.gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
          <stop offset="55%" stopColor={s.color} stopOpacity={0.05} />
          <stop offset="100%" stopColor={s.color} stopOpacity={0} />
        </linearGradient>

        {/* Line glow filter (active only) */}
        <filter id={s.filterId} x="-15%" y="-80%" width="130%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </React.Fragment>
    ))}
  </defs>
));
ChartDefs.displayName = "ChartDefs";

// ─── Empty / Loading State ────────────────────────────────────────────────────
const EmptyChart = () => (
  <div
    className={cn(
      "w-full h-[280px] sm:h-[340px]",
      "flex flex-col items-center justify-center gap-3",
      "rounded-2xl border border-border bg-muted/20 dark:bg-muted/10",
    )}
    role="status"
    aria-label="Đang tải dữ liệu biểu đồ"
  >
    <EqualizerLoader />
    <p className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">
      Loading chart data
    </p>
  </div>
);

// ─── Peak Stats Footer ────────────────────────────────────────────────────────
interface PeakStatProps {
  track: ChartTrack;
  seriesIndex: number;
  data: ChartDataPoint[];
}

const PeakStat = React.memo(({ track, seriesIndex, data }: PeakStatProps) => {
  const s = SERIES[seriesIndex];
  const peak = useMemo(
    () =>
      data.reduce((max, row) => {
        const v = Number(row[s.key] ?? 0);
        return v > max ? v : max;
      }, 0),
    [data, s.key],
  );

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: s.color }}
          aria-hidden
        />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          Peak
        </span>
      </div>
      <p
        className={cn(
          "text-[15px] font-black tabular-nums leading-none",
          s.peak,
        )}
      >
        {fmtViews(peak)}
      </p>
      <p className="text-[9px] text-muted-foreground truncate font-medium leading-snug">
        {track.title}
      </p>
    </div>
  );
});
PeakStat.displayName = "PeakStat";

// ─── ChartLine (main) ─────────────────────────────────────────────────────────
export const ChartLine = ({ data, tracks }: ChartLineProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasData = Boolean(data?.length && tracks?.length);
  const displayTracks = tracks.slice(0, 3);

  const toggleActive = useCallback(
    (i: number) => setActiveIndex((prev) => (prev === i ? null : i)),
    [],
  );

  if (!hasData) return <EmptyChart />;

  return (
    <div className="w-full space-y-3 animate-in fade-in duration-600">
      {/* ── Track legend cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {displayTracks.map((track, i) => (
          <TrackCard
            key={track._id ?? i}
            track={track}
            seriesIndex={i}
            isHighlighted={activeIndex === null || activeIndex === i}
            isDimmed={activeIndex !== null && activeIndex !== i}
            onClick={() => toggleActive(i)}
          />
        ))}
      </div>

      {/* ── Chart area ────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
        {/* Y-axis label */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none"
          aria-hidden
        >
          <BarChart2 className="size-3 text-muted-foreground/40" />
          <span className="text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Plays
          </span>
        </div>

        <div className="w-full h-[220px] sm:h-[280px] px-1 pt-8 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
            >
              <ChartDefs />

              <CartesianGrid
                strokeDasharray="3 6"
                vertical={false}
                stroke="hsl(var(--border))"
                opacity={0.7}
              />

              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                  fontWeight: 600,
                }}
                dy={8}
                interval="preserveStartEnd"
              />

              {/* Hidden Y axis for domain calculation only */}
              <YAxis hide domain={["auto", "auto"]} />

              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  opacity: 0.3,
                }}
                content={<ChartTooltip tracks={tracks} />}
                wrapperStyle={{ zIndex: 50 }}
                isAnimationActive={false}
              />

              {SERIES.map((s, i) => {
                if (!displayTracks[i]) return null;
                const isActive = activeIndex === null || activeIndex === i;

                return (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={isActive ? 2 : 1}
                    strokeOpacity={isActive ? 1 : 0.08}
                    fillOpacity={isActive ? 1 : 0}
                    fill={`url(#${s.gradId})`}
                    filter={isActive ? `url(#${s.filterId})` : undefined}
                    animationDuration={900 + i * 180}
                    animationEasing="ease-out"
                    dot={false}
                    activeDot={
                      isActive
                        ? {
                            r: 5,
                            strokeWidth: 2.5,
                            stroke: "hsl(var(--background))",
                            fill: s.dot,
                          }
                        : false
                    }
                    isAnimationActive={isActive}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Mobile tap hint */}
        <p
          className="sm:hidden text-center text-[9px] text-muted-foreground/40 pb-2.5 font-medium tracking-widest uppercase"
          aria-hidden
        >
          Tap card to isolate track
        </p>
      </div>

      {/* ── Peak stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {displayTracks.map((track, i) => (
          <PeakStat
            key={track._id ?? i}
            track={track}
            seriesIndex={i}
            data={data}
          />
        ))}
      </div>
    </div>
  );
};

export default ChartLine;
