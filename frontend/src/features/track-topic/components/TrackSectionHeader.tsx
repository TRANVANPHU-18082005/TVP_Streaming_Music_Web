import { memo } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { EASE_EXPO, type TrackTab, type TabConfig } from "../types/index";

// ─────────────────────────────────────────────────────────────────────────────
// CHIP TAB BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const ChipTab = memo(
  ({
    tab,
    isActive,
    hasData,
    onClick,
  }: {
    tab: TabConfig;
    isActive: boolean;
    hasData: boolean;
    onClick: () => void;
  }) => {
    const waveColor = `hsl(var(${tab.wave}))`;
    if (!hasData) return null;

    return (
      <button
        role="tab"
        aria-selected={isActive}
        aria-controls={`track-panel-${tab.id}`}
        id={`track-tab-${tab.id}`}
        onClick={onClick}
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
            layoutId="track-chip-active"
            className="absolute inset-0 rounded-full"
            style={{ background: waveColor }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}

        <span className="relative z-[1] items-center gap-1.5 hidden md:flex">
          {tab.icon}
          {tab.label}
        </span>
        <span className="relative z-[1] flex items-center gap-1.5 md:hidden">
          {tab.icon}
          {tab.shortLabel}
        </span>

        {!isActive && hasData && (
          <span
            className="relative z-[1] size-1.5 rounded-full shrink-0"
            style={{ background: waveColor, opacity: 0.7 }}
          />
        )}
      </button>
    );
  },
);
ChipTab.displayName = "ChipTab";

// ─────────────────────────────────────────────────────────────────────────────
// SWIPE DOTS
// ─────────────────────────────────────────────────────────────────────────────

export const SwipeDots = memo(
  ({
    activeTab,
    tabs,
    hasDataMap,
    onDotClick,
  }: {
    activeTab: TrackTab;
    tabs: TabConfig[];
    hasDataMap: Record<TrackTab, boolean>;
    onDotClick: (tab: TrackTab) => void;
  }) => {
    const visibleTabs = tabs.filter((t) => hasDataMap[t.id]);
    if (visibleTabs.length < 2) return null;

    return (
      <div
        className="flex items-center justify-center gap-2 mt-5 sm:hidden"
        role="presentation"
        aria-hidden="true"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onDotClick(tab.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              tabIndex={-1}
            >
              <motion.span
                className="block rounded-full"
                animate={{
                  width: isActive ? 20 : 6,
                  height: 6,
                  opacity: isActive ? 1 : 0.35,
                  background: `hsl(var(${tab.wave}))`,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            </button>
          );
        })}
      </div>
    );
  },
);
SwipeDots.displayName = "SwipeDots";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

export const TrackSectionHeader = memo(
  ({
    activeTab,
    tabs,
    hasDataMap,
    onTabChange,
  }: {
    activeTab: TrackTab;
    tabs: TabConfig[];
    hasDataMap: Record<TrackTab, boolean>;
    onTabChange: (tab: TrackTab) => void;
  }) => {
    const activeConfig = tabs.find((t) => t.id === activeTab)!;

    return (
      <div className="flex flex-col gap-4 mb-7 sm:mb-8">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center size-6 rounded-md transition-colors duration-300"
                style={{
                  background: `hsl(var(${activeConfig.wave}) / 0.12)`,
                  color: `hsl(var(${activeConfig.wave}))`,
                }}
              >
                {activeConfig.icon}
              </div>
              <motion.span
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-overline transition-colors duration-300"
                style={{ color: `hsl(var(${activeConfig.wave}))` }}
              >
                Khám phá
              </motion.span>
            </div>

            <h2
              className="text-section-title text-foreground leading-tight"
              id="track-section-heading"
            >
              Bài hát{" "}
              <motion.span
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_EXPO }}
                className="inline-block transition-colors duration-300"
                style={{ color: `hsl(var(${activeConfig.wave}))` }}
              >
                {activeConfig.label}
              </motion.span>
            </h2>
          </div>
        </div>

        {/* Chip tabs */}
        <div
          role="tablist"
          aria-label="Loại danh sách bài hát"
          className={cn(
            "flex items-center gap-1.5 p-1 rounded-full w-fit",
            "bg-muted/50 border border-border/50",
          )}
        >
          {tabs.map((tab) => (
            <ChipTab
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              hasData={hasDataMap[tab.id]}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>
      </div>
    );
  },
);
TrackSectionHeader.displayName = "TrackSectionHeader";
export default TrackSectionHeader;
