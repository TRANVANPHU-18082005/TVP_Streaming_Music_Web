import { memo, useMemo } from "react";
import { History } from "lucide-react";
import { useRecentlyPlayedInfinite } from "@/features/profile/hooks/useProfileQuery";
import { APP_CONFIG } from "@/config/constants";
import { ITrack, TrackList } from "@/features/track";
import { QueueSourceType } from "@/features/player/slice/playerSlice";

const RecentlyPlayedTrackList = memo(() => {
  const {
    data: tracksData,
    isLoading,
    error,
    refetch,
  } = useRecentlyPlayedInfinite(APP_CONFIG.PAGINATION_LIMIT);

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

  const trackListProps = useMemo(
    () => ({
      allTrackIds,
      tracks: allTracks,
      totalItems,
      isLoading,
      error: error as Error | null,
      isFetchingNextPage: false,
      hasNextPage: false,
      onFetchNextPage: () => {},
      onRetry: refetch,
      source: {
        id: "recently-played",
        type: "recentlyPlayed" as QueueSourceType,
        title: "Nghe gần đây",
        url: `/tracks/history`,
      },
    }),
    [allTrackIds, allTracks, totalItems, isLoading, error, refetch],
  );

  if (!isLoading && totalItems === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center min-h-[180px] gap-3 text-center animate-fade-in py-8">
        <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground/40">
          <History className="size-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">Chưa có lịch sử</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Các bài bạn nghe sẽ xuất hiện ở đây.
        </p>
      </div>
    );
  }

  return (
    <TrackList
      {...trackListProps}
      moodColor={`var(--primary)`}
      maxHeight={500}
      skeletonCount={APP_CONFIG.PAGINATION_LIMIT} // nhiều hơn để fill viewport lúc đầu
      staggerAnimation
    />
  );
});

export default RecentlyPlayedTrackList;
