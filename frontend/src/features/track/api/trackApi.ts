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
    return data; // unwrap ApiResponse wrapper
  },

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
  // 1. Retry Full: Xóa sạch làm lại từ đầu (HLS + Lyrics + Mood)
  retryFull: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/full`,
      {},
    );
    return data;
  },

  // 2. Retry Transcode: Chỉ xử lý lại file HLS (âm thanh), giữ nguyên Lyric/Mood
  retryTranscode: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/transcode`,
      {},
    );
    return data;
  },

  // 3. Retry Lyrics: Chỉ tìm lại lời bài hát trên LRCLIB + AI Karaoke
  retryLyrics: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/lyrics`,
      {},
    );
    return data;
  },

  // 4. Retry Karaoke: Chỉ chạy lại AI Forced Alignment (Dùng khi đã có plainLyrics trong DB)
  retryKaraoke: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/karaoke`,
      {},
    );
    return data;
  },

  // 5. Retry Mood: Chỉ tìm lại video nền (Mood Canvas) dựa trên tags
  retryMood: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/mood`,
      {},
    );
    return data;
  },
  // ==========================================
  // 5. RECOMMENDATIONS (Gợi ý bài hát)
  // ==========================================

  /**
   * Lấy danh sách "Bài hát bạn có thể thích"
   * @param limit - Số lượng bài trả về
   * @param excludeTrackId - Loại trừ bài đang phát (nếu có)
   */
  getRecommendations: async (limit = 20, excludeTrackId?: string) => {
    const { data } = await api.get<ApiResponse<{ tracks: ITrack[] }>>(
      "/tracks/recommendations",
      {
        params: { limit, excludeTrackId },
      },
    );
    console.log(data);
    return data.data; // Trả về { tracks: ITrack[] }
  },

  /**
   * Lấy bài hát liên quan (Autoplay Queue)
   * @param slugOrId - Slug hoặc ID của bài hát gốc
   * @param limit - Số lượng bài trả về
   */
  getSimilarTracks: async (trackId: string, limit = 10) => {
    const { data } = await api.get<ApiResponse<{ tracks: ITrack[] }>>(
      `/tracks/${trackId}/similar`,
      {
        params: { limit },
      },
    );
    return data.data; // Trả về { tracks: ITrack[] }
  },
};

export default trackApi;
