// features/analytics/components/TrendingTracks.tsx

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Music, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toCDN } from "@/utils/track-helper";
import { IChartItem } from "@/features/track";

// ─── Rank medal colors (dùng wave tokens từ design system) ───────
const RANK_STYLES = [
  { color: "text-wave-4", bg: "bg-wave-4/10" }, // 🥇 gold
  { color: "text-muted-foreground", bg: "bg-muted-foreground/8" }, // 🥈 silver
  { color: "text-wave-1", bg: "bg-wave-1/10" }, // 🥉 bronze-violet
  { color: "text-muted-foreground/40", bg: "" },
  { color: "text-muted-foreground/40", bg: "" },
];

// ─── TrackRow ────────────────────────────────────────────────────
const TrackRow = ({
  item,
  index,
  maxScore,
}: {
  item: IChartItem;
  index: number;
  maxScore: number;
}) => {
  const heatPercent = maxScore > 0 ? (item.score / maxScore) * 100 : 0;
  const rank = RANK_STYLES[index] ?? RANK_STYLES[4];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.045, duration: 0.22, ease: "easeOut" }}
      className="track-row group"
    >
      {/* Rank number */}
      <div
        className={cn(
          "flex items-center justify-center size-7 rounded-lg shrink-0",
          "font-black text-sm font-mono tabular-nums",
          rank.color,
          rank.bg,
        )}
      >
        {index + 1}
      </div>

      {/* Cover art */}
      <div className="relative size-10 rounded-xl overflow-hidden shrink-0 border border-border/20 shadow-card">
        <ImageWithFallback
          src={toCDN(item.coverImage)}
          alt={item.title}
          className="img-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        {/* Overlay shimmer on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Track info + heat bar */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-track-title truncate">{item.title}</p>
          <span className="text-xs font-mono font-black text-primary tabular-nums shrink-0 text-[11px]">
            {item.score.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-track-meta truncate w-20 shrink-0">
            {item.artist?.name ?? "Unknown"}
          </p>
          {/* Heat bar */}
          <div className="flex-1 h-[3px] bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(var(--wave-1)/0.6), hsl(var(--wave-1)))",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${heatPercent}%` }}
              transition={{
                duration: 0.9,
                ease: "easeOut",
                delay: index * 0.06,
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── NowListeningRow ─────────────────────────────────────────────
const NowListeningRow = ({
  item,
  index,
}: {
  item: IChartItem;
  index: number;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0 }}
    transition={{ delay: index * 0.05, duration: 0.2 }}
    className="track-row group"
  >
    {/* Cover */}
    <div className="size-9 rounded-xl overflow-hidden shrink-0 border border-border/20 shadow-card">
      <ImageWithFallback
        src={toCDN(item.coverImage)}
        alt={item.title}
        className="img-cover transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
      />
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-foreground truncate leading-snug">
        {item.title}
      </p>
      <p className="text-track-meta truncate">
        {item.artist?.name ?? "Unknown"}
      </p>
    </div>

    {/* Live listener count */}
    <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-success/10 border border-success/20">
      {/* Pulse dot */}
      <span className="relative flex size-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
      </span>
      <span className="text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 font-mono">
        {item.score.toLocaleString()}
      </span>
    </div>
  </motion.div>
);

// ─── Section header ───────────────────────────────────────────────
const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  iconBg,
  iconColor,
  badgeClass,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  badge: string;
  iconBg: string;
  iconColor: string;
  badgeClass: string;
}) => (
  <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border/50 shrink-0">
    <div className="flex items-center gap-2.5">
      <div className={cn("p-1.5 rounded-xl shrink-0", iconBg, iconColor)}>
        <Icon size={14} />
      </div>
      <div className="leading-none">
        <h3 className="text-section-title text-sm leading-none">{title}</h3>
        <span className="text-section-subtitle text-[10px] mt-0.5 block">
          {subtitle}
        </span>
      </div>
    </div>
    <span
      className={cn(
        "badge text-[9px] font-bold uppercase tracking-wider",
        badgeClass,
      )}
    >
      {badge}
    </span>
  </div>
);

// ─── Empty state ─────────────────────────────────────────────────
const EmptyState = ({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-muted-foreground">
    <div className="p-3 rounded-2xl bg-muted/40">
      <Icon size={22} className="opacity-30" />
    </div>
    <span className="text-xs font-medium opacity-60">{label}</span>
  </div>
);

// ─── Tab toggle (mobile only) ─────────────────────────────────────
type TabKey = "trending" | "live";

const TabToggle = ({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) => (
  <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50 sm:hidden mx-4 mb-3">
    {(["trending", "live"] as TabKey[]).map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold",
          "transition-all duration-200",
          active === tab
            ? "bg-card text-foreground shadow-card border border-border/40"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {tab === "trending" ? (
          <>
            <Radio size={11} />
            Trending
          </>
        ) : (
          <>
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
            </span>
            Live
          </>
        )}
      </button>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────
interface TrendingTracksProps {
  trendingData: IChartItem[];
  nowListeningData: IChartItem[];
}

const TrendingTracks = ({
  trendingData,
  nowListeningData,
}: TrendingTracksProps) => {
  const maxScore = trendingData?.[0]?.score ?? 1;
  const [activeTab, setActiveTab] = useState<TabKey>("trending");

  return (
    <div
      className={cn(
        "card-base flex flex-col h-full min-h-[400px]",
        "shadow-card-md",
      )}
    >
      {/* ── Mobile tab toggle ── */}
      <div className="pt-4 sm:hidden">
        <TabToggle active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Content grid ── */}
      <div
        className={cn(
          "flex-1 min-h-0",
          // Desktop: side-by-side | Mobile: single pane via tab
          "sm:grid sm:grid-cols-2 sm:divide-x sm:divide-border",
          // On mobile, show/hide panels via activeTab
          "flex flex-col",
        )}
      >
        {/* ── LEFT: Trending ── */}
        <div
          className={cn(
            "flex flex-col min-h-0",
            // Mobile visibility
            activeTab !== "trending" && "hidden sm:flex",
          )}
        >
          <SectionHeader
            icon={Radio}
            title="Trending"
            subtitle="Top this hour"
            badge="1H"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            badgeClass="badge-muted"
          />

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {trendingData?.length > 0 ? (
                trendingData
                  .slice(0, 5)
                  .map((item, i) => (
                    <TrackRow
                      key={item._id}
                      item={item}
                      index={i}
                      maxScore={maxScore}
                    />
                  ))
              ) : (
                <EmptyState icon={Music} label="Collecting data..." />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT: Now Listening ── */}
        <div
          className={cn(
            "flex flex-col min-h-0",
            activeTab !== "live" && "hidden sm:flex",
          )}
        >
          <SectionHeader
            icon={Headphones}
            title="Now Playing"
            subtitle="Live listeners"
            badge="LIVE"
            iconBg="bg-success/10"
            iconColor="text-emerald-600 dark:text-emerald-400"
            badgeClass="badge-live"
          />

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {nowListeningData?.length > 0 ? (
                nowListeningData
                  .slice(0, 5)
                  .map((item, i) => (
                    <NowListeningRow key={item._id} item={item} index={i} />
                  ))
              ) : (
                <EmptyState icon={Headphones} label="No active listeners" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingTracks;
