import { memo } from "react";

import { ITrack, TrackList } from "@/features/track";
import { QueueSourceType } from "@/features/player/slice/playerSlice";
import { APP_CONFIG } from "@/config/constants";
import MusicResult from "@/components/ui/Result";
import { buildTrackListProps } from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackTabPanelProps {
  tracks: ITrack[];
  totalItems: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  source: { id: string; type: QueueSourceType; title: string };
  moodColor: string;
  isOffline: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

export const TrackSkeleton = memo(() => (
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
// SHARED TRACK TAB PANEL
// ─────────────────────────────────────────────────────────────────────────────

export const TrackTabPanel = memo(
  ({
    tracks,
    totalItems,
    isLoading,
    error,
    refetch,
    source,
    moodColor,
    isOffline,
  }: TrackTabPanelProps) => {
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
        maxHeight={500}
        skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
        staggerAnimation
      />
    );
  },
);
TrackTabPanel.displayName = "TrackTabPanel";
export default TrackTabPanel;
