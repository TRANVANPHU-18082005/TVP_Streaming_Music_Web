// src/features/interaction/hooks/useInteraction.ts
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import interactionApi from "../api/interactionApi";
import {
  toggleLikeOptimistic,
  toggleFollowOptimistic,
  setInteractionLoading,
  selectIsTrackLiked,
  selectIsArtistFollowed,
  selectIsInteractionLoading,
} from "../slice/interactionSlice";
import { handleError } from "@/utils/handleError";

export const useInteraction = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Helper: Chặn hành động nếu chưa login
  const checkAuth = useCallback(() => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thực hiện tính năng này!");
      return false;
    }
    return true;
  }, [user]);

  // --- XỬ LÝ LIKE TRACK ---
  const handleLikeTrack = useCallback(
    async (trackId: string) => {
      if (!checkAuth()) return;

      // 1. UI phản ứng ngay lập tức (Optimistic Update)
      dispatch(toggleLikeOptimistic(trackId));

      try {
        dispatch(setInteractionLoading({ id: trackId, loading: true }));
        // 2. Gọi API ngầm bên dưới
        await interactionApi.toggleLike(trackId);
      } catch (error) {
        handleError(error, "Lỗi khi cập nhật trạng thái yêu thích");
        // 3. Rollback nếu server lỗi
        dispatch(toggleLikeOptimistic(trackId));
      } finally {
        dispatch(setInteractionLoading({ id: trackId, loading: false }));
      }
    },
    [dispatch, checkAuth],
  );

  // --- XỬ LÝ FOLLOW ARTIST ---
  const handleFollowArtist = useCallback(
    async (artistId: string) => {
      if (!checkAuth()) return;

      dispatch(toggleFollowOptimistic(artistId));

      try {
        dispatch(setInteractionLoading({ id: artistId, loading: true }));
        await interactionApi.toggleFollow(artistId);
      } catch (error) {
        handleError(error, "Lỗi khi theo dõi nghệ sĩ");
        dispatch(toggleFollowOptimistic(artistId));
      } finally {
        dispatch(setInteractionLoading({ id: artistId, loading: false }));
      }
    },
    [dispatch, checkAuth],
  );

  return {
    handleLikeTrack,
    handleFollowArtist,
    // Trả về các tiểu hook để component dùng cực gọn
    useIsLiked: (id: string) => useAppSelector(selectIsTrackLiked(id)),
    useIsFollowed: (id: string) => useAppSelector(selectIsArtistFollowed(id)),
    useIsLoading: (id: string) =>
      useAppSelector(selectIsInteractionLoading(id)),
  };
};
