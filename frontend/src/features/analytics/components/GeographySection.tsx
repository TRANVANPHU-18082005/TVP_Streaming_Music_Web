// features/analytics/components/GeographySection.tsx

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Globe, TrendingUp } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import GeoMap from "./GeoMap";
import { GeoLocation } from "../types";

/* ── Rank colors dùng wave tokens ────────────────────────────── */
const RANK_STYLES = [
  { dot: "bg-wave-4", bar: "from-wave-4/80 to-wave-4", text: "text-wave-4" }, // gold
  { dot: "bg-wave-3", bar: "from-wave-3/80 to-wave-3", text: "text-wave-3" }, // cyan
  { dot: "bg-wave-1", bar: "from-wave-1/80 to-wave-1", text: "text-wave-1" }, // violet
  {
    dot: "bg-primary",
    bar: "from-primary/60 to-primary",
    text: "text-primary",
  },
  {
    dot: "bg-primary",
    bar: "from-primary/50 to-primary",
    text: "text-primary/80",
  },
];
const DEFAULT_RANK = {
  dot: "bg-muted-foreground/30",
  bar: "from-muted-foreground/30 to-muted-foreground/50",
  text: "text-muted-foreground/40",
};

/* ── Location row ────────────────────────────────────────────── */
const LocationRow = ({
  item,
  index,
  maxVal,
}: {
  item: GeoLocation;
  index: number;
  maxVal: number;
}) => {
  const rank = RANK_STYLES[index] ?? DEFAULT_RANK;
  const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
  const isTop3 = index < 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl px-3 py-2.5",
        "hover:bg-muted/40 transition-colors duration-150",
        "border border-transparent hover:border-border/40",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* Rank + name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "w-5 text-center font-black text-sm font-mono tabular-nums shrink-0",
              rank.text,
            )}
          >
            {index + 1}
          </span>

          {/* Rank dot */}
          <span className={cn("size-1.5 rounded-full shrink-0", rank.dot)} />

          <span
            className={cn(
              "font-semibold text-sm truncate",
              isTop3 ? "text-foreground" : "text-foreground/80",
              "group-hover:text-primary transition-colors duration-150",
            )}
          >
            {item.name}
          </span>
        </div>

        {/* Value badge */}
        <span
          className={cn(
            "text-[11px] font-black font-mono tabular-nums shrink-0",
            "px-2 py-0.5 rounded-lg",
            isTop3
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.value.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] w-full bg-muted rounded-full overflow-hidden ml-[52px]">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", rank.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
            delay: index * 0.05 + 0.1,
          }}
        />
      </div>
    </motion.div>
  );
};

/* ── Summary stats ───────────────────────────────────────────── */
const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-muted/50 border border-border/50 min-w-[64px]">
    <span className="text-[11px] font-black tabular-nums text-foreground">
      {value}
    </span>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
      {label}
    </span>
  </div>
);

/* ── Main component ──────────────────────────────────────────── */
const GeographySection = ({ data }: { data: GeoLocation[] }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  console.log(data);
  const sortedData = useMemo(
    () => [...(data || [])].sort((a, b) => b.value - a.value),
    [data],
  );

  const maxVal = sortedData[0]?.value || 1;
  const total = useMemo(
    () => sortedData.reduce((s, d) => s + d.value, 0),
    [sortedData],
  );
  const topShare =
    maxVal > 0 && total > 0 ? Math.round((maxVal / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-full">
      {/* ── MAP PANEL ─────────────────────────────────────────── */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        {/* Map container */}
        <div
          className={cn(
            "card-base relative overflow-hidden",
            "h-[280px] sm:h-[360px] lg:h-[420px]",
            "shadow-card-md",
          )}
        >
          {/* Ambient background mesh */}
          <div className="absolute inset-0 bg-mesh-brand opacity-40 pointer-events-none" />

          <GeoMap data={data} isDark={isDark} />
        </div>

        {/* Stats row below map */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill label="Countries" value={sortedData.length.toString()} />
          <StatPill
            label="Total access"
            value={
              total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toString()
            }
          />
          <StatPill label="Top share" value={`${topShare}%`} />
          {sortedData[0] && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 text-primary">
              <TrendingUp size={12} />
              <span className="text-[11px] font-bold">
                {sortedData[0].name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── TOP LOCATIONS LIST ────────────────────────────────── */}
      <div
        className={cn(
          "lg:col-span-1 card-base flex flex-col shadow-card-md",
          "h-auto lg:h-[calc(420px+52px+12px)]", // match map + stats height on desktop
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Globe size={14} />
            </div>
            <div className="leading-none">
              <h3 className="text-section-title text-sm">Top Locations</h3>
              <p className="text-section-subtitle text-[10px] mt-0.5">
                Most active regions
              </p>
            </div>
          </div>

          {/* Total count badge */}
          <span className="badge badge-muted text-[10px]">
            {sortedData.length} countries
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 no-scrollbar min-h-[200px] lg:min-h-0">
          {sortedData.length > 0 ? (
            <div className="space-y-0.5">
              {sortedData.map((item, index) => (
                <LocationRow
                  key={item.id}
                  item={item}
                  index={index}
                  maxVal={maxVal}
                />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-muted/50">
                <Globe size={22} className="text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground/60">
                  No traffic data
                </p>
                <p className="text-xs text-muted-foreground/40 mt-0.5">
                  Data will appear once users connect
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {sortedData.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 shrink-0">
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Showing {Math.min(sortedData.length, 10)} of {sortedData.length}{" "}
              regions
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeographySection;
