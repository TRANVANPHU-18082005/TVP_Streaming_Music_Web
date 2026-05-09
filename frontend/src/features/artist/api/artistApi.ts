import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type { IArtist, IArtistDetail } from "../types";
import { ITrack } from "@/features/track/types";
import {
  ArtistAdminFilterParams,
  ArtistFilterParams,
} from "../schemas/artist.schema";

const artistApi = {
  // 1. PUBLIC METHODS (Client & Artist Portal)
  getArtistsByUser: async (params: ArtistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IArtist>>>(
      "/artists",
      {
        params,
      },
    );

    return response.data;
  },
  // 2. PUBLIC METHODS (Client & Artist Portal)
  getArtistsByAdmin: async (params: ArtistAdminFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IArtist>>>(
      "/artists/admin",
      {
        params,
      },
    );

    return response.data;
  },

  // 3. PUBLIC METHODS (Client) - Chi tiết nghệ sĩ + Danh sách bài hát (Virtual Scroll)
  getArtistDetail: async (slug: string) => {
    const response = await api.get<ApiResponse<IArtistDetail>>(
      `/artists/${slug}`,
    );
    return response.data;
  },

  // 4. PUBLIC METHODS (Client) - Lấy danh sách bài hát của nghệ sĩ (dùng cho Virtual Scroll)
  getArtistTracks: async (
    artistId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      `/artists/${artistId}/tracks`,
      { params },
    );
    return response.data;
  },
  // 5. ADMIN METHODS (Admin Portal) - CRUD nghệ sĩ
  create: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IArtist>>(
      "/artists",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  //6. ADMIN METHODS (Admin Portal) - Cập nhật nghệ sĩ (Bio, Social, Images)
  update: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  //7. ADMIN METHODS (Admin Portal) - Ẩn/Hiện nghệ sĩ khỏi hệ thống
  toggleStatus: async (id: string) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}/toggle`,
    );
    return response.data;
  },

  //8. ADMIN METHODS (Admin Portal) - Cấp/Thu hồi tick xanh xác minh
  adminVerify: async (id: string) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}/verify`,
    );
    return response.data;
  },

  //9. ADMIN METHODS (Admin Portal) - Xóa nghệ sĩ (Dọn dẹp tài nguyên ảnh ở Cloudinary/S3)
  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/artists/${id}`);
    return response.data;
  },

  // 12. ADMIN METHODS - Restore soft-deleted artist
  restore: async (id: string) => {
    const response = await api.patch<ApiResponse<null>>(
      `/artists/${id}/restore`,
    );
    return response.data;
  },

  // 10. ARTIST METHODS (Artist Portal) - Lấy thông tin profile của chính mình
  getMyProfile: async () => {
    const response = await api.get<ApiResponse<IArtist>>("/artists/me/profile");
    return response.data;
  },

  // 11. ARTIST METHODS (Artist Portal) - Cập nhật thông tin profile của chính mình
  updateMyProfile: async (formData: FormData) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      "/artists/me/profile",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },
};

export default artistApi;
