import api from "@/lib/axios";
import type { IAlbum, IAlbumDetail } from "@/features/album/types";
import type { ApiResponse, PagedResponse } from "@/types";
import { AlbumAdminFilterParams, AlbumFilterParams, ITrack } from "@/features";

const albumApi = {
  // 1 Lấy danh sách với filter & pagination bởi User
  getAlbumsByUser: async (params?: AlbumFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IAlbum>>>(
      "/albums",
      { params },
    );
    return response.data;
  },
  // 2 Lấy danh sách với filter & pagination bởi Admin
  getAlbumsByAdmin: async (params?: AlbumAdminFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IAlbum>>>(
      "/albums/admin",
      { params },
    );
    return response.data;
  },

  // 3 Lấy chi tiết album bởi slug hoặc id (Public)
  getAlbumDetail: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<IAlbumDetail>>(
      `/albums/${slugOrId}`,
    );
    return response.data;
  },

  // 4 Lấy danh sách bài hát trong Album
  getAlbumTracks: async (
    idOrSlug: string,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      `/albums/${idOrSlug}/tracks`,
      { params },
    );
    return response.data;
  },

  // 5. Tạo mới album (Admin - Multipart/form-data)
  create: async (data: FormData) => {
    const response = await api.post("/albums", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // 6. Cập nhật album (Admin - Multipart/form-data nếu có coverImage mới)
  update: async (id: string, data: FormData) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/albums/${id}`, data, {
      headers: {
        "Content-Type": isFormData ? "multipart/form-data" : "application/json",
      },
    });
    return response.data;
  },

  // 7. Xóa album (Admin)
  delete: async (id: string) => {
    const response = await api.delete(`/albums/${id}`);
    return response.data;
  },
  // 8. Toggle public status (Admin - Bật/Tắt nhanh)
  togglePublicStatus: async (id: string, isPublic: boolean) => {
    const response = await api.patch(`/albums/${id}/toggle-public`, {
      isPublic,
    });
    return response.data;
  },
};

export default albumApi;
