import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type {
  IChartResponse,
  ITrack,
  TrackFilterParams,
} from "@/features/track/types";
import { BulkTrackFormValues } from "@/features/track/schemas/track.schema";

/**
 * QUY TẮC ĐỒNG NHẤT:
 * Tất cả các hàm đều bóc tách (destructure) `{ data }` từ AxiosResponse
 * và trả về đúng định dạng của Backend (ApiResponse).
 */
const trackApi = {
  // ==========================================
  // 1. QUERIES (Lấy dữ liệu)
  // ==========================================

  // Lấy danh sách (Dùng cho cả Admin & Public tùy vào params truyền vào)
  getAll: async (params: TrackFilterParams) => {
    const { data } = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      "/tracks",
      {
        params,
      },
    );
    return data;
  },

  // Admin: Lấy chi tiết bài hát bằng ID
  getTrackDetail: async (id: string) => {
    const { data } = await api.get<ApiResponse<ITrack>>(`/tracks/${id}`);
    return data.data; // unwrap ApiResponse wrapper
  },

  // // Public: Lấy chi tiết bài hát bằng Slug (Dùng cho SEO/Client)
  // getDetail: async (slug: string) => {
  //   // Tùy endpoint backend của bạn, có thể là /tracks/slug/:slug hoặc /tracks/:slug
  //   const { data } = await api.get<ApiResponse<ITrack>>(
  //     `/tracks/detail/${slug}`,
  //   );
  //   return data;
  // },

  // ==========================================
  // 2. MUTATIONS (Thêm / Sửa / Xóa cơ bản)
  // ==========================================

  // Upload bài hát (Dùng FormData vì chứa file âm thanh/hình ảnh)
  upload: async (formData: FormData) => {
    const { data } = await api.post<ApiResponse<ITrack>>("/tracks", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // Cập nhật thông tin (Dùng FormData nếu có đổi ảnh bìa)
  update: async (id: string, formData: FormData) => {
    const isFormData = formData instanceof FormData;
    const { data } = await api.patch<ApiResponse<ITrack>>(
      `/tracks/${id}`,
      formData,
      {
        headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
      },
    );
    return data;
  },

  // Xóa bài hát
  delete: async (id: string) => {
    const { data } = await api.delete<ApiResponse<null>>(`/tracks/${id}`);
    return data;
  },

  // ==========================================
  // 3. ACTIONS (Các thao tác đặc thù)
  // ==========================================

  // Đổi trạng thái hiển thị (Active/Inactive)
  changeStatus: async (id: string, status: string) => {
    const { data } = await api.patch<ApiResponse<ITrack>>(
      `/tracks/change-status/${id}`,
      {
        status,
      },
    );
    return data;
  },

  // Thử lại tiến trình chuyển đổi file audio (Transcode) nếu bị lỗi
  retryTranscode: async (id: string) => {
    // Axios POST bắt buộc có tham số body, truyền {} nếu body rỗng
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry`,
      {},
    );
    return data;
  },

  // Cập nhật hàng loạt (Bulk Update)
  bulkUpdate: async (trackIds: string[], updates: BulkTrackFormValues) => {
    const { data } = await api.patch<ApiResponse<any>>("/tracks/bulk/update", {
      trackIds,
      updates,
    });
    return data;
  },

  // ==========================================
  // 4. ANALYTICS (Thống kê)
  // ==========================================

  getRealtimeChart: async () => {
    // Giả sử ChartResponse được bọc trong ApiResponse từ backend
    const data = await api.get<IChartResponse>("/tracks/charts/realtime");
    return data.data;
  },
  // trackApi.ts thêm vào phần ACTIONS
  recordView: async (trackId: string) => {
    // Dùng api.post tương tự các hàm khác để giữ tính đồng nhất
    const { data } = await api.post<ApiResponse<null>>(
      `/tracks/${trackId}/view`,
    );
    return data;
  },
};

export default trackApi;
