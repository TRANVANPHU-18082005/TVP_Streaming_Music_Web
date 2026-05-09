import { memo, useMemo } from "react";
import { useFavouriteTracksInfinite } from "@/features/profile/hooks/useProfileQuery";
import { useSyncInteractionsPaged } from "@/features/interaction/hooks/useSyncInteractionsPaged";
import { APP_CONFIG } from "@/config/constants";
import { MusicResult } from "@/components/ui/Result";
import { ITrack, TrackList } from "@/features/track";

const FavouriteTrackList = memo(() => {
  const {
    data: tracksData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useFavouriteTracksInfinite();

  const allTracks = useMemo(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );
  const totalItems = useMemo(
    () => tracksData?.totalItems ?? 0,
    [tracksData?.totalItems],
  );
  const allTrackIds = useMemo(
    () => allTracks.map((t: ITrack) => t._id),
    [allTracks],
  );

  useSyncInteractionsPaged(tracksData?.allTracks, "like", "track", !isLoading);

  const trackListProps = useMemo(
    () => ({
      allTrackIds,
      tracks: allTracks,
      totalItems,
      isLoading,
      error: error as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetch,
    }),
    [
      allTrackIds,
      allTracks,
      totalItems,
      isLoading,
      error,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetch,
    ],
  );

  if (!isLoading && totalItems === 0) {
    return (
      <MusicResult
        variant="empty-tracks"
        title="Chưa có bài đã thích"
        description="Bài hát bạn thích sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <TrackList
      {...trackListProps}
      moodColor="var(--primary)"
      maxHeight={200}
      skeletonCount={APP_CONFIG.PAGINATION_LIMIT} // nhiều hơn để fill viewport lúc đầu
      staggerAnimation={true}
    />
  );
});

export default FavouriteTrackList;
