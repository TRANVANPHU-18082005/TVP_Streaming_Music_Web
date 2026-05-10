import { useCallback, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setQueue, setIsPlaying, QueueSourceType } from "../slice/playerSlice";
import { ITrack } from "@/features/track/types";
import { handleError } from "@/utils/handleError";

interface PlayOptions {
  queryKey: readonly any[];
  fetchFn: () => Promise<any>;
  sourceType: QueueSourceType;
  startIndex?: number;
  collectionName?: string;
  shuffle?: boolean; // 🔥 Thêm flag shuffle để điều khiển logic xáo trộn ngay khi nạp queue
  onSuccess?: (data: any) => void;
  onError?: (err: any) => void;
}

export const usePlayCollection = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);

  // Ref để hủy các request cũ nếu User bấm liên tục
  const abortControllerRef = useRef<AbortController | null>(null);

  const play = useCallback(
    async ({
      queryKey,
      fetchFn,
      sourceType,
      startIndex = 0,
      collectionName,
      shuffle = false, // Mặc định là không shuffle
      onSuccess,
      onError,
    }: PlayOptions) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const toastId = toast.loading("Đang chuẩn bị danh sách phát...");
      setIsFetching(true);

      try {
        const res = await queryClient.fetchQuery({
          queryKey,
          queryFn: fetchFn,
          staleTime: 5 * 60 * 1000,
        });
        const root = res?.data ?? res;
        let tracks: ITrack[] = [];
        let title = "";
        let trackIds: string[] = [];
        let id = "";
        let slug = "";
        if (sourceType === "playlist") {
          tracks = root.tracks ?? [];
          title = root.title ?? "Danh sách mới";
          trackIds = root.trackIds ?? [];
          id = root._id ?? "";
          slug = root.slug ?? "";
        } else if (sourceType === "album") {
          tracks = root.tracks ?? [];
          title = root.title ?? "Album mới";
          trackIds = root.trackIds ?? [];
          id = root._id ?? "";
          slug = root.slug ?? "";
        } else if (sourceType === "artist") {
          tracks = root.topTracks ?? [];
          title = root.name ?? "Nghệ sĩ mới";
          trackIds = root.trackIds ?? [];
          id = root._id ?? "";
          slug = root.slug ?? "";
        } else if (sourceType === "genre") {
          tracks = root.topTracks ?? [];
          title = root.name ?? "Thể loại mới";
          trackIds = root.trackIds ?? [];
          id = root._id ?? "";
          slug = root.slug ?? "";
        }
        if (trackIds.length === 0) {
          throw new Error("Không có bài hát nào trong danh sách này.");
        }
        // DISPATCH VÀO STORE VỚI ĐẦY ĐỦ SOURCE CONTEXT
        dispatch(
          setQueue({
            trackIds,
            // Nếu là bài hát (object) thì nạp vào cache, nếu là string ID thì bỏ qua
            initialMetadata: tracks,
            startIndex,
            isShuffling: shuffle, // 🔥 Truyền trạng thái shuffle vào Reducer
            source: {
              id: id,
              type: sourceType,
              title: collectionName || title,
              // Tự động thêm chữ 's' vào sourceType để match với route (ví dụ: /albums/, /playlists/)
              url: `/${sourceType}s/${sourceType === "playlist" ? id : slug}`,
            },
          }),
        );

        dispatch(setIsPlaying(true));
        toast.success(`Đang phát: ${title}`, { id: toastId });

        if (onSuccess) onSuccess(root);
      } catch (err) {
        handleError(err, "Lỗi khi phát danh sách");

        if (onError) onError(err);
      } finally {
        setIsFetching(false);
        abortControllerRef.current = null;
      }
    },
    [dispatch, queryClient],
  );

  return { play, isFetching };
};
