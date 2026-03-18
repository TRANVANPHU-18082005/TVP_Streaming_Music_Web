import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  BarChart2,
  Flame,
  Globe2,
  Info,
  TrendingUp,
} from "lucide-react";
import { useRealtimeChart } from "@/features/track/hooks/useRealtimeChart";
import { ChartItem } from "@/features/track/components/ChartItem";
import { ChartLine } from "@/features/track/components/ChartLine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ITrack } from "@/features/track/types";

// ─── Constants ───────────────────────────────────────────────────────────────
const INITIAL_VISIBLE = 10;

const RANK_STYLES = [
  { border: "border-amber-400", dot: "bg-amber-400", label: "#1" },
  { border: "border-slate-400", dot: "bg-slate-400", label: "#2" },
  { border: "border-orange-500", dot: "bg-orange-500", label: "#3" },
] as const;

// ─── Animation presets ────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
});

const listItem = (index: number) => ({
  layout: true as const,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98 },
  transition: {
    type: "spring" as const,
    stiffness: 480,
    damping: 30,
    delay: Math.min(index * 0.025, 0.35),
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

const TrackSkeleton = ({ i }: { i: number }) => (
  <div
    className="flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/40 animate-pulse"
    style={{ animationDelay: `${i * 60}ms` }}
  >
    <div className="w-6 h-4 rounded bg-muted/70 shrink-0" />
    <div className="w-10 h-10 rounded-xl bg-muted/70 shrink-0" />
    <div className="flex-1 space-y-2 min-w-0">
      <div className="h-3 w-2/5 rounded-full bg-muted/70" />
      <div className="h-2.5 w-1/4 rounded-full bg-muted/50" />
    </div>
    <div className="w-14 h-2.5 rounded-full bg-muted/50 hidden sm:block" />
    <div className="w-8 h-2.5 rounded-full bg-muted/40 hidden md:block" />
  </div>
);

const PageLoader = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5">
    <div className="relative w-14 h-14">
      <div className="absolute inset-0 rounded-full border-2 border-primary/15 animate-ping" />
      <div className="w-14 h-14 rounded-full border-2 border-primary/25 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
    <div className="text-center space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-foreground">
        Loading Charts
      </p>
      <p className="text-xs text-muted-foreground">Fetching real-time data…</p>
    </div>
  </div>
);

// ─── Top-3 Leader Avatars ─────────────────────────────────────────────────────
const LeaderAvatars = ({ tracks }: { tracks: ITrack[] }) => {
  if (tracks.length < 3) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Top 3
      </span>
      <div className="flex -space-x-2">
        {tracks.slice(0, 3).map((t, i) => (
          <div
            key={t._id}
            className="relative"
            style={{ zIndex: 3 - i }}
            title={`#${i + 1} ${t.title}`}
          >
            <img
              src={t.coverImage}
              alt={t.title}
              className={cn(
                "w-8 h-8 rounded-full border-2 border-background object-cover",
                "shadow-sm transition-transform duration-200 hover:scale-110 hover:z-10 cursor-pointer",
                RANK_STYLES[i].border,
              )}
            />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full",
                "flex items-center justify-center text-[7px] font-black text-white border border-background",
                RANK_STYLES[i].dot,
              )}
              aria-hidden
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Live Badge ───────────────────────────────────────────────────────────────
const LiveBadge = ({ time }: { time: string }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-bold uppercase tracking-widest text-primary">
    <span className="relative flex h-1.5 w-1.5" aria-hidden>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
    </span>
    Live · {time}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const TopChartPage = () => {
  const { tracks, chartData, prevRankMap, isLoading, isUpdating } =
    useRealtimeChart();
  const [showAll, setShowAll] = useState(false);

  // Memoize: only re-compute when tracks changes (not every render)
  const lastUpdated = useMemo(
    () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks.length],
  );

  const visibleTracks = showAll ? tracks : tracks.slice(0, INITIAL_VISIBLE);
  const hasMore = tracks.length > INITIAL_VISIBLE && !showAll;

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-32">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-10 md:pt-16 md:pb-12 overflow-hidden">
        {/* Ambient glow — light mode: very subtle, dark mode: visible */}
        <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,100%)] h-64
                          bg-primary/8 dark:bg-primary/12 blur-[80px] rounded-full"
          />
          {/* Grid texture */}
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)/1) 1px, transparent 1px)," +
                "linear-gradient(90deg, hsl(var(--foreground)/1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Live badge */}
          <motion.div {...fadeUp(0)} className="flex justify-center mb-6">
            <LiveBadge time={lastUpdated} />
          </motion.div>

          {/* Title */}
          <motion.div {...fadeUp(0.07)} className="text-center mb-10">
            <h1 className="text-[clamp(3rem,10vw,6rem)] font-black tracking-tighter leading-[0.9] mb-3 select-none">
              <span
                className="
                text-transparent bg-clip-text
                bg-gradient-to-r from-violet-500 via-primary to-pink-500
                dark:from-violet-400 dark:via-primary dark:to-pink-400
              "
              >
                #Charts
              </span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base font-medium max-w-sm mx-auto leading-relaxed">
              Những bài hát được nghe nhiều nhất, cập nhật theo thời gian thực.
            </p>
          </motion.div>

          {/* Chart card */}
          <motion.div {...fadeUp(0.14)}>
            <div
              className="
              rounded-2xl border border-border bg-card overflow-hidden
              shadow-lg shadow-black/6 dark:shadow-black/35
              ring-1 ring-border/50
            "
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 dark:bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground leading-tight">
                      24H Performance
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Real-time listening trends
                    </p>
                  </div>
                </div>

                <LeaderAvatars tracks={tracks} />
              </div>

              {/* Chart body */}
              <div className="p-4 sm:p-5">
                <ChartLine data={chartData} tracks={tracks} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TRACK LIST ────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-2">
        {/* List header */}
        <motion.div
          {...fadeUp(0.2)}
          className="flex items-center justify-between mb-5"
        >
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-orange-500 dark:text-orange-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Top {tracks.length || 100}
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/70 border border-border">
              <Globe2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Vietnam
              </span>
            </div>
            {/* Updating indicator inline */}
            <AnimatePresence>
              {isUpdating && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-[10px] font-semibold text-primary">
                    Updating
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs font-semibold h-8 gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quy tắc xếp hạng</span>
            <span className="sm:hidden">Rules</span>
          </Button>
        </motion.div>

        {/* List */}
        <div
          className={cn(
            "flex flex-col gap-1.5 transition-opacity duration-300",
            isUpdating && "opacity-55 pointer-events-none select-none",
          )}
        >
          {isLoading ? (
            Array.from({ length: INITIAL_VISIBLE }).map((_, i) => (
              <TrackSkeleton key={i} i={i} />
            ))
          ) : tracks.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleTracks.map((track: ITrack, index: number) => {
                const rank = index + 1;
                const prevRank = prevRankMap[track._id] ?? rank;
                return (
                  <motion.div key={track._id} {...listItem(index)}>
                    <ChartItem track={track} rank={rank} prevRank={prevRank} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Show more / Show less */}
        <AnimatePresence>
          {!isLoading && tracks.length > INITIAL_VISIBLE && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mt-8 flex justify-center"
            >
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowAll((v) => !v)}
                className="
                  rounded-full px-8 h-11 font-bold text-xs uppercase tracking-widest gap-2
                  border-border bg-card hover:bg-muted
                  shadow-sm hover:shadow-md transition-all duration-200
                "
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {hasMore ? `View all ${tracks.length} tracks` : "Show less"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <BarChart2 className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-foreground font-semibold text-sm">Chưa có dữ liệu</p>
        <p className="text-muted-foreground text-xs max-w-xs leading-relaxed">
          Bảng xếp hạng sẽ xuất hiện khi có đủ dữ liệu lượt nghe.
        </p>
      </div>
    </div>
  );
}
