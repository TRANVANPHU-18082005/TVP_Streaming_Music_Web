import { useCallback, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setQueue, setIsPlaying, QueueSourceType } from "../slice/playerSlice";
import { ITrack } from "@/features/track/types";

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
        // Chiết xuất danh sách tracks
        if (Array.isArray(root)) {
          tracks = root;
        } else {
          tracks = root.tracks ?? root.items ?? root.data ?? root.songs ?? [];
        }

        const title =
          collectionName ?? root.title ?? root.name ?? "Danh sách mới";

        // Chiết xuất danh sách IDs
        const trackIds =
          root.trackIds || root.artist?.trackIds
            ? (root.trackIds ?? root.artist?.trackIds)
            : tracks
                .map((t: any) => (typeof t === "string" ? t : t?._id))
                .filter(Boolean);

        if (!trackIds || trackIds.length === 0) {
          throw new Error("Không có bài hát nào trong danh sách này.");
        }

        // DISPATCH VÀO STORE VỚI ĐẦY ĐỦ SOURCE CONTEXT
        dispatch(
          setQueue({
            trackIds,
            // Nếu là bài hát (object) thì nạp vào cache, nếu là string ID thì bỏ qua
            initialMetadata: typeof tracks[0] === "object" ? tracks : [],
            startIndex,
            isShuffling: shuffle, // 🔥 Truyền trạng thái shuffle vào Reducer
            source: {
              id: root._id || root.artist?._id,
              type: sourceType,
              title:
                root.title ||
                root.name ||
                root.artist?.name ||
                root.artist?.title ||
                collectionName ||
                "Danh sách phát",
              // Tự động thêm chữ 's' vào sourceType để match với route (ví dụ: /albums/, /playlists/)
              url: `/${sourceType}s/${root.slug || root._id}`,
            },
          }),
        );

        dispatch(setIsPlaying(true));
        toast.success(`Đang phát: ${title}`, { id: toastId });

        if (onSuccess) onSuccess(root);
      } catch (err: any) {
        if (err.name === "AbortError") return;

        console.error("[PlayCollection Global Error]", err);
        const errorMsg =
          err?.response?.data?.message ||
          "Không thể tải nội dung. Vui lòng thử lại.";
        toast.error(errorMsg, { id: toastId });

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
