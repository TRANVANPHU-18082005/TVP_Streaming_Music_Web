import api from "@/lib/axios";
import type {
  AlbumDetailResponse,
  AlbumFilterParams,
  CreateAlbumInput,
  IAlbum,
  UpdateAlbumInput,
} from "@/features/album/types";
import type { ApiResponse, PagedResponse } from "@/types";
import { ITrack } from "@/features";

const albumApi = {
  // Lấy list
  getAlbums: async (params?: AlbumFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IAlbum>>>(
      "/albums",
      { params },
    );
    return response.data;
  },

  // Lấy chi tiết
  getDetail: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<AlbumDetailResponse>>(
      `/albums/${slugOrId}`,
    );
    return response.data;
  },

  // Lấy danh sách bài hát trong Album
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

  // Tạo
  create: async (data: CreateAlbumInput) => {
    const response = await api.post("/albums", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Cập nhật
  update: async (id: string, data: UpdateAlbumInput) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/albums/${id}`, data, {
      headers: {
        "Content-Type": isFormData ? "multipart/form-data" : "application/json",
      },
    });
    return response.data;
  },

  // Xóa
  delete: async (id: string) => {
    const response = await api.delete(`/albums/${id}`);
    return response.data;
  },
};

export default albumApi;
