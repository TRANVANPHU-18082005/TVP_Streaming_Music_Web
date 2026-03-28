// src/features/profile/api/profileApi.ts
import api from "@/lib/axios";
import { ApiResponse, PagedResponse } from "@/types";
import { ProfileDashboard, AnalyticsData, LikedContentParams } from "../types";

const profileApi = {
  /**
   * 1. Lấy Dashboard tổng quát
   * Trả về: analytics, playlists, library (tracks preview, albums preview)
   */
  getDashboard: async () => {
    const response =
      await api.get<ApiResponse<ProfileDashboard>>("/profile/dashboard");
    return response.data; // Trả về ApiResponse chứa ProfileDashboard
  },

  /**
   * 2. Lấy danh sách Liked Content chi tiết (Có phân trang)
   * Trả về: { success: true, data: [...], meta: {...} }
   */
  getLikedContent: async (params: LikedContentParams) => {
    const response = await api.get<ApiResponse<any>>("/profile/liked", {
      params,
    });
    return response.data; // Trả về ApiResponse chứa data (mảng) và meta
  },

  /**
   * 3. Lấy dữ liệu Chart riêng lẻ
   */
  getAnalytics: async () => {
    const response =
      await api.get<ApiResponse<AnalyticsData[]>>("/profile/analytics");
    return response.data;
  },

  /**
   * 4. Cập nhật hồ sơ (Hỗ trợ upload ảnh qua FormData)
   */
  update: async (data: FormData) => {
    const response = await api.patch<ApiResponse<any>>(
      "/profile/update",
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },
};

export default profileApi;
