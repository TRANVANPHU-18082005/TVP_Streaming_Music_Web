import { APP_CONFIG } from "@/config/constants";
import { useTopHotTracksInfinite } from "@/features/track/hooks/useTracksQuery";

/** Expose track count so TrackSection can compute hasDataMap without prop drilling. */
export function useTopHotTabData() {
  const { data, isLoading } = useTopHotTracksInfinite(
    APP_CONFIG.PAGINATION_LIMIT,
  );
  return { count: data?.totalItems ?? 0, isLoading };
}
