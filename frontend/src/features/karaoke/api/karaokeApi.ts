// src/features/karaoke/api/karaokeApi.ts

import api from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types";
import type {
  IKaraokeRecording,
  IKaraokePermission,
  KaraokeFilterParams,
  KaraokePermissionFilterParams,
  UploadRecordingDto,
  UpdateRecordingDto,
  AdminReviewDto,
  GrantPermissionDto,
} from "../types";

const karaokeApi = {
  // ==========================================
  // 1. PUBLIC & USER QUERIES
  // ==========================================

  // Lấy quyền upload của user hiện tại
  getMyPermission: async () => {
    const { data } = await api.get<ApiResponse<IKaraokePermission>>("/karaoke/my-permission");
    return data;
  },

  // Lấy các bản ghi của user hiện tại
  getMyRecordings: async (params: KaraokeFilterParams = {}) => {
    const { data } = await api.get<ApiResponse<PagedResponse<IKaraokeRecording>>>(
      "/karaoke/my-recordings",
      { params }
    );
    return data;
  },

  // Lấy bản ghi cộng đồng (đã duyệt + public)
  getPublicRecordings: async (params: KaraokeFilterParams = {}) => {
    const { data } = await api.get<ApiResponse<PagedResponse<IKaraokeRecording>>>(
      "/karaoke/recordings",
      { params }
    );
    return data;
  },

  // Lấy chi tiết bản ghi
  getRecordingDetail: async (id: string) => {
    const { data } = await api.get<ApiResponse<IKaraokeRecording>>(`/karaoke/recordings/${id}`);
    return data;
  },

  // ==========================================
  // 2. USER MUTATIONS
  // ==========================================

  // Upload bản ghi mới
  uploadRecording: async (payload: UploadRecordingDto) => {
    const formData = new FormData();
    formData.append("audio", payload.audio);
    formData.append("title", payload.title);
    formData.append("youtubeVideoId", payload.youtubeVideoId);
    formData.append("youtubeTitle", payload.youtubeTitle);
    formData.append("audioDuration", String(payload.audioDuration));

    if (payload.youtubeThumbnail) {
      formData.append("youtubeThumbnail", payload.youtubeThumbnail);
    }
    if (payload.description) {
      formData.append("description", payload.description);
    }
    if (payload.tags && payload.tags.length > 0) {
      // API backend mong đợi mảng, formData có thể gửi array
      payload.tags.forEach((tag) => formData.append("tags[]", tag));
    }

    const { data } = await api.post<ApiResponse<IKaraokeRecording>>(
      "/karaoke/recordings",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return data;
  },

  // Cập nhật metadata
  updateRecording: async (id: string, payload: UpdateRecordingDto) => {
    const { data } = await api.patch<ApiResponse<IKaraokeRecording>>(
      `/karaoke/recordings/${id}`,
      payload
    );
    return data;
  },

  // Gửi duyệt
  submitForReview: async (id: string) => {
    const { data } = await api.post<ApiResponse<IKaraokeRecording>>(
      `/karaoke/recordings/${id}/submit`
    );
    return data;
  },

  // Xóa bản ghi
  deleteRecording: async (id: string) => {
    const { data } = await api.delete<ApiResponse<null>>(`/karaoke/recordings/${id}`);
    return data;
  },

  // ==========================================
  // 3. ADMIN QUERIES & MUTATIONS
  // ==========================================

  // Lấy danh sách bản ghi cho admin (tất cả trạng thái)
  adminGetRecordings: async (params: KaraokeFilterParams = {}) => {
    const { data } = await api.get<ApiResponse<PagedResponse<IKaraokeRecording> & { pendingCount?: number }>>(
      "/karaoke/admin/recordings",
      { params }
    );
    return data;
  },

  // Admin duyệt/từ chối
  adminReviewRecording: async (id: string, payload: AdminReviewDto) => {
    const { data } = await api.patch<ApiResponse<IKaraokeRecording>>(
      `/karaoke/admin/recordings/${id}/review`,
      payload
    );
    return data;
  },

  // Lấy danh sách permission
  adminGetPermissions: async (params: KaraokePermissionFilterParams = {}) => {
    const { data } = await api.get<ApiResponse<PagedResponse<IKaraokePermission>>>(
      "/karaoke/admin/permissions",
      { params }
    );
    return data;
  },

  // Cấp quyền
  adminGrantPermission: async (userId: string, payload: GrantPermissionDto) => {
    const { data } = await api.post<ApiResponse<IKaraokePermission>>(
      `/karaoke/admin/permissions/${userId}`,
      payload
    );
    return data;
  },

  // Thu hồi quyền
  adminRevokePermission: async (userId: string) => {
    const { data } = await api.delete<ApiResponse<null>>(
      `/karaoke/admin/permissions/${userId}`
    );
    return data;
  },

  // Lấy thống kê
  adminGetStats: async () => {
    const { data } = await api.get<ApiResponse<any>>("/karaoke/admin/stats");
    return data;
  },

  // ============================================================================
  // 4. YOUTUBE SEARCH
  // ============================================================================

  searchYoutube: async (query: string, limit: number = 10) => {
    const { data } = await api.get<ApiResponse<any[]>>("/karaoke/search-youtube", {
      params: { q: query, limit },
    });
    return data;
  },

  // ============================================================================
  // 5. COMMUNITY INTERACTIONS
  // ============================================================================
  
  toggleLike: async (id: string) => {
    const { data } = await api.post<ApiResponse<{ hasLiked: boolean, likeCount: number }>>(`/karaoke/recordings/${id}/like`);
    return data;
  },

  incrementPlayCount: async (id: string) => {
    const { data } = await api.post<ApiResponse<null>>(`/karaoke/recordings/${id}/play`);
    return data;
  }
};

export default karaokeApi;
