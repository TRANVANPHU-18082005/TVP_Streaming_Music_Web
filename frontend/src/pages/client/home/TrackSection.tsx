import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTabSwipe } from "@/hooks/Usetabswipe";
import SectionAmbient from "@/components/SectionAmbient";
import {
  makeTabVariants,
  TabConfig,
  TrackSectionHeader,
  TrackTab,
  useRecommendedTabData,
  useTopFavouriteTabData,
  useTopHotTabData,
} from "@/features/track-topic";
const TopHotTab = lazy(
  () => import("@/features/track-topic/components/TopHotTab"),
);
const RecommendedTab = lazy(
  () => import("@/features/track-topic/components/RecommendedTab"),
);
const TopFavouriteTab = lazy(
  () => import("@/features/track-topic/components/TopFavouriteTab"),
);

import { Flame, Heart, Sparkles } from "lucide-react";
import { SwipeDots } from "@/features/track-topic/components/TrackSectionHeader";
import { TrackSkeleton } from "@/features/track";

const TABS: TabConfig[] = [
  {
    id: "recommended",
    label: "Gợi ý",
    shortLabel: "",
    icon: <Sparkles className="size-3.5" aria-hidden="true" />,
    wave: "--wave-1",
    viewAllHref: "/discover?tab=recommended",
    viewAllLabel: "Xem tất cả bài hát gợi ý",
  },
  {
    id: "top_hot",
    label: "Thịnh hành",
    shortLabel: "",
    icon: <Flame className="size-3.5" aria-hidden="true" />,
    wave: "--wave-4",
    viewAllHref: "/charts?tab=hot",
    viewAllLabel: "Xem tất cả bài hát thịnh hành",
  },
  {
    id: "top_favourite",
    label: "Yêu thích nhất",
    shortLabel: "",
    icon: <Heart className="size-3.5" aria-hidden="true" />,
    wave: "--wave-3",
    viewAllHref: "/charts?tab=favourite",
    viewAllLabel: "Xem tất cả bài hát yêu thích nhất",
  },
];
// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT STYLE MAP
// ─────────────────────────────────────────────────────────────────────────────

const AMBIENT_STYLE: Record<TrackTab, "wave-1" | "wave-4" | "wave-3"> = {
  recommended: "wave-1",
  top_hot: "wave-4",
  top_favourite: "wave-3",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TrackSection() {
  // ── Counts from each tab (no prop drilling, hooks deduplicate requests) ───

  const { count: recommendedCount, isLoading: isLoadingRecommended } =
    useRecommendedTabData();
  const { count: topHotCount, isLoading: isLoadingTopHot } = useTopHotTabData();
  const { count: topFavouriteCount, isLoading: isLoadingTopFavourite } =
    useTopFavouriteTabData();

  // ── Derived visibility map ────────────────────────────────────────────────

  const hasDataMap = useMemo<Record<TrackTab, boolean>>(
    () => ({
      recommended: recommendedCount > 0,
      top_hot: topHotCount > 0,
      top_favourite: topFavouriteCount > 0,
    }),
    [recommendedCount, topHotCount, topFavouriteCount],
  );

  const visibleTabs = useMemo(
    () => TABS.filter((t) => hasDataMap[t.id]),
    [hasDataMap],
  );

  // ── Tab state ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TrackTab>("recommended");
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  // Fall back to first visible tab if active tab has no data yet
  const resolvedTab = useMemo<TrackTab>(() => {
    if (!hasDataMap[activeTab]) return visibleTabs[0]?.id ?? "recommended";
    return activeTab;
  }, [activeTab, hasDataMap, visibleTabs]);

  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;
  const moodColor = `var(${activeTabConfig.wave})`;

  // ── Edge detection ────────────────────────────────────────────────────────

  const currentIndex = visibleTabs.findIndex((t) => t.id === resolvedTab);
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= visibleTabs.length - 1;

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateToTab = useCallback(
    (tab: TrackTab, direction?: 1 | -1) => {
      if (tab === resolvedTab) return;
      const currentIdx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = visibleTabs.findIndex((t) => t.id === tab);
      setSwipeDirection(direction ?? (nextIdx > currentIdx ? 1 : -1));
      setActiveTab(tab);
    },
    [resolvedTab, visibleTabs],
  );

  const handleSwipe = useCallback(
    (direction: 1 | -1) => {
      const idx = visibleTabs.findIndex((t) => t.id === resolvedTab);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= visibleTabs.length) return;
      setSwipeDirection(direction);
      setActiveTab(visibleTabs[nextIdx].id);
    },
    [resolvedTab, visibleTabs],
  );

  const isOffline = !useOnlineStatus();

  const { containerRef, dragX, onTouchStart, onTouchEnd } = useTabSwipe({
    onSwipe: handleSwipe,
    enabled: !isOffline,
    atStart,
    atEnd,
  });

  // ── Early exit ────────────────────────────────────────────────────────────

  const allLoading =
    isLoadingRecommended && isLoadingTopHot && isLoadingTopFavourite;
  const allEmpty =
    !allLoading &&
    recommendedCount === 0 &&
    topHotCount === 0 &&
    topFavouriteCount === 0;

  if (allEmpty) return null;

  // ── Tab content ───────────────────────────────────────────────────────────

  const renderTab = () => {
    const sharedProps = { moodColor, isOffline };
    if (resolvedTab === "recommended")
      return (
        <>
          <Suspense fallback={<TrackSkeleton />}>
            <RecommendedTab {...sharedProps} />
          </Suspense>
        </>
      );

    if (resolvedTab === "top_hot")
      return (
        <>
          <Suspense fallback={<TrackSkeleton />}>
            <TopHotTab {...sharedProps} />
          </Suspense>
        </>
      );

    if (resolvedTab === "top_favourite")
      return (
        <>
          <Suspense fallback={<TrackSkeleton />}>
            <TopFavouriteTab {...sharedProps} />
          </Suspense>
        </>
      );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const tabVariants = makeTabVariants(swipeDirection);

  return (
    <>
      {/* Wave-tinted section divider */}
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
        aria-labelledby="track-section-heading"
      >
        <SectionAmbient key={resolvedTab} style={AMBIENT_STYLE[resolvedTab]} />

        <div className="section-container relative z-[1]">
          <TrackSectionHeader
            activeTab={resolvedTab}
            tabs={TABS}
            hasDataMap={hasDataMap}
            onTabChange={navigateToTab}
          />

          <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={resolvedTab}
                role="tabpanel"
                id={`track-panel-${resolvedTab}`}
                aria-labelledby={`track-tab-${resolvedTab}`}
                style={{ x: dragX }}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </div>

          <SwipeDots
            activeTab={resolvedTab}
            tabs={TABS}
            hasDataMap={hasDataMap}
            onDotClick={navigateToTab}
          />
        </div>
      </section>
    </>
  );
}

export default TrackSection;
