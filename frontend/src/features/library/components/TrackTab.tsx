import { memo, useMemo } from "react";

import { ITrack, TrackList } from "@/features/track";
import { QueueSourceType } from "@/features/player/slice/playerSlice";
import { APP_CONFIG } from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK TAB
// ─────────────────────────────────────────────────────────────────────────────

interface TrackTabProps {
  allTracks: ITrack[];
  totalItems: number;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  moodColor: string;
}

export const TrackTab = memo(
  ({
    allTracks,
    totalItems,
    isLoading,
    error,
    onRetry,
    moodColor,
  }: TrackTabProps) => {
    const trackIds = useMemo(() => allTracks.map((t) => t._id), [allTracks]);

    const trackListProps = useMemo(
      () => ({
        allTrackIds: trackIds,
        tracks: allTracks,
        totalItems,
        isLoading,
        error,
        isFetchingNextPage: false,
        hasNextPage: false,
        onFetchNextPage: () => {},
        onRetry,
        source: {
          id: "library_favourite_tracks",
          type: "likedTracks" as QueueSourceType,
          title: "Yêu thích",
        },
      }),
      [trackIds, allTracks, totalItems, isLoading, error, onRetry],
    );

    return (
      <TrackList
        {...trackListProps}
        maxHeight={400}
        moodColor={moodColor}
        skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
        staggerAnimation={true}
      />
    );
  },
);
TrackTab.displayName = "TrackTab";
export default TrackTab;
