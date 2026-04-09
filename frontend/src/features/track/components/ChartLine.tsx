/**
 * ChartLine.tsx — v2.0
 *
 * CHANGES vs v1.0:
 * ─ Props: tracks typed as RankedTrack[] (superset of ChartTrack — backward safe).
 *   animationDelay prop added — forwarded to ChartCanvas for staggered hero draw.
 * ─ ChartLineProps: animationDelay?: number
 * ─ ChartCanvas: animationDelay prop drives Area animationBegin offset.
 *   hasMounted ref still gates replay — delay only affects initial draw.
 * ─ YAxis domain: [0, dataMax => ceil(dataMax * 1.1)] — 10% headroom,
 *   biểu đồ không bị "dính trần", nhìn thoáng hơn.
 * ─ Tooltip label: formatted as "15:00 · hôm nay" with Clock icon.
 *   makeTooltipLabel() helper — pure fn, zero cost.
 * ─ All other architecture, memo(), hooks, accessibility preserved.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
} from "react";
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
import { TrendingUp, Eye, BarChart2, Clock } from "lucide-react";

import { RankedTrack } from "@/features/track/hooks/useRealtimeChart";
import { ChartTrack } from "@/features/track/types";
import { EqualizerLoader } from "@/components/ui/MusicLoadingEffects";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  time: string;
  top1?: number;
  top2?: number;
  top3?: number;
  [key: string]: string | number | undefined;
}

export interface ChartLineProps {
  data: ChartDataPoint[];
  tracks: RankedTrack[]; // RankedTrack ⊇ ChartTrack — fully backward safe
  animationDelay?: number; // seconds — from HeroSection stagger (default 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIES CONFIG — unchanged from v1.0
// ─────────────────────────────────────────────────────────────────────────────

interface SeriesCfg {
  readonly key: "top1" | "top2" | "top3";
  readonly stroke: string;
  readonly strokeDk: string;
  readonly glow: string;
  readonly fillOpacity: number;
  readonly fillOpacityDk: number;
  readonly gradId: string;
  readonly filterId: string;
  readonly badgeCls: string;
  readonly ringCls: string;
  readonly trendCls: string;
  readonly peakCls: string;
  readonly dot: string;
}

const SERIES: readonly SeriesCfg[] = [
  {
    key: "top1",
    stroke: "#6366f1",
    strokeDk: "#818cf8",
    glow: "rgba(99,102,241,0.42)",
    fillOpacity: 0.22,
    fillOpacityDk: 0.28,
    gradId: "sw-grad-0",
    filterId: "sw-glow-0",
    badgeCls:
      "bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-400/20",
    ringCls: "ring-indigo-500/35 dark:ring-indigo-400/30",
    trendCls: "text-indigo-500 dark:text-indigo-400",
    peakCls: "text-indigo-600 dark:text-indigo-400",
    dot: "#6366f1",
  },
  {
    key: "top2",
    stroke: "#10b981",
    strokeDk: "#34d399",
    glow: "rgba(16,185,129,0.40)",
    fillOpacity: 0.2,
    fillOpacityDk: 0.26,
    gradId: "sw-grad-1",
    filterId: "sw-glow-1",
    badgeCls:
      "bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-400/20",
    ringCls: "ring-emerald-500/35 dark:ring-emerald-400/30",
    trendCls: "text-emerald-500 dark:text-emerald-400",
    peakCls: "text-emerald-600 dark:text-emerald-400",
    dot: "#10b981",
  },
  {
    key: "top3",
    stroke: "#f59e0b",
    strokeDk: "#fbbf24",
    glow: "rgba(245,158,11,0.40)",
    fillOpacity: 0.2,
    fillOpacityDk: 0.26,
    gradId: "sw-grad-2",
    filterId: "sw-glow-2",
    badgeCls:
      "bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-400/20",
    ringCls: "ring-amber-500/35 dark:ring-amber-400/30",
    trendCls: "text-amber-500 dark:text-amber-400",
    peakCls: "text-amber-600 dark:text-amber-400",
    dot: "#f59e0b",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function getArtistName(track: ChartTrack): string {
  return (track as any).artist?.name ?? "Unknown Artist";
}

/**
 * makeTooltipLabel — formats "15:00" → "15:00 · hôm nay"
 * Pure function — no deps, called inside tooltip render only.
 */
