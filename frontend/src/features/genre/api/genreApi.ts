import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type { IGenre, IGenreDetail } from "../types";
import { ITrack } from "@/features/track/types";
import {
  GenreAdminFilterParams,
  GenreFilterParams,
} from "../schemas/genre.schema";

const genreApi = {
  // 1. Get genres by user queries (Public)
  getGenresByUser: async (params?: GenreFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IGenre>>>(
      "/genres",
      {
        params,
      },
    );
    return response.data;
  },
  // 2. Get genres by admin queries (Admin)
  getGenresByAdmin: async (params?: GenreAdminFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IGenre>>>(
      "/genres/admin",
      {
        params,
      },
    );
    return response.data;
  },
  // 3. Get genre detail by slug or id (Public)
  getGenreDetail: async (slug: string) => {
    const response = await api.get<ApiResponse<IGenreDetail>>(
      `/genres/${slug}`,
    );
    return response.data;
  },
  // 4. Get tracks by genre id (Public - Infinite Load for Virtualizer)
  getGenreTracks: async (
    genreId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      `/genres/${genreId}/tracks`,
      { params },
    );
    return response.data;
  },

  // 5. Get genre tree (Public - Dùng cho dropdown chọn thể loại)
  getTree: async () => {
    const response = await api.get<ApiResponse<IGenre[]>>("/genres/tree");
    return response.data;
  },

  // 6. Create new genre (Admin - Multipart/form-data)
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IGenre>>("/genres", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  // 7. Update genre (Admin - Multipart/form-data)
  update: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<IGenre>>(
      `/genres/${id}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  // 8. Toggle genre status (Admin - Bật/Tắt hoạt động nhanh)
  toggleStatus: async (id: string) => {
    const response = await api.patch<ApiResponse<IGenre>>(
      `/genres/${id}/toggle`,
    );
    return response.data;
  },

  // 9. Delete genre (Admin - Xóa vĩnh viễn, Backend sẽ kiểm tra ràng buộc dữ liệu trước khi xóa)
  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/genres/${id}`);
    return response.data;
  },
  // 10. Restore genre (Admin - undo soft delete)
  restore: async (id: string) => {
    const response = await api.patch<ApiResponse<null>>(
      `/genres/${id}/restore`,
    );
    return response.data;
  },
};

export default genreApi;
