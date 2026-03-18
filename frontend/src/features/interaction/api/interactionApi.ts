import api from "@/lib/axios";
import { ApiResponse } from "@/types";

// Interface cho kết quả trả về từ API toggle
export interface ToggleLikeResponse {
  isLiked: boolean;
}

export interface ToggleFollowResponse {
  isFollowed: boolean;
}

const interactionApi = {
  /**
   * Toggle Like cho một bài hát
   * @route POST /api/v1/interactions/like/track/:trackId
   */
  toggleLike: async (trackId: string) => {
    const response = await api.post<ApiResponse<ToggleLikeResponse>>(
      `/interactions/like/track/${trackId}`,
    );
    return response.data.data;
  },

  /**
   * Toggle Follow cho một nghệ sĩ
   * @route POST /api/v1/interactions/follow/artist/:artistId
   */
  toggleFollow: async (artistId: string) => {
    const response = await api.post<ApiResponse<ToggleFollowResponse>>(
      `/interactions/follow/artist/${artistId}`,
    );
    return response.data.data;
  },

  /**
   * Kiểm tra hàng loạt trạng thái (Like hoặc Follow)
   * @route POST /api/v1/interactions/check-batch
   * @param ids Mảng các ID cần kiểm tra
   * @param type 'like' | 'follow'
   */
  checkBatch: async (ids: string[], type: "like" | "follow") => {
    const response = await api.post<ApiResponse<string[]>>(
      "/interactions/check-batch",
      {
        ids,
        type,
      },
    );
    // Trả về mảng các ID đã tương tác (đã like hoặc đã follow)
    return response.data.data;
  },
};

export default interactionApi;
