import { useMemo } from "react";

import { ITrack, useTopHotTracksInfinite } from "@/features/track";
import { APP_CONFIG } from "@/config/constants";
import { TrackTabPanel } from "./TrackTabPanel";

// ─────────────────────────────────────────────────────────────────────────────
// TOP HOT TAB
// ─────────────────────────────────────────────────────────────────────────────

interface TopHotTabProps {
  moodColor: string;
  isOffline: boolean;
}

export function TopHotTab({ moodColor, isOffline }: TopHotTabProps) {
  const { data, isLoading, error, refetch } = useTopHotTracksInfinite(
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
        id: "home_top_hot",
        type: "trending",
        title: "Bài hát hot",
      }}
    />
  );
}
export default TopHotTab;
