import { ITrack } from "@/features";
import type {
  IMyPlaylist,
  IPlaylist,
  PlaylistDetailResponse,
  PlaylistFilterParams,
} from "@/features/playlist/types";
import api from "@/lib/axios";
import { type ApiResponse, type PagedResponse } from "@/types";

const playlistApi = {
  // Lấy list
  getPlaylists: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IPlaylist>>>(
      "/playlists",
      { params },
    );
    return response.data;
  },

  // Lấy danh sách Playlist của User đang đăng nhập
  getMyPlaylists: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<IMyPlaylist[]>>(
      "/playlists/me",
      {
        params,
      },
    );
    return response.data;
  },

  // Lấy chi tiết 1 Playlist (Có thể gọi bằng ID hoặc Slug)
  getDetail: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<PlaylistDetailResponse>>(
      `/playlists/${slugOrId}`,
    );
    return response.data;
  },

  // Lấy danh sách bài hát trong Album
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

  // Tạo
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IPlaylist>>(
      "/playlists",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  // Cập nhật
  update: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<IPlaylist>>(
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

  // Thêm bài hát vào danh sách (Backend dùng $push + $inc)
  addTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.post<ApiResponse<IPlaylist>>(
      `/playlists/${playlistId}/tracks`,
      {
        trackIds, // Array of ID bài hát muốn thêm
      },
    );
    return response.data;
  },

  // Xóa bài hát khỏi danh sách (Backend dùng $pullAll + $inc)
  removeTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.delete<ApiResponse<IPlaylist>>(
      `/playlists/${playlistId}/tracks`,
      {
        data: { trackIds }, // Với Axios, method DELETE phải để body trong thuộc tính `data`
      },
    );
    return response.data;
  },

  // Sắp xếp lại thứ tự bài hát (Backend dùng $set, yêu cầu gửi `newTrackIds`)
  reorderTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.patch<ApiResponse<IPlaylist>>(
      `/playlists/${playlistId}/tracks/reorder`,
      {
        newTrackIds: trackIds, // 🔥 Đổi thành newTrackIds để khớp chặt chẽ với logic Backend
      },
    );
    return response.data;
  },

  // Tạo nhanh Playlist (Spotify Style)
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

  // User thêm nhạc (Có xử lý Smart Cover ở Backend)
  userAddTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.post<ApiResponse<IPlaylist>>(
      `/playlists/me/${playlistId}/tracks`,
      { trackIds },
    );
    return response.data;
  },

  //  User xóa nhạc (Bulk Remove + Refresh Smart Cover)
  userRemoveTracks: async (playlistId: string, trackIds: string[]) => {
    const response = await api.delete<ApiResponse<IPlaylist>>(
      `/playlists/me/${playlistId}/tracks`,
      { data: { trackIds } }, // Axios DELETE body
    );
    return response.data;
  },

  //  Chuyển trạng thái riêng tư/công khai nhanh
  toggleMyPlaylistVisibility: async (id: string) => {
    const response = await api.patch<ApiResponse<{ visibility: string }>>(
      `/playlists/me/${id}/toggle-visibility`,
    );
    return response.data;
  },

  // Lấy danh sách Playlist của chính tôi (Dùng cho Sidebar)
  getMyLibrary: async (params?: PlaylistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IPlaylist>>>(
      "/playlists/me/all",
      { params },
    );
    return response.data;
  },
};

export default playlistApi;
