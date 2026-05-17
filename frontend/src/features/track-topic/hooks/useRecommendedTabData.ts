import { APP_CONFIG } from "@/config/constants";
import { useRecommendedTracks } from "@/features/track/hooks/useTracksQuery";
import { ITrack } from "@/features/track/types";
import { useMemo } from "react";

/** Expose track count so TrackSection can compute hasDataMap without prop drilling. */
export function useRecommendedTabData() {
  const { data, isLoading } = useRecommendedTracks(APP_CONFIG.PAGINATION_LIMIT);
  const tracks = useMemo<ITrack[]>(() => data ?? [], [data]);
  return { count: tracks.length, isLoading };
}
