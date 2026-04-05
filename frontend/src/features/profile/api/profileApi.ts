import api from "@/lib/axios";
import { ApiResponse } from "@/types";
import { ProfileDashboard, AnalyticsData, UserLibrary } from "../types";
import { ITrack } from "@/features/track";

const profileApi = {
  /**
   * 1. Lấy Dashboard tổng quát
   * @param params { mode: 'essential' | 'full' }
   * 'essential' dùng cho HomePage (không lấy analytics nặng)
   */
  getDashboard: async (params?: { mode?: "full" | "essential" }) => {
    const response = await api.get<ApiResponse<ProfileDashboard>>(
      "/profile/dashboard",
      {
        params,
      },
    );
    return response.data;
  },

  /**
   * 3. Lấy dữ liệu Chart riêng lẻ (7 ngày qua)
   */
  getAnalytics: async () => {
    const response =
      await api.get<ApiResponse<AnalyticsData[]>>("/profile/analytics");
    return response.data;
  },

  /**
   * 4. Lấy danh sách Playlist cá nhân (Library)
   * Trả về các playlist mà user là chủ sở hữu hoặc cộng tác viên
   */
  getLibrary: async () => {
    const response =
      await api.get<ApiResponse<UserLibrary>>("/profile/library");
    return response.data;
  },

  /**
   * 5. Lấy lịch sử nghe nhạc gần đây
   * Mặc định lấy 10-20 bài để hiển thị nhanh
   */
  getRecentlyPlayed: async (limit: number = 10) => {
    const response = await api.get<ApiResponse<ITrack[]>>(
      "/profile/recently-played",
      {
        params: { limit },
      },
    );
    return response.data;
  },

  /**
   * 6. Cập nhật hồ sơ (Hỗ trợ upload ảnh qua FormData)
   */
  updateProfile: async (data: FormData | any) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch<ApiResponse<any>>(
      "/profile/update",
      data,
      {
        headers: {
          "Content-Type": isFormData
            ? "multipart/form-data"
            : "application/json",
        },
      },
    );
    return response.data;
  },
};

export default profileApi;
