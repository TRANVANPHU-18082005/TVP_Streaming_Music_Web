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

      // Sử dụng Thunk dispatch để lấy state tươi nhất một cách đồng bộ
      dispatch((_dispatch, getState) => {
        const state = getState();

        // 🚀 CHỐT CHẶN BIẾN CỐ: Nếu ID này đang trong quá trình xử lý API, bỏ qua lượt click này
        if (state.interaction.loadingIds[`${targetType}:${id}`]) return;

        const maps = {
          track: "likedTracks",
          album: "likedAlbums",
          playlist: "likedPlaylists",
          artist: "followedArtists",
        } as const;

        const wasInteracted = !!state.interaction[maps[targetType]][id];

        // 1. UI phản hồi ngay lập tức cho người dùng cảm giác mượt mà
        dispatch(toggleOptimistic({ id, targetType }));

        // 2. Kích hoạt trạng thái Loading để khóa nút bấm chống spam
        dispatch(setInteractionLoading({ id, targetType, isLoading: true }));

        // 3. Xử lý API tách biệt ra luồng riêng
        (async () => {
          try {
            if (targetType === "artist") {
              await interactionApi.toggleFollow(id);
            } else {
              await interactionApi.toggleLike(id, targetType);
            }
          } catch (error) {
            handleError(error, "Cập nhật tương tác thất bại");

            // 4. Rollback chính xác về trạng thái nguyên bản trước khi click nếu API sập
            dispatch(
              setInteractionStatus({ id, targetType, status: wasInteracted }),
            );
            toast.error("Không thể cập nhật yêu thích");
          } finally {
            // Giải phóng trạng thái Loading để người dùng có thể thao tác lượt tiếp theo
            dispatch(
              setInteractionLoading({ id, targetType, isLoading: false }),
            );
          }
        })();
      });
    },
    [dispatch, user],
  );

  return { handleToggle };
};
