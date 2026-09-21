import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Calendar, CalendarDays, CalendarRange } from "lucide-react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTabSwipe } from "@/hooks/Usetabswipe";
import SectionAmbient from "@/components/SectionAmbient";
import { makeTabVariants } from "@/features/track-topic";
import { ChartItem } from "@/features/track/components/ChartItem";
import { TrackSkeleton } from "@/features/track";
import { useTopSeven } from "@/features/track/hooks/useTopSeven";
import { cn } from "@/lib/utils";

type TopSevenPeriod = "day" | "week" | "month";

interface TabConfig {
  id: TopSevenPeriod;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  wave: string;
}

const TABS: TabConfig[] = [
  {
    id: "day",
    label: "Hôm nay",
    shortLabel: "D",
    icon: <Calendar className="size-3.5" aria-hidden="true" />,
    wave: "--wave-1",
  },
  {
    id: "week",
    label: "Tuần này",
    shortLabel: "W",
    icon: <CalendarDays className="size-3.5" aria-hidden="true" />,
    wave: "--wave-2",
  },
  {
    id: "month",
    label: "Tháng này",
    shortLabel: "M",
    icon: <CalendarRange className="size-3.5" aria-hidden="true" />,
    wave: "--wave-3",
  },
];

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

export function TopSevenSection() {
  const [activeTab, setActiveTab] = useState<TopSevenPeriod>("day");
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const isOffline = !useOnlineStatus();

  const { data, isLoading } = useTopSeven(activeTab);
  const tracks = data?.data || [];

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!;
  const moodColor = `var(${activeTabConfig.wave})`;

  // ── Edge detection ────────────────────────────────────────────────────────
  const currentIndex = TABS.findIndex((t) => t.id === activeTab);
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= TABS.length - 1;

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateToTab = useCallback(
    (tab: TopSevenPeriod, direction?: 1 | -1) => {
      if (tab === activeTab) return;
      const currentIdx = TABS.findIndex((t) => t.id === activeTab);
      const nextIdx = TABS.findIndex((t) => t.id === tab);
      setSwipeDirection(direction ?? (nextIdx > currentIdx ? 1 : -1));
      setActiveTab(tab);
    },
    [activeTab],
  );

  const handleSwipe = useCallback(
    (direction: 1 | -1) => {
      const idx = TABS.findIndex((t) => t.id === activeTab);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= TABS.length) return;
      setSwipeDirection(direction);
      setActiveTab(TABS[nextIdx].id);
    },
    [activeTab],
  );

  const { containerRef, dragX, onTouchStart, onTouchEnd } = useTabSwipe({
    onSwipe: handleSwipe,
    enabled: !isOffline,
    atStart,
    atEnd,
  });

  const tabVariants = makeTabVariants(swipeDirection);

  // ── Render Helpers ────────────────────────────────────────────────────────
  const renderRow = (track: any, index: number) => {
    return (
      <motion.div
        key={track._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, ease: EASE_EXPO }}
      >
        <ChartItem track={track} rank={index + 1} />
      </motion.div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <TrackSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (!tracks.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="size-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Chưa có đủ dữ liệu xếp hạng</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {tracks.map((track, idx) => renderRow(track, idx))}
      </div>
    );
  };

  if (!isLoading && tracks.length === 0 && activeTab === "day") return null;

  return (
    <>
      <div
        className="block h-px transition-all duration-500"
        style={{
          background: `linear-gradient(
            to right,
            transparent,
            hsl(var(${activeTabConfig.wave}) / 0.3) 30%,
            hsl(var(${activeTabConfig.wave}) / 0.28) 70%,
            transparent
          )`,
          boxShadow: `0 0 8px hsl(var(${activeTabConfig.wave}) / 0.1)`,
        }}
      />

      <section
        className="section-block section-block--alt relative overflow-hidden transition-colors duration-300"
        aria-labelledby="top-seven-heading"
      >
        <SectionAmbient
          key={activeTab}
          style={activeTabConfig.wave.replace("--", "") as any}
        />

        <div className="section-container relative z-[1]">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-7 sm:mb-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center size-6 rounded-md transition-colors duration-300"
                    style={{
                      background: `hsl(var(${activeTabConfig.wave}) / 0.12)`,
                      color: `hsl(var(${activeTabConfig.wave}))`,
                    }}
                  >
                    <Trophy className="size-3.5" />
                  </div>
                  <motion.span
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-overline transition-colors duration-300"
                    style={{ color: `hsl(var(${activeTabConfig.wave}))` }}
                  >
                    Bảng xếp hạng
                  </motion.span>
                </div>

                <h2
                  className="text-section-title text-foreground leading-tight"
                  id="top-seven-heading"
                >
                  Top 7{" "}
                  <motion.span
                    key={activeTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE_EXPO }}
                    className="inline-block transition-colors duration-300"
                    style={{ color: `hsl(var(${activeTabConfig.wave}))` }}
                  >
                    {activeTabConfig.label}
                  </motion.span>
                </h2>
              </div>
            </div>

            {/* Chip tabs */}
            <div
              role="tablist"
              className={cn(
                "flex items-center gap-1.5 p-1 rounded-full w-fit",
                "bg-muted/50 border border-border/50",
              )}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const waveColor = `hsl(var(${tab.wave}))`;
                const isMobile = window.innerWidth < 768;

                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => navigateToTab(tab.id)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full",
                      "text-sm font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "select-none",
                      isActive
                        ? "text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    style={
                      isActive ? { background: waveColor } : { background: "transparent" }
                    }
                  >
                    {isActive && (
                      <motion.span
                        layoutId="top-seven-chip-active"
                        className="absolute inset-0 rounded-full"
                        style={{ background: waveColor }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}

                    <span className="relative z-[1] flex items-center gap-1.5">
                      {tab.icon}
                      {isMobile ? tab.shortLabel : tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                role="tabpanel"
                style={{ x: dragX }}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
}

export default TopSevenSection;
