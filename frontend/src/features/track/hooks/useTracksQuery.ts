import { useQuery, keepPreviousData } from "@tanstack/react-query";
import trackApi from "../api/trackApi";
import { trackKeys } from "../utils/trackKeys";
import type { ITrack, TrackFilterParams } from "../types";

// ============================================================================
// PHẦN A: PUBLIC QUERIES (Dành cho Người dùng cuối - Client)
// Bảo mật: Tự động ép điều kiện chỉ hiển thị bài hát đã sẵn sàng (status: "ready")
// ============================================================================

/**
 * 1. Lấy danh sách bài hát Public (Phân trang, Tìm kiếm, Lọc)
 */
export const usePublicTracks = (params: TrackFilterParams) => {
  // Ghi đè/Ép kiểu status luôn là "ready"
  const publicParams = { ...params, status: "ready" };

  return useQuery({
    queryKey: trackKeys.list(publicParams),
    queryFn: () => trackApi.getAll(publicParams),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000, // Tránh gọi API liên tục, Cache 2 phút
    select: (response) => ({
      tracks: response.data.data as ITrack[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

/**
 * 2. Lấy danh sách bài hát Nổi bật / Trending
 */
export const useTopTracks = (limit = 10) => {
  const params: TrackFilterParams = {
    page: 1,
    limit,
    sort: "popular",
    status: "ready",
  };

  return useQuery({
    queryKey: trackKeys.list(params),
    queryFn: () => trackApi.getAll(params),
    staleTime: 5 * 60 * 1000, // Top tracks ít đổi, Cache hẳn 5 phút
    select: (response) => response.data.data as ITrack[],
  });
};

/**
 * 3. Lấy chi tiết 1 bài hát Public (Dành cho Trình phát nhạc)
 */
export const usePublicTrackDetail = (slugOrId: string) => {
  return useQuery({
    queryKey: trackKeys.detail(slugOrId),
    queryFn: () => trackApi.getTrackDetail(slugOrId), // Hoặc getById tùy cấu trúc Backend
    enabled: !!slugOrId,
    staleTime: 10 * 60 * 1000, // Chi tiết bài hát gần như không đổi, Cache 10 phút
    select: (response) => response.data as ITrack,
  });
};

// ============================================================================
// PHẦN B: ADMIN QUERIES (Dành cho Bảng điều khiển - Dashboard)
// Tính năng: Xem mọi trạng thái, có Polling theo dõi tiến trình upload/transcode
// ============================================================================

/**
 * 4. Lấy danh sách bài hát cho Admin (Kèm Smart Polling)
 */
export const useAdminTracks = (params: TrackFilterParams) => {
  return useQuery({
    queryKey: trackKeys.list(params),
    queryFn: () => trackApi.getAll(params),
    placeholderData: keepPreviousData,

    // 🔥 SMART POLLING: Chỉ tự động gọi lại API nếu có bài hát đang xử lý
    refetchInterval: (query) => {
      const currentTracks = query.state.data?.data?.data as
        | ITrack[]
        | undefined;
      if (!currentTracks || currentTracks.length === 0) return false;

      const hasProcessingTrack = currentTracks.some(
        (track) => track.status === "processing" || track.status === "pending",
      );

      // Nếu có track đang xử lý, gọi lại API mỗi 5 giây. Nếu không, dừng polling.
      return hasProcessingTrack ? 5000 : false;
    },

    select: (response) => ({
      tracks: response.data.data as ITrack[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

/**
 * 5. Lấy chi tiết 1 bài hát cho Admin (Đang Edit hoặc Xem log lỗi)
 */
export const useAdminTrackDetail = (id: string) => {
  return useQuery({
    queryKey: trackKeys.detail(id),
    queryFn: () => trackApi.getTrackDetail(id),
    enabled: !!id,

    // 🔥 SMART POLLING: Tự cập nhật trang Detail nếu hệ thống đang encode file Audio
    refetchInterval: (query) => {
      const track = query.state.data?.data as ITrack | undefined;
      if (!track) return false;

      const isProcessing =
        track.status === "processing" || track.status === "pending";
      return isProcessing ? 5000 : false;
    },

    select: (response) => response.data as ITrack,
  });
};
// ============================================================================
// PHẦN C: RECOMMENDATION QUERIES (Dành cho tính năng Cá nhân hóa & Autoplay)
// ============================================================================

/**
 * 6. Lấy danh sách "Bài hát bạn có thể thích" (Cá nhân hóa)
 * @param limit - Số lượng bài gợi ý
 * @param excludeTrackId - ID bài hát đang phát (để loại trừ khỏi danh sách)
 */
export const useRecommendedTracks = (limit = 20, excludeTrackId?: string) => {
  return useQuery({
    queryKey: trackKeys.recommendations({ limit, excludeTrackId }),
    queryFn: () => trackApi.getRecommendations(limit, excludeTrackId),
    // Chỉ fetch khi có data cần thiết (nếu cần thiết)
    staleTime: 1000 * 60 * 5, // Cache 5 phút vì gợi ý không cần cập nhật tức thời
    select: (response) => response.tracks,
  });
};

/**
 * 7. Lấy danh sách bài hát tương tự (Dùng cho Autoplay Queue)
 * @param trackId - Slug hoặc ID của bài hát gốc
 * @param limit - Số lượng bài tương tự
 */
export const useSimilarTracks = (trackId: string, limit = 10) => {
  return useQuery({
    queryKey: trackKeys.similar(trackId, { limit }),
    queryFn: () => trackApi.getSimilarTracks(trackId, limit),
    enabled: !!trackId, // Chỉ chạy khi có slugOrId
    staleTime: 1000 * 60 * 10, // Cache 10 phút, dữ liệu tương tự rất ổn định
    select: (response) => response.tracks,
  });
};
