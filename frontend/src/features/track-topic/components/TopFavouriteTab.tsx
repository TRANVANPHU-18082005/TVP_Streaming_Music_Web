import { useMemo } from "react";

import { ITrack, useTopFavouriteTracksInfinite } from "@/features/track";
import { APP_CONFIG } from "@/config/constants";
import { TrackTabPanel } from "./TrackTabPanel";

// ─────────────────────────────────────────────────────────────────────────────
// TOP FAVOURITE TAB
// ─────────────────────────────────────────────────────────────────────────────

interface TopFavouriteTabProps {
  moodColor: string;
  isOffline: boolean;
}

export function TopFavouriteTab({
  moodColor,
  isOffline,
}: TopFavouriteTabProps) {
  const { data, isLoading, error, refetch } = useTopFavouriteTracksInfinite(
    APP_CONFIG.PAGINATION_LIMIT,
  );

  const tracks = useMemo<ITrack[]>(
    () => data?.allTracks ?? [],
    [data?.allTracks],
  );
  const totalItems = data?.totalItems ?? 0;

  return (
    <TrackTabPanel
      tracks={tracks}
      totalItems={totalItems}
      isLoading={isLoading}
      error={error as Error | null}
      refetch={refetch}
      moodColor={moodColor}
      isOffline={isOffline}
      source={{
        id: "home_top_favourite",
        type: "mostLiked",
        title: "Bài hát yêu thích",
      }}
    />
  );
}
export default TopFavouriteTab;
