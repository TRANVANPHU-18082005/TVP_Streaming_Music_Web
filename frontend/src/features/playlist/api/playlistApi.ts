import type { Playlist, PlaylistFilterParams } from "@/features/playlist/types";
import api from "@/lib/axios";
import { type ApiResponse, type PagedResponse } from "@/types";

const playlistApi = {
  // ==========================================
  // 1. QUERIES (LẤY DỮ LIỆU)
  // ==========================================

  // Lấy danh sách Playlist (Kèm theo filter, sort, pagination)
  getAll: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<Playlist>>>(
      "/playlists",
      { params },
    );
    return response.data;
  },

  // Lấy danh sách Playlist của User đang đăng nhập
  getMyPlaylists: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<Playlist>>>(
      "/playlists/me",
      { params },
    );
    return response.data;
  },

  // Lấy chi tiết 1 Playlist (Có thể gọi bằng ID hoặc Slug)
  getById: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<Playlist>>(
      `/playlists/${slugOrId}`,
    );
    return response.data;
  },

  // ==========================================
  // 2. MUTATIONS (QUẢN LÝ THÔNG TIN)
  // ==========================================

  // 🔥 FIX: Nhận trực tiếp FormData từ Hook, không build lại
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<Playlist>>(
      "/playlists",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  // 🔥 FIX: Nhận trực tiếp FormData từ Hook
  update: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<Playlist>>(
      `/playlists/${id}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  // Xóa Playlist (Backend đã bọc Transaction để dọn rác ảnh)
  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/playlists/${id}`);
    return response.data;
  },

  // ==========================================
  // 3. TRACK MANAGEMENT (ATOMIC & RACE-CONDITION PROOF)
  // ==========================================

  // Thêm bài hát vào danh sách (Backend dùng $push + $inc)
  addTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.post<ApiResponse<Playlist>>(
      `/playlists/${playlistId}/tracks`,
      {
        trackIds, // Array of ID bài hát muốn thêm
      },
    );
    return response.data;
  },

  // Xóa bài hát khỏi danh sách (Backend dùng $pullAll + $inc)
  removeTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.delete<ApiResponse<Playlist>>(
      `/playlists/${playlistId}/tracks`,
      {
        data: { trackIds }, // Với Axios, method DELETE phải để body trong thuộc tính `data`
      },
    );
    return response.data;
  },

  // Sắp xếp lại thứ tự bài hát (Backend dùng $set, yêu cầu gửi `newTrackIds`)
  reorderTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.patch<ApiResponse<Playlist>>(
      `/playlists/${playlistId}/tracks/reorder`,
      {
        newTrackIds: trackIds, // 🔥 Đổi thành newTrackIds để khớp chặt chẽ với logic Backend
      },
    );
    return response.data;
  },
  // ==========================================
  // 👤 USER SPECIFIC ACTIONS (MỚI BỔ SUNG)
  // ==========================================

  /**
   * 🚀 Tạo nhanh Playlist (Spotify Style)
   * Không bắt buộc gửi data, Backend tự đặt tên "Danh sách phát của tôi #N"
   */
  createQuickPlaylist: async (data?: {
    title?: string;
    visibility?: string;
  }) => {
    const response = await api.post<ApiResponse<Playlist>>(
      "/playlists/me",
      data || {},
    );
    return response.data;
  },

  /**
   * ➕ User thêm nhạc (Có xử lý Smart Cover ở Backend)
   * URL: POST /api/playlists/me/:playlistId/tracks
   */
  userAddTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.post<ApiResponse<Playlist>>(
      `/playlists/me/${playlistId}/tracks`,
      { trackIds },
    );
    return response.data;
  },

  /**
   * 🗑️ User xóa nhạc (Bulk Remove + Refresh Smart Cover)
   * URL: DELETE /api/playlists/me/:playlistId/tracks
   */
  userRemoveTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.delete<ApiResponse<Playlist>>(
      `/playlists/me/${playlistId}/tracks`,
      { data: { trackIds } }, // Axios DELETE body
    );
    return response.data;
  },

  /**
   * 🔒 Chuyển trạng thái riêng tư/công khai nhanh
   * URL: PATCH /api/playlists/me/:id/toggle-visibility
   */
  toggleMyPlaylistVisibility: async (id: string) => {
    const response = await api.patch<ApiResponse<{ visibility: string }>>(
      `/playlists/me/${id}/toggle-visibility`,
    );
    return response.data;
  },

  /**
   * 📋 Lấy danh sách Playlist của chính tôi (Dùng cho Sidebar)
   * Thường sẽ gọn nhẹ hơn getAll thông thường
   */
  getMyLibrary: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<Playlist>>>(
      "/playlists/me/all",
      { params },
    );
    return response.data;
  },
};

export default playlistApi;
