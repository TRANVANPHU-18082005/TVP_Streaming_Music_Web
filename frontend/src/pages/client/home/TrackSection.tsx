import { memo, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Flame, Heart } from "lucide-react";

import {
  ITrack,
  TrackList,
  useRecommendedTracks,
  useTopFavouriteTracksInfinite,
  useTopHotTracksInfinite,
} from "@/features/track";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { APP_CONFIG } from "@/config/constants";
import MusicResult from "@/components/ui/Result";
import SectionAmbient from "@/components/SectionAmbient";
import { cn } from "@/lib/utils";
import { useTabSwipe } from "@/hooks/Usetabswipe";
import { QueueSourceType } from "@/features/player/slice/playerSlice";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TrackTab = "recommended" | "top_hot" | "top_favourite";

interface TabConfig {
  id: TrackTab;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  wave: string;
  viewAllHref: string;
  viewAllLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

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
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const makeTabVariants = (direction: number) => ({
  initial: { opacity: 0, x: direction * 44 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
  exit: {
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.18, ease: EASE_EXPO },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const TrackSkeleton = memo(() => (
  <div className="flex flex-col gap-1" role="status" aria-busy="true">
    {Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        aria-hidden="true"
      >
        <div className="skeleton w-[52px] shrink-0 h-8 rounded-full" />
        <div className="skeleton w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 min-w-0">
          <div
            className="skeleton h-3.5 rounded-full"
            style={{ width: `${40 + (i % 3) * 12}%` }}
          />
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: `${24 + (i % 4) * 8}%` }}
          />
        </div>
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
      </div>
    ))}
  </div>
));
TrackSkeleton.displayName = "TrackSkeleton";

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

