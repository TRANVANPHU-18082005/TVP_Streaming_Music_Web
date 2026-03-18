// src/features/notification/api/notifyApi.ts
import api from "@/lib/axios"; // Sử dụng instance chung của dự án
import { NotifyResponse } from "../types";
import { ApiResponse } from "@/types";

const notifyApi = {
  /**
   * Lấy danh sách thông báo phân trang
   * Backend trả về: { success: true, data: { list: [...], unreadCount: 5 } }
   */
  getNotifications: async (page = 1, limit = 20) => {
    const response = await api.get<ApiResponse<NotifyResponse>>(
      "/notifications",
      {
        params: { page, limit },
      },
    );
    // Trả về data bên trong ApiResponse (chứa list và unreadCount)
    return response.data.data;
  },

  /**
   * Đánh dấu toàn bộ thông báo là đã đọc
   */
  markAsRead: async () => {
    const response = await api.patch<ApiResponse<null>>(
      "/notifications/mark-read",
    );
    return response.data;
  },

  /**
   * (Optional) Nếu bạn có API xóa thông báo cụ thể
   */
  deleteNotification: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(
      `/notifications/${id}`,
    );
    return response.data;
  },
};

export default notifyApi;
