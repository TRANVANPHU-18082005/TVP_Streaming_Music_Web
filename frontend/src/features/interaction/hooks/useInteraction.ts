// src/features/interaction/hooks/useInteraction.ts
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import interactionApi from "../api/interactionApi";
import {
  toggleOptimistic,
  setInteractionStatus,
  setInteractionLoading,
  InteractionTargetType,
} from "../slice/interactionSlice";
import { handleError } from "@/utils/handleError";

export const useInteraction = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleToggle = useCallback(
    async (id: string, targetType: InteractionTargetType) => {
      if (!user) return toast.error("Vui lòng đăng nhập!");

      // 🚀 Kỹ thuật: Truy cập Store trực tiếp qua Thunk dispatch để lấy state mới nhất
      // mà không cần đưa state vào dependency array của useCallback
      dispatch((_dispatch, getState) => {
        const state = getState();
        const maps = {
          track: "likedTracks",
          album: "likedAlbums",
          playlist: "likedPlaylists",
          artist: "followedArtists",
        } as const;
        const wasInteracted = !!state.interaction[maps[targetType]][id];

        // 1. UI phản hồi ngay lập tức
        dispatch(toggleOptimistic({ id, targetType }));

        // 2. Xử lý API async tách biệt
        (async () => {
          try {
            dispatch(setInteractionLoading({ id, isLoading: true }));
            if (targetType === "artist") await interactionApi.toggleFollow(id);
            else await interactionApi.toggleLike(id, targetType);
          } catch (error) {
            handleError(error, "Cập nhật tương tác thất bại");
            // 3. Rollback chính xác nếu lỗi
            dispatch(
              setInteractionStatus({ id, targetType, status: wasInteracted }),
            );
            toast.error("Không thể cập nhật yêu thích");
          } finally {
            dispatch(setInteractionLoading({ id, isLoading: false }));
          }
        })();
      });
    },
    [dispatch, user],
  );

  return { handleToggle };
};
