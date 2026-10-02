import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import trackApi from "@/features/track/api/trackApi";
import type { RankedTrack } from "@/features/track/hooks/useRealtimeChart";

export const HOME_CHART_QUERY_KEY = ["home-featured-chart"] as const;

/** One-shot chart for the homepage. Does not join the live chart socket. */
export function useHomeChart() {
  const query = useQuery({
    queryKey: HOME_CHART_QUERY_KEY,
    queryFn: trackApi.getRealtimeChart,
    staleTime: 60 * 1000,
  });

  const tracks = useMemo((): RankedTrack[] => {
    const items = query.data?.data?.items ?? [];
    return items.map((track, index) => ({
      ...track,
      rank: index + 1,
      trend: "same" as const,
      rankDelta: 0,
    }));
  }, [query.data]);

  return {
    tracks,
    isLoading: query.isLoading,
    isUpdating: false,
    error: query.error,
    refetch: query.refetch,
  };
}
