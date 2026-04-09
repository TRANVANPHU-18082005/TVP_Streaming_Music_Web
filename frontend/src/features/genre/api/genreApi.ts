import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type { IGenre, GenreDetailResponse, GenreFilterParams } from "../types";
import { ITrack } from "@/features/track/types";

const genreApi = {
  // --- 1. PUBLIC METHODS (Client View) ---

  /** Lấy danh sách thể loại (Listing/Grid) */
  getGenres: async (params?: GenreFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IGenre>>>(
      "/genres",
      {
        params,
      },
    );
    return response.data;
  },

  /** Lấy chi tiết thể loại (Metadata + trackIds cho Virtual Scroll) */
  getDetail: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<GenreDetailResponse>>(
      `/genres/${slugOrId}`,
    );
    return response.data;
  },

  /** Tải danh sách bài hát thuộc thể loại (Infinite Load cho Virtualizer) */
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

  /** Lấy cây danh mục (Hierarchy) - Dùng cho Menu Sidebar hoặc Dropdown Select */
  getTree: async () => {
    const response = await api.get<ApiResponse<IGenre[]>>("/genres/tree");
    return response.data;
  },

  // --- 2. ADMIN METHODS (Management - Protected) ---

  /** Tạo thể loại mới (Multipart/form-data) */
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IGenre>>("/genres", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  /** Cập nhật thể loại (Multipart/form-data) */
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

  /** Đổi trạng thái Bật/Tắt hoạt động nhanh */
  toggleStatus: async (id: string) => {
    const response = await api.patch<ApiResponse<IGenre>>(
      `/genres/${id}/toggle-status`,
    );
    return response.data;
  },

  /** Đổi trạng thái Trending (Hiện lên mục khám phá hot) */
  toggleTrending: async (id: string) => {
    const response = await api.patch<ApiResponse<IGenre>>(
      `/genres/${id}/toggle-trending`,
    );
    return response.data;
  },

  /** Xóa thể loại (Backend check ràng buộc dữ liệu trước khi xóa) */
  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/genres/${id}`);
    return response.data;
  },
};

export default genreApi;
