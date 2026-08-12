import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type {
  User,
  UserFilterParams,
  ChangePasswordDTO,
  ArtistRequest,
  UserStats,
} from "../types";

const userApi = {
  // ==========================================
  // 1. PUBLIC / CLIENT LOGIC (Hành động của cá nhân)
  // ==========================================

  // Xem tường nhà người khác / profile public
  getPublicProfile: async (userId: string) => {
    const res = await api.get<ApiResponse<User>>(`/users/${userId}/profile`);
    return res.data;
  },

  // Cập nhật Profile cá nhân (Nhận FormData vì có Avatar)
  updateProfile: async (data: FormData) => {
    const res = await api.patch<ApiResponse<User>>("/users/profile", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // Đổi mật khẩu (Gửi JSON thuần)
  changePassword: async (data: ChangePasswordDTO) => {
    const res = await api.post<ApiResponse<void>>(
      "/users/change-password",
      data,
    );
    return res.data;
  },

  // Follow / Unfollow user khác
  followUser: async (userId: string) => {
    const res = await api.post<ApiResponse<{ isFollowing: boolean }>>(
      `/users/${userId}/follow`,
    );
    return res.data;
  },

  // Gửi form xin lên làm Artist (Nhận FormData vì có thể có tài liệu/avatar)
  requestBecomeArtist: async (data: FormData) => {
    const res = await api.post<ApiResponse<ArtistRequest>>(
      "/users/request-artist",
      data,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return res.data;
  },

  // ==========================================
  // 2. ADMIN LOGIC (Quản lý hệ thống)
  // ==========================================

  // Lấy thống kê
  getStats: async () => {
    const res = await api.get<ApiResponse<UserStats>>("/users/stats");
    return res.data;
  },

  // Lấy danh sách có phân trang & tìm kiếm
  getAll: async (params: UserFilterParams) => {
    const res = await api.get<ApiResponse<PagedResponse<User>>>("/users", {
      params,
    });
    return res.data;
  },

  // Lấy chi tiết 1 User
  getById: async (id: string) => {
    const res = await api.get<ApiResponse<User>>(`/users/${id}`);
    return res.data;
  },

  // Admin tạo mới User (Nhận FormData)
  create: async (data: FormData) => {
    const res = await api.post<ApiResponse<User>>("/users", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // Admin cập nhật User (Nhận FormData)
  update: async (id: string, data: FormData) => {
    const res = await api.patch<ApiResponse<User>>(`/users/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // Khóa / Mở khóa tài khoản
  toggleBlock: async (id: string) => {
    const res = await api.post<ApiResponse<User>>(`/users/${id}/block`);
    return res.data;
  },

  // Xóa tài khoản vĩnh viễn (Hard delete)
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<User>>(`/users/${id}`);
    return res.data;
  },

  // ==========================================
  // 3. ADMIN REQUESTS (Duyệt đơn Artist)
  // ==========================================

  getArtistRequests: async () => {
    const res = await api.get<ApiResponse<ArtistRequest[]>>(
      "/users/requests?status=pending",
    );
    return res.data;
  },

  approveArtistRequest: async (requestId: string) => {
    const res = await api.post<ApiResponse<any>>(
      `/users/requests/${requestId}/approve`,
    );
    return res.data;
  },

  rejectArtistRequest: async (requestId: string, reason: string) => {
    const res = await api.post<ApiResponse<any>>(
      `/users/requests/${requestId}/reject`,
      { reason },
    );
    return res.data;
  },
};

export default userApi;
