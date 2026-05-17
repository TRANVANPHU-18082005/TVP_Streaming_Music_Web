import { APP_CONFIG } from "@/config/constants";
import { useTopFavouriteTracksInfinite } from "@/features/track/hooks/useTracksQuery";

/** Expose track count so TrackSection can compute hasDataMap without prop drilling. */
export function useTopFavouriteTabData() {
  const { data, isLoading } = useTopFavouriteTracksInfinite(
    APP_CONFIG.PAGINATION_LIMIT,
  );
  return { count: data?.totalItems ?? 0, isLoading };
}