function makeTooltipLabel(raw: string): string {
  if (!raw) return "";
  return `${raw} · hôm nay`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — useChartTheme (unchanged from v1.0)
// ─────────────────────────────────────────────────────────────────────────────

interface ChartTheme {
  mutedFg: string;
  border: string;
  background: string;
  isDark: boolean;
}

const SSR_DEFAULTS: ChartTheme = {
  mutedFg: "#888888",
  border: "#333333",
  background: "#ffffff",
  isDark: false,
};

function resolveToken(name: string): string {
  return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
}

function readTheme(): ChartTheme {
  return {
    mutedFg: resolveToken("--muted-foreground"),
    border: resolveToken("--border"),
    background: resolveToken("--background"),
    isDark: document.documentElement.classList.contains("dark"),
  };
}

function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() =>
    typeof document === "undefined" ? SSR_DEFAULTS : readTheme(),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — usePeakStats (unchanged from v1.0)
// ─────────────────────────────────────────────────────────────────────────────

function usePeakStats(data: ChartDataPoint[]): number[] {
  return useMemo(
    () =>
      SERIES.map((s) =>
        data.reduce((max, row) => {
          const v = Number(row[s.key] ?? 0);
          return v > max ? v : max;
        }, 0),
      ),
    [data],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — useSeriesOpacity (unchanged from v1.0)
// ─────────────────────────────────────────────────────────────────────────────

interface SeriesRenderCfg {
  strokeWidth: number;
  strokeOpacity: number;
  fillOpacity: number;
  showFilter: boolean;
  showActiveDot: boolean;
}

function useSeriesOpacity(activeIndex: number | null): SeriesRenderCfg[] {
  return useMemo(
    () =>
      SERIES.map((_, i) => {
        const isActive = activeIndex === null || activeIndex === i;
        return {
          strokeWidth: isActive ? 2.5 : 1,
          strokeOpacity: isActive ? 1 : 0.055,
          fillOpacity: isActive ? 1 : 0,
          showFilter: isActive,
          showActiveDot: isActive,
        };
      }),
    [activeIndex],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG DEFS (unchanged from v1.0)
// ─────────────────────────────────────────────────────────────────────────────

const ChartDefs = memo(({ isDark }: { isDark: boolean }) => (
  <defs>
    {SERIES.map((s) => {
      const topOpacity = isDark ? s.fillOpacityDk : s.fillOpacity;
      return (
        <React.Fragment key={s.key}>
          <linearGradient id={s.gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.stroke} stopOpacity={topOpacity} />
            <stop
              offset="55%"
              stopColor={s.stroke}
              stopOpacity={topOpacity * 0.28}
            />
            <stop offset="100%" stopColor={s.stroke} stopOpacity={0} />
          </linearGradient>
          <filter id={s.filterId} x="-15%" y="-80%" width="130%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </React.Fragment>
      );
    })}
  </defs>
));
ChartDefs.displayName = "ChartDefs";

// ─────────────────────────────────────────────────────────────────────────────
// CHART TOOLTIP
//
// FIX — label now uses makeTooltipLabel() for "15:00 · hôm nay" format.
// Clock icon added as visual anchor. Time string rendered in font-mono.
// ─────────────────────────────────────────────────────────────────────────────

interface ChartTooltipInnerProps extends TooltipProps<number, string> {
  tracks: RankedTrack[];
}

const ChartTooltipInner = memo(
  ({ active, payload, label, tracks }: ChartTooltipInnerProps) => {
    if (!active || !payload?.length) return null;

    const rows = payload
      .map((entry, i) => ({ entry, track: tracks[i], s: SERIES[i] }))
      .filter(({ track, entry }) => track != null && entry.value != null);

    if (!rows.length) return null;

    const formattedLabel = makeTooltipLabel(label as string);

    return (
      <div
        role="tooltip"
        className={cn(
          "min-w-[210px] rounded-xl overflow-hidden",
          "bg-card/90 dark:bg-card/88",
          "backdrop-blur-[28px] saturate-[175%]",
          "border border-border/60 dark:border-border/35",
          "shadow-floating dark:shadow-black/55",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07)]",
        )}
      >
        {/* Time header — FIX: formatted label + Clock icon */}
        <div className="px-3.5 py-2 border-b border-border/45 bg-muted/25 dark:bg-muted/12">
          <div className="flex items-center gap-1.5">
            <Clock
              aria-hidden="true"
              className="size-[9px] text-muted-foreground/50 shrink-0"
            />
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em] font-mono">
              {formattedLabel}
            </p>
          </div>
        </div>

        {/* Series rows — unchanged */}
        <div className="px-3 py-3 space-y-2.5">
          {rows.map(({ entry, track, s }, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="shrink-0 w-[3px] h-8 rounded-full"
                style={{ backgroundColor: s.stroke }}
              />
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/60 shrink-0">
                <img
                  src={track.coverImage}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold text-foreground/90 truncate leading-snug">
                  {track.title}
                </p>
                <div className="flex items-center gap-1 mt-[3px]">
                  <Eye
                    aria-hidden="true"
                    className="size-[9px] text-muted-foreground/50 shrink-0"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    +{Math.round(Number(entry.value)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
ChartTooltipInner.displayName = "ChartTooltipInner";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LEGEND CARD (unchanged from v1.0 except track type → RankedTrack)
// ─────────────────────────────────────────────────────────────────────────────

interface TrackLegendCardProps {
  track: RankedTrack;
  seriesIndex: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

const TrackLegendCard = memo(
  ({
    track,
    seriesIndex,
    isHighlighted,
    isDimmed,
    onClick,
  }: TrackLegendCardProps) => {
    const s = SERIES[seriesIndex];
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isHighlighted && !isDimmed ? true : undefined}
        aria-label={`${isDimmed ? "Show" : isHighlighted ? "Reset" : "Isolate"}: ${track.title} by ${getArtistName(track)}`}
        disabled={isDimmed}
        className={cn(
          "group relative flex items-center gap-2.5 w-full text-left",
          "rounded-xl border px-3 py-2.5",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-[hsl(var(--ring)/0.55)]",
          "select-none cursor-pointer",
          "bg-card border-border",
          "hover:bg-accent/55 dark:hover:bg-accent/38",
          !isDimmed && isHighlighted && cn("ring-1", s.ringCls),
          isDimmed && "opacity-22 scale-[0.982] pointer-events-none",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[58%] rounded-r-full"
          style={{
            backgroundColor: s.stroke,
            opacity: isDimmed ? 0.07 : isHighlighted ? 1 : 0.28,
            boxShadow:
              !isDimmed && isHighlighted ? `0 0 14px ${s.glow}` : "none",
            transition: "opacity 0.22s ease, box-shadow 0.22s ease",
          }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "ml-2 shrink-0 text-[10px] font-black w-[22px] h-[22px]",
            "rounded-md border flex items-center justify-center font-mono leading-none",
            s.badgeCls,
          )}
        >
          #{seriesIndex + 1}
        </span>
        <div className="relative shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-border/60 shadow-sm">
          <img
            src={track.coverImage}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground/90 truncate leading-snug">
            {track.title}
          </p>
          <p className="text-[10.5px] text-muted-foreground/65 truncate leading-snug mt-[2px] font-medium">
            {getArtistName(track)}
          </p>
        </div>
        <TrendingUp
          aria-hidden="true"
          className={cn(
            "shrink-0 size-3 transition-opacity duration-200",
            s.trendCls,
            isHighlighted && !isDimmed ? "opacity-60" : "opacity-8",
          )}
        />
      </button>
    );
  },
);
TrackLegendCard.displayName = "TrackLegendCard";

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND GRID (unchanged from v1.0 except track type)
// ─────────────────────────────────────────────────────────────────────────────

interface LegendGridProps {
  tracks: RankedTrack[];
  activeIndex: number | null;
  onToggle: (i: number) => void;
}

const LegendGrid = memo(
  ({ tracks, activeIndex, onToggle }: LegendGridProps) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {tracks.map((track, i) => (
        <TrackLegendCard
          key={track._id ?? i}
          track={track}
          seriesIndex={i}
          isHighlighted={activeIndex === null || activeIndex === i}
          isDimmed={activeIndex !== null && activeIndex !== i}
          onClick={() => onToggle(i)}
        />
      ))}
    </div>
  ),
);
LegendGrid.displayName = "LegendGrid";

// ─────────────────────────────────────────────────────────────────────────────
// CHART CANVAS
//
// FIX 1 — animationDelay prop:
//   Each Area's animationBegin is offset by `animationDelay * 1000` ms.
//   hasMounted ref still gates replay — delay only affects initial draw,
//   live socket updates remain silent (isAnimationActive = false after mount).
//
// FIX 2 — YAxis domain:
//   [0, dataMax => Math.ceil(dataMax * 1.1)] gives 10% headroom above peak.
//   Biểu đồ không bị "dính trần", peak label không overlap the top edge.
//   YAxis remains hidden — domain computation is the only purpose.
// ─────────────────────────────────────────────────────────────────────────────

interface ChartCanvasProps {
  data: ChartDataPoint[];
  tracks: RankedTrack[];
  theme: ChartTheme;
  seriesOpacity: SeriesRenderCfg[];
  showHint: boolean;
  animationDelay: number; // seconds → converted to ms for Recharts
}

const ChartCanvas = memo(
  ({
    data,
    tracks,
    theme,
    seriesOpacity,
    showHint,
    animationDelay,
  }: ChartCanvasProps) => {
    const hasMounted = useRef(false);

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    // Stable tooltip content — memoized on tracks identity
    const tooltipContent = useMemo(
      () => (props: TooltipProps<number, string>) => (
        <ChartTooltipInner {...props} tracks={tracks} />
      ),
      [tracks],
    );

    const activeDotStyle = useMemo(
      () => ({ r: 5, strokeWidth: 2.5, stroke: theme.background }),
      [theme.background],
    );

    // FIX 2: 10% headroom — biểu đồ không bị dính trần
    const yDomain = useMemo(
      () => [0, (dataMax: number) => Math.ceil(dataMax * 1.1)] as const,
      [],
    );

    // animationDelay in seconds → ms for Recharts animationBegin
    const delayMs = Math.round(animationDelay * 1000);

    return (
      <div
        className={cn(
          "relative rounded-2xl border border-border bg-card overflow-hidden",
          "shadow-raised dark:shadow-black/22",
          "transition-shadow duration-200",
        )}
      >
        <div
          aria-hidden="true"
          className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none"
        >
          <BarChart2 className="size-3 text-muted-foreground/30 shrink-0" />
          <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">
            Plays
          </span>
        </div>

        <div
          className="w-full h-[220px] sm:h-[288px] px-1 pt-8 pb-3"
          role="img"
          aria-label="Play count trend chart for top 3 tracks"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 16, left: -22, bottom: 0 }}
            >
              <ChartDefs isDark={theme.isDark} />

              <CartesianGrid
                strokeDasharray="3 7"
                vertical={false}
                stroke={theme.border}
                opacity={0.6}
              />

              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.mutedFg, fontSize: 10, fontWeight: 600 }}
                dy={8}
                interval="preserveStartEnd"
              />

              {/* FIX 2: domain with 10% headroom */}
              <YAxis hide domain={yDomain} />

              <Tooltip
                cursor={{
                  stroke: theme.mutedFg,
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  opacity: 0.22,
                }}
                content={tooltipContent}
                wrapperStyle={{ zIndex: 50 }}
                isAnimationActive={false}
              />

              {SERIES.map((s, i) => {
                if (!tracks[i]) return null;
                const oc = seriesOpacity[i];

                return (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={theme.isDark ? s.strokeDk : s.stroke}
                    strokeWidth={oc.strokeWidth}
                    strokeOpacity={oc.strokeOpacity}
                    fillOpacity={oc.fillOpacity}
                    fill={`url(#${s.gradId})`}
                    filter={oc.showFilter ? `url(#${s.filterId})` : undefined}
                    dot={false}
                    activeDot={
                      oc.showActiveDot
                        ? { ...activeDotStyle, fill: s.dot }
                        : false
                    }
                    // FIX 1: animate on first mount only, staggered by delayMs
                    isAnimationActive={!hasMounted.current}
                    animationBegin={delayMs + i * 120}
                    animationDuration={800 + i * 180}
                    animationEasing="ease-out"
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {showHint && (
          <p
            aria-hidden="true"
            className="sm:hidden text-center text-[9px] text-muted-foreground/32 pb-2.5 font-bold tracking-widest uppercase"
          >
            Tap a card to isolate
          </p>
        )}
      </div>
    );
  },
);
ChartCanvas.displayName = "ChartCanvas";

// ─────────────────────────────────────────────────────────────────────────────
// PEAK STAT CARD / PEAK STATS ROW (unchanged from v1.0 except track type)
// ─────────────────────────────────────────────────────────────────────────────

interface PeakStatCardProps {
  track: RankedTrack;
  seriesIndex: number;
  peak: number;
}

const PeakStatCard = memo(({ track, seriesIndex, peak }: PeakStatCardProps) => {
  const s = SERIES[seriesIndex];
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex flex-col gap-1.5 min-w-0 shadow-raised dark:shadow-black/22 transition-shadow duration-200 hover:shadow-elevated">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ backgroundColor: s.stroke }}
        />
        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
          Peak
        </span>
      </div>
      <p
        className={cn(
          "text-[15px] font-black tabular-nums leading-none",
          s.peakCls,
        )}
        aria-label={`Peak plays: ${peak.toLocaleString()}`}
      >
        {fmtViews(peak)}
      </p>
      <p className="text-[9.5px] text-muted-foreground/55 truncate font-medium leading-snug">
        {track.title}
      </p>
    </div>
  );
});
PeakStatCard.displayName = "PeakStatCard";

const PeakStatsRow = memo(
  ({ tracks, peaks }: { tracks: RankedTrack[]; peaks: number[] }) => (
    <div className="grid grid-cols-3 gap-2">
      {tracks.map((track, i) => (
        <PeakStatCard
          key={track._id ?? i}
          track={track}
          seriesIndex={i}
          peak={peaks[i]}
        />
      ))}
    </div>
  ),
);
PeakStatsRow.displayName = "PeakStatsRow";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const EmptyChartState = memo(() => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading chart data"
    className="w-full h-[320px] sm:h-[380px] flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-muted/12 dark:bg-muted/8"
  >
    <EqualizerLoader />
    <p className="text-[9.5px] text-muted-foreground/40 font-bold tracking-[0.18em] uppercase">
      Loading chart data
    </p>
  </div>
));
EmptyChartState.displayName = "EmptyChartState";

// ─────────────────────────────────────────────────────────────────────────────
// CHART LINE — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export const ChartLine = ({
  data,
  tracks,
  animationDelay = 0,
}: ChartLineProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(true);

  const hasData = Boolean(data?.length && tracks?.length);
  const displayTracks = useMemo(() => tracks.slice(0, 3), [tracks]);
  const peaks = usePeakStats(data ?? []);
  const theme = useChartTheme();
  const seriesOpacity = useSeriesOpacity(activeIndex);

  const toggleActive = useCallback((i: number) => {
    setActiveIndex((prev) => (prev === i ? null : i));
    setShowHint(false);
  }, []);

  if (!hasData) return <EmptyChartState />;

  return (
    <div className="w-full space-y-3 animate-fade-up">
      <LegendGrid
        tracks={displayTracks}
        activeIndex={activeIndex}
        onToggle={toggleActive}
      />
      <ChartCanvas
        data={data}
        tracks={displayTracks}
        theme={theme}
        seriesOpacity={seriesOpacity}
        showHint={showHint}
        animationDelay={animationDelay}
      />
      <PeakStatsRow tracks={displayTracks} peaks={peaks} />
    </div>
  );
};

export default ChartLine;
