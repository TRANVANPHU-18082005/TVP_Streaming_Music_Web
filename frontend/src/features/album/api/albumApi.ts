import api from "@/lib/axios";
import type { Album, AlbumFilterParams } from "@/features/album/types";
import type { ApiResponse, PagedResponse } from "@/types";

const albumApi = {
  // 1. Lấy danh sách
  getAll: async (params: AlbumFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<Album>>>(
      "/albums",
      { params },
    );
    return response.data;
  },

  // 2. Lấy chi tiết
  getById: async (id: string) => {
    const response = await api.get<ApiResponse<Album>>(`/albums/${id}`);
    return response.data;
  },

  create: async (data: FormData) => {
    const response = await api.post("/albums", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  update: async (id: string, data: FormData | Partial<Album>) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/albums/${id}`, data, {
      headers: {
        "Content-Type": isFormData ? "multipart/form-data" : "application/json",
      },
    });
    return response.data;
  },

  // 5. Xóa
  delete: async (id: string) => {
    const response = await api.delete(`/albums/${id}`);
    return response.data;
  },
};

export default albumApi;
