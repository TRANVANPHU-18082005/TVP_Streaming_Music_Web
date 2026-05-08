import api from "@/lib/axios";
import { ApiResponse, PagedResponse } from "@/types";
import { ProfileDashboard, AnalyticsData, UserLibrary } from "../types";
import { ITrack } from "@/features/track";
import { IUser } from "@/features/user";

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
   * 5. Lấy lịch sử nghe nhạc (Hỗ trợ phân trang cho Virtual Scroll)
   */
  getRecentlyPlayed: async (params?: { page?: number; limit?: number }) => {
    // Để ý: Trả về PagedResponse<ITrack> thay vì mảng ITrack đơn thuần
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      "/profile/recently-played",
      { params },
    );
    return response.data;
  },

  /**
   * 7. Lấy danh sách bài hát yêu thích (Virtual Scroll)
   */
  getFavouriteTracks: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      "/profile/favourite-track",
      { params },
    );
    return response.data;
  },

  /**
   * 6. Cập nhật hồ sơ (Hỗ trợ upload ảnh qua FormData)
   */
  updateProfile: async (data: FormData) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch<ApiResponse<IUser>>(
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
