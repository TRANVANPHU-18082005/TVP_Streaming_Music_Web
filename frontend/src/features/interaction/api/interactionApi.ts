import api from "@/lib/axios";
import { ApiResponse } from "@/types";
import { InteractionTargetType } from "../slice/interactionSlice";
import { BatchCheckResponse } from "../types";

// Pending requests map to dedupe concurrent identical checkBatch calls
const pendingChecks = new Map<string, Promise<string[]>>();

const makeCheckKey = (
  ids: string[],
  type: "like" | "follow",
  targetType?: InteractionTargetType,
) => `${type}:${targetType ?? ""}:${[...ids].sort().join(",")}`;

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
    const key = makeCheckKey(ids, type, targetType);
    if (pendingChecks.has(key)) return pendingChecks.get(key)!;

    const promise = (async () => {
      const response = await api.post<ApiResponse<BatchCheckResponse>>(
        "/interactions/check-batch",
        { ids, type, targetType },
      );
      return response.data.data.interactedIds;
    })();

    pendingChecks.set(key, promise);
    // Cleanup after settled
    promise.finally(() => pendingChecks.delete(key));
    return promise;
  },
};

export default interactionApi;
