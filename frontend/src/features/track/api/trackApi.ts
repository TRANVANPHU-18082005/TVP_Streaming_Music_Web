import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type { IChartResponse, ITrack } from "@/features/track/types";
import {
  BulkTrackUpdateFormValues,
  TrackChangeStatusFormValues,
  TrackFilterParams,
} from "@/features/track/schemas/track.schema";

/**
 * QUY TẮC ĐỒNG NHẤT:
 * Tất cả các hàm đều bóc tách (destructure) `{ data }` từ AxiosResponse
 * và trả về đúng định dạng của Backend (ApiResponse).
 */
const trackApi = {
  // ==========================================
  // 1. QUERIES (Lấy dữ liệu)
  // ==========================================

  // Lấy danh sách bài hát với filter, search, pagination
  getTracks: async (params: TrackFilterParams) => {
    const { data } = await api.get<ApiResponse<PagedResponse<ITrack>>>(
      "/tracks",
      {
        params,
      },
    );
    return data;
  },

  // Lấy chi tiết bài hát (slug hoặc id)
  getTrackDetail: async (id: string, options?: { signal?: AbortSignal }) => {
    const { data } = await api.get<ApiResponse<ITrack>>(`/tracks/${id}`, {
      signal: options?.signal,
    });
    return data;
  },

  // Lấy bài hát tương tự (dựa trên nghệ sĩ, thể loại, mood...)
  getSimilarTracks: async (trackId: string, limit = 10) => {
    const { data } = await api.get<ApiResponse<{ tracks: ITrack[] }>>(
      `/tracks/${trackId}/similar`,
      {
        params: { limit },
      },
    );
    return data.data;
  },

  // ==========================================
  // 2. RECOMMENDATIONS (Gợi ý bài hát)
  // ==========================================

  // Lấy danh sách "Bài hát bạn có thể thích"
  getRecommendations: async (limit = 20, excludeTrackId?: string) => {
    const { data } = await api.get<ApiResponse<{ tracks: ITrack[] }>>(
      "/tracks/recommendations",
      {
        params: { limit, excludeTrackId },
      },
    );
    return data.data;
  },

  // ==========================================
  // 3. CHARTS (Bảng xếp hạng)
  // ==========================================

  // Top 100 realtime chart
  getRealtimeChart: async () => {
    const { data } = await api.get<IChartResponse>(
      "/tracks/charts/realtime",
    );
    return data;
  },

  // ==========================================
  // 4. MUTATIONS (Thêm / Sửa / Xóa)
  // ==========================================

  // Upload bài hát mới (artist, admin)
  create: async (formData: FormData) => {
    const { data } = await api.post<ApiResponse<ITrack>>("/tracks", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // Cập nhật thông tin bài hát (artist chỉ được chỉnh bài của mình, admin được chỉnh tất cả)
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
  // 5. BULK OPERATIONS (Admin)
  // ==========================================

  // Cập nhật thông tin nhiều bài hát cùng lúc
  bulkUpdate: async (
    trackIds: string[],
    payload: BulkTrackUpdateFormValues,
  ) => {
    const { data } = await api.patch<ApiResponse<any>>("/tracks/bulk/update", {
      trackIds,
      updates: payload,
    });
    return data;
  },

  // Bulk retry endpoints (Admin): accept array of track IDs
  bulkRetryTranscode: async (trackIds: string[]) => {
    const { data } = await api.post<ApiResponse<any>>(
      "/tracks/bulk/retry/transcode",
      { trackIds },
    );
    return data;
  },

  bulkRetryLyrics: async (trackIds: string[]) => {
    const { data } = await api.post<ApiResponse<any>>(
      "/tracks/bulk/retry/lyrics",
      { trackIds },
    );
    return data;
  },

  bulkRetryKaraoke: async (trackIds: string[]) => {
    const { data } = await api.post<ApiResponse<any>>(
      "/tracks/bulk/retry/karaoke",
      { trackIds },
    );
    return data;
  },

  bulkRetryMood: async (trackIds: string[]) => {
    const { data } = await api.post<ApiResponse<any>>(
      "/tracks/bulk/retry/mood",
      { trackIds },
    );
    return data;
  },

  bulkRetryFull: async (trackIds: string[]) => {
    const { data } = await api.post<ApiResponse<any>>(
      "/tracks/bulk/retry/full",
      { trackIds },
    );
    return data;
  },

  // ==========================================
  // 6. STATUS MANAGEMENT
  // ==========================================

  // Thay đổi trạng thái bài hát (ready, failed) và lưu lý do nếu failed
  changeStatus: async (id: string, payload: TrackChangeStatusFormValues) => {
    const { data } = await api.patch<ApiResponse<ITrack>>(
      `/tracks/change-status/${id}`,
      payload,
    );
    return data;
  },

  // ==========================================
  // 7. RETRY OPERATIONS (Admin - Single Track)
  // ==========================================

  // Retry Full: Xóa sạch làm lại từ đầu (HLS + Lyrics + Mood)
  retryFull: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/full`,
      {},
    );
    return data;
  },

  // Retry Transcode: Chỉ xử lý lại file HLS (âm thanh), giữ nguyên Lyric/Mood
  retryTranscode: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/transcode`,
      {},
    );
    return data;
  },

  // Retry Lyrics: Chỉ tìm lại lời bài hát trên LRCLIB + AI Karaoke
  retryLyrics: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/lyrics`,
      {},
    );
    return data;
  },

  // Retry Karaoke: Chỉ chạy lại AI Forced Alignment (Dùng khi đã có plainLyrics trong DB)
  retryKaraoke: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/karaoke`,
      {},
    );
    return data;
  },

  // Retry Mood: Chỉ tìm lại video nền (Mood Canvas) dựa trên tags
  retryMood: async (id: string) => {
    const { data } = await api.post<ApiResponse<ITrack>>(
      `/tracks/${id}/retry/mood`,
      {},
    );
    return data;
  },
};

export default trackApi;
