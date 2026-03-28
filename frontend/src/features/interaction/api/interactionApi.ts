import api from "@/lib/axios";
import { ApiResponse } from "@/types";
import { InteractionTargetType } from "../slice/interactionSlice";
import { BatchCheckResponse } from "../types";

// Interface đồng nhất với Backend Response
export interface ToggleLikeResponse {
  isLiked: boolean;
  targetType: InteractionTargetType;
}

export interface ToggleFollowResponse {
  isFollowed: boolean;
}

const interactionApi = {
  /**
   * 🚀 TOGGLE LIKE (Dùng chung cho Track, Album, Playlist)
   * @route POST /api/v1/interactions/toggle-like
   * @body { targetId, targetType }
   */
  toggleLike: async (targetId: string, targetType: InteractionTargetType) => {
    console.log("Toggling like:", { targetId, targetType });
    const response = await api.post<ApiResponse<ToggleLikeResponse>>(
      `/interactions/toggle-like`,
      { targetId, targetType },
    );
    return response.data.data;
  },

  /**
   * 👥 TOGGLE FOLLOW (Dành riêng cho Artist)
   * @route POST /api/v1/interactions/follow/artist/:artistId
   */
  toggleFollow: async (artistId: string) => {
    const response = await api.post<ApiResponse<ToggleFollowResponse>>(
      `/interactions/follow/artist/${artistId}`,
    );
    return response.data.data;
  },

  /**
   * ⚡ CHECK BATCH (Đồng bộ hàng loạt trạng thái)
   * @route POST /api/v1/interactions/check-batch
   */
  checkBatch: async (
    ids: string[],
    type: "like" | "follow",
    targetType?: InteractionTargetType,
  ) => {
    const response = await api.post<ApiResponse<BatchCheckResponse>>(
      "/interactions/check-batch",
      { ids, type, targetType },
    );
    // Trả về interactedIds (mảng các ID mà user ĐÃ like/follow)
    return response.data.data.interactedIds;
  },
};

export default interactionApi;