const SwipeDots = memo(
  ({
    tabs,
    activeTab,
    hasDataMap,
    onDotClick,
  }: {
    tabs: TabConfig[];
    activeTab: TrackTab;
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
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

const TrackSectionHeader = memo(
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TRACK LIST PROPS BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms raw fetch results into the shape expected by <TrackList>.
 * Centralises the mapping so each tab panel stays lean.
 */
function buildTrackListProps({
  tracks,
  totalItems,
  isLoading,
  error,
  refetch,
}: {
  tracks: ITrack[];
  totalItems: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}) {
  return {
    allTrackIds: tracks.map((t) => t._id),
    tracks,
    totalItems,
    isLoading,
    error,
    isFetchingNextPage: false,
    hasNextPage: false,
    onFetchNextPage: () => {},
    onRetry: refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB PANEL (shared render logic per tab)
// ─────────────────────────────────────────────────────────────────────────────

const TrackTabPanel = memo(
  ({
    tracks,
    totalItems,
    isLoading,
    error,
    refetch,
    source,
    moodColor,
    isOffline,
  }: {
    tracks: ITrack[];
    totalItems: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
    source: {
      id: string;
      type: QueueSourceType;
      title: string;
    };
    moodColor: string;
    isOffline: boolean;
  }) => {
    console.log(source);
    if (isLoading) return <TrackSkeleton />;

    if (isOffline) {
      return (
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error-network" onRetry={refetch} />
        </div>
      );
    }

    if (error && tracks.length === 0) {
      return (
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      );
    }

    return (
      <TrackList
        {...buildTrackListProps({
          tracks,
          totalItems,
          isLoading,
          error,
          refetch,
        })}
        source={source}
        moodColor={moodColor}
        maxHeight={400}
        skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
        staggerAnimation
      />
    );
  },
);
TrackTabPanel.displayName = "TrackTabPanel";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TrackSection() {
  // ── Data fetching ────────────────────────────────────────────────────────
  const {
    data: recommendedData,
    isLoading: isLoadingRecommended,
    error: recommendedError,
    refetch: refetchRecommended,
  } = useRecommendedTracks(APP_CONFIG.PAGINATION_LIMIT);

  const {
    data: topHotData,
    isLoading: isLoadingTopHot,
    error: topHotError,
    refetch: refetchTopHot,
  } = useTopHotTracksInfinite(APP_CONFIG.PAGINATION_LIMIT);

  const {
    data: topFavouriteData,
    isLoading: isLoadingTopFavourite,
    error: topFavouriteError,
    refetch: refetchTopFavourite,
  } = useTopFavouriteTracksInfinite(APP_CONFIG.PAGINATION_LIMIT);

  // ── Normalise data ───────────────────────────────────────────────────────

  const recommendedTracks = useMemo<ITrack[]>(
    () => recommendedData ?? [],
    [recommendedData],
  );

  const topHotTracks = useMemo<ITrack[]>(
    () => topHotData?.allTracks ?? [],
    [topHotData?.allTracks],
  );
  const topHotTotal = topHotData?.totalItems ?? 0;

  const topFavouriteTracks = useMemo<ITrack[]>(
    () => topFavouriteData?.allTracks ?? [],
    [topFavouriteData?.allTracks],
  );
  const topFavouriteTotal = topFavouriteData?.totalItems ?? 0;

  // ── Tab visibility ───────────────────────────────────────────────────────

  const hasDataMap = useMemo<Record<TrackTab, boolean>>(
    () => ({
      recommended: recommendedTracks.length > 0,
      top_hot: topHotTotal > 0,
      top_favourite: topFavouriteTotal > 0,
    }),
    [recommendedTracks.length, topHotTotal, topFavouriteTotal],
  );

  const visibleTabs = useMemo(
    () => TABS.filter((t) => hasDataMap[t.id]),
    [hasDataMap],
  );

  // ── Initial tab: first tab with data ────────────────────────────────────

  const initialTab = useMemo<TrackTab>(() => {
    if (recommendedTracks.length) return "recommended";
    if (topHotTotal) return "top_hot";
    if (topFavouriteTotal) return "top_favourite";
    return "recommended";
  }, [recommendedTracks.length, topHotTotal, topFavouriteTotal]);

  const [activeTab, setActiveTab] = useState<TrackTab>(initialTab);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

  // Auto-switch away from an empty tab once data resolves
  const resolvedTab = useMemo<TrackTab>(() => {
    if (!hasDataMap[activeTab]) {
      return visibleTabs[0]?.id ?? "recommended";
    }
    return activeTab;
  }, [activeTab, hasDataMap, visibleTabs]);

  // ── Edge detection ────────────────────────────────────────────────────────

  const currentIndex = visibleTabs.findIndex((t) => t.id === resolvedTab);
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= visibleTabs.length - 1;

  // ── Tab navigation ────────────────────────────────────────────────────────

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

  const activeTabConfig = TABS.find((t) => t.id === resolvedTab)!;
  const moodColor = `var(${activeTabConfig.wave})`;
  console.log("Mood Color for active tab:", moodColor);
  // ── Nothing to show ───────────────────────────────────────────────────────

  const allLoading =
    isLoadingRecommended && isLoadingTopHot && isLoadingTopFavourite;
  const allEmpty =
    !allLoading &&
    recommendedTracks.length === 0 &&
    topHotTotal === 0 &&
    topFavouriteTotal === 0;

  if (allEmpty) return null;

  // ─────────────────────────────────────────────────────────────────────────

  const tabVariants = makeTabVariants(swipeDirection);

  const tabData: Record<
    TrackTab,
    {
      tracks: ITrack[];
      totalItems: number;
      isLoading: boolean;
      error: Error | null;
      refetch: () => void;
      source: {
        id: string;
        type: QueueSourceType;
        title: string;
      };
    }
  > = {
    recommended: {
      tracks: recommendedTracks,
      totalItems: recommendedTracks.length,
      isLoading: isLoadingRecommended,
      error: recommendedError as Error | null,
      refetch: refetchRecommended,
      source: {
        id: "home_recommended",
        type: "suggestions",
        title: "Bài hát gợi ý cho bạn",
      },
    },
    top_hot: {
      tracks: topHotTracks,
      totalItems: topHotTotal,
      isLoading: isLoadingTopHot,
      error: topHotError as Error | null,
      refetch: refetchTopHot,
      source: {
        id: "home_top_hot",
        type: "trending",
        title: "Bài hát hot",
      },
    },
    top_favourite: {
      tracks: topFavouriteTracks,
      totalItems: topFavouriteTotal,
      isLoading: isLoadingTopFavourite,
      error: topFavouriteError as Error | null,
      refetch: refetchTopFavourite,
      source: {
        id: "home_top_favourite",
        type: "mostLiked",
        title: "Bài hát yêu thích",
      },
    },
  };

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
        <SectionAmbient
          key={resolvedTab}
          style={
            resolvedTab === "recommended"
              ? "wave-1"
              : resolvedTab === "top_hot"
                ? "wave-4"
                : "wave-3"
          }
        />

        <div className="section-container relative z-[1]">
          <TrackSectionHeader
            activeTab={resolvedTab}
            tabs={TABS}
            hasDataMap={hasDataMap}
            onTabChange={(tab) => navigateToTab(tab)}
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
                <TrackTabPanel
                  {...tabData[resolvedTab]}
                  moodColor={moodColor}
                  isOffline={isOffline}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <SwipeDots
            tabs={TABS}
            activeTab={resolvedTab}
            hasDataMap={hasDataMap}
            onDotClick={(tab) => navigateToTab(tab)}
          />
        </div>
      </section>
    </>
  );
}

export default TrackSection;
