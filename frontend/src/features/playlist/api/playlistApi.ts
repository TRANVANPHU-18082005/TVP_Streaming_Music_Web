import type { IPlaylist, IPlaylistDetail } from "@/features/playlist/types";
import api from "@/lib/axios";
import { type ApiResponse, type PagedResponse } from "@/types";
import {
  PlaylistAdminFilterParams,
  PlaylistFilterParams,
} from "../schemas/playlist.schema";
import { ITrack } from "@/features/track";

const playlistApi = {
  // ==========================================
  // 🟢 PUBLIC & GLOBAL ROUTES
  // ==========================================

  // Lấy danh sách Playlist công khai (Có phân trang/filter)
  getPlaylistsByUser: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IPlaylist>>>(
      "/playlists",
      { params },
    );
    return response.data;
  },

  // Lấy chi tiết 1 Playlist (ID hoặc Slug)
  getDetail: async (slug: string) => {
    const response = await api.get<ApiResponse<IPlaylistDetail>>(
      `/playlists/${slug}`,
    );
    return response.data;
  },

  // Lấy danh sách bài hát trong Playlist (Pagination)
  getPlaylistTracks: async (
    slugOrId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      `/playlists/${slugOrId}/tracks`,
      { params },
    );
    return response.data;
  },

  // ==========================================
  // 👤 MY LIBRARY (USER SPECIFIC)
  // ==========================================

  // Lấy toàn bộ playlist của tôi (Cho Sidebar/Library)
  getMyLibrary: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<ApiResponse<PagedResponse<IPlaylist>>>(
      "/playlists/me",
      { params },
    );
    // Type lúc này: response.data.data.data là IPlaylist[]
    return response.data;
  },

  // Tạo nhanh Playlist trống (Spotify Style)
  createQuickPlaylist: async (data?: {
    title?: string;
    visibility?: string;
  }) => {
    const response = await api.post<ApiResponse<IPlaylist>>(
      "/playlists/me",
      data || {},
    );
    return response.data;
  },

  // Sửa nhanh Playlist (Chỉ đổi Title/Visibility - không gửi file)
  quickEditMyPlaylist: async (
    id: string,
    data: { title?: string; visibility?: string },
  ) => {
    const response = await api.put<ApiResponse<IPlaylist>>(
      `/playlists/me/${id}`,
      data,
    );
    return response.data;
  },

  // Chuyển trạng thái riêng tư/công khai nhanh
  toggleMyPlaylistVisibility: async (id: string) => {
    const response = await api.patch<ApiResponse<{ visibility: string }>>(
      `/playlists/${id}/toggle-visibility`, // Khớp với router.patch("/:id/toggle-visibility")
    );
    return response.data;
  },

  // ==========================================
  // 🛠 TRACK MANAGEMENT (IN PLAYLIST)
  // ==========================================

  // Thêm bài hát (Hỗ trợ Batch)
  addTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.post<ApiResponse<{ addedCount: number }>>(
      `/playlists/${playlistId}/tracks`,
      { trackIds },
    );
    return response.data;
  },

  // Xóa bài hát (Hỗ trợ Batch)
  removeTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.delete<ApiResponse<{ removedCount: number }>>(
      `/playlists/${playlistId}/tracks`,
      { data: { trackIds } }, // Axios DELETE body must be in 'data'
    );
    return response.data;
  },

  // Sắp xếp lại thứ tự bài hát
  reorderTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.put<ApiResponse<null>>(
      `/playlists/${playlistId}/tracks`, // Khớp với router.put("/:id/tracks")
      { trackIds }, // Backend nhận trackIds để $set
    );
    return response.data;
  },

  // ==========================================
  // 👑 ADMIN & ADVANCED MANAGEMENT
  // ==========================================

  // Lấy danh sách Playlist cho Admin (Filter chuyên sâu)
  getPlaylistsByAdmin: async (params?: PlaylistAdminFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IPlaylist>>>(
      "/playlists/admin",
      { params },
    );
    return response.data;
  },

  // Tạo Playlist Hệ thống (Có file)
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IPlaylist>>(
      "/playlists",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  // Cập nhật Playlist (Có file)
  update: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<IPlaylist>>(
      `/playlists/${id}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  // Xóa Playlist (Soft Delete ở Backend)
  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/playlists/${id}`);
    return response.data;
  },
  // Khôi phục Playlist (Admin)
  restore: async (id: string) => {
    const response = await api.patch<ApiResponse<null>>(
      `/playlists/${id}/restore`,
    );
    return response.data;
  },
};

export default playlistApi;
