import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type {
  IArtist,
  ArtistFilterParams,
  ArtistDetailResponse,
} from "../types";
import { ITrack } from "@/features/track/types";

const artistApi = {
  // --- 1. PUBLIC METHODS (Client View) ---

  /** Lấy danh sách nghệ sĩ (Listing) */
  getArtists: async (params: ArtistFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<IArtist>>>(
      "/artists",
      {
        params,
      },
    );
    console.log(response);
    return response.data;
  },

  /** Lấy chi tiết nghệ sĩ (Metadata + trackIds cho Virtual Scroll) */
  getDetail: async (slugOrId: string) => {
    const response = await api.get<ApiResponse<ArtistDetailResponse>>(
      `/artists/${slugOrId}`,
    );
    return response.data;
  },

  /** Tải danh sách bài hát của nghệ sĩ (Phân trang cho Virtual Scroll) */
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

  /** Follow/Unfollow (Backend tự động xử lý followersCount) */
  toggleFollow: async (id: string) => {
    const response = await api.post<ApiResponse<{ isFollowed: boolean }>>(
      `/artists/${id}/follow`,
    );
    return response.data;
  },

  // --- 2. ADMIN METHODS (Management) ---

  /** Tạo mới nghệ sĩ (Dùng FormData cho Avatar/Cover/Gallery) */
  adminCreate: async (formData: FormData) => {
    const response = await api.post<ApiResponse<IArtist>>(
      "/artists",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  /** Cập nhật nghệ sĩ (Dùng FormData cho ảnh và thông tin) */
  adminUpdate: async (id: string, formData: FormData) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },

  /** Ẩn/Hiện nghệ sĩ khỏi hệ thống */
  adminToggleStatus: async (id: string) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}/toggle-active`,
    );
    return response.data;
  },

  /** Cấp/Thu hồi tick xanh xác minh */
  adminVerify: async (id: string) => {
    const response = await api.patch<ApiResponse<IArtist>>(
      `/artists/${id}/verify`,
    );
    return response.data;
  },

  /** Xóa nghệ sĩ (Dọn dẹp tài nguyên ảnh ở Cloudinary/S3) */
  adminDelete: async (id: string) => {
    const response = await api.delete<ApiResponse<null>>(`/artists/${id}`);
    return response.data;
  },

  // --- 3. ARTIST SELF METHODS (Portal) ---

  /** Lấy thông tin cá nhân (Artist Dashboard) */
  getMyProfile: async () => {
    const response = await api.get<ApiResponse<IArtist>>("/artists/me/profile");
    return response.data;
  },

  /** Nghệ sĩ tự cập nhật Profile (Bio, Social, Images) */
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

  /** Lấy thống kê hiệu suất (Lượt nghe, Follow theo mốc thời gian) */
  getDashboardStats: async (range: "7d" | "30d" | "all" = "30d") => {
    const response = await api.get<ApiResponse<any>>("/artists/me/stats", {
      params: { range },
    });
    return response.data;
  },
};

export default artistApi;
