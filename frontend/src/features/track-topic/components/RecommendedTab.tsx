import { useMemo } from "react";

import { ITrack, useRecommendedTracks } from "@/features/track";
import { APP_CONFIG } from "@/config/constants";
import { TrackTabPanel } from "./TrackTabPanel";

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDED TAB
// ─────────────────────────────────────────────────────────────────────────────

interface RecommendedTabProps {
  moodColor: string;
  isOffline: boolean;
}

function RecommendedTab({ moodColor, isOffline }: RecommendedTabProps) {
  const { data, isLoading, error, refetch } = useRecommendedTracks(
    APP_CONFIG.PAGINATION_LIMIT,
  );

  const tracks = useMemo<ITrack[]>(() => data ?? [], [data]);

  return (
    <TrackTabPanel
      tracks={tracks}
      totalItems={tracks.length}
      isLoading={isLoading}
      error={error as Error | null}
      refetch={refetch}
      moodColor={moodColor}
      isOffline={isOffline}
      source={{
        id: "home_recommended",
        type: "suggestions",
        title: "Bài hát gợi ý cho bạn",
      }}
    />
  );
}
export default RecommendedTab;
