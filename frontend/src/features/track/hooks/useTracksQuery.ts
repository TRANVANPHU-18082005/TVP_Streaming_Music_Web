import {
  useQuery,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import trackApi from "../api/trackApi";
import { trackKeys } from "../utils/trackKeys";
import type { ITrack } from "../types";
import { TrackFilterParams } from "../schemas/track.schema";
import { APP_CONFIG } from "@/config/constants";

// ============================================================================
// PHẦN A: PUBLIC QUERIES (Dành cho Người dùng cuối - Client)
// Bảo mật: Tự động ép điều kiện chỉ hiển thị bài hát đã sẵn sàng (status: "ready")
// ============================================================================

/**
 * 1. Lấy danh sách bài hát Public (Phân trang, Tìm kiếm, Lọc)
 */
export const usePublicTracks = (params: TrackFilterParams) => {
  // Ghi đè/Ép kiểu status luôn là "ready"
  const publicParams: TrackFilterParams = { ...params, status: "ready" };

  return useQuery({
    queryKey: trackKeys.list(publicParams),
    queryFn: () => trackApi.getTracks(publicParams),
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
    queryFn: () => trackApi.getTracks(params),
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
    queryFn: ({ signal }) => trackApi.getTrackDetail(slugOrId, { signal }), // pass signal for cancellation
    enabled: !!slugOrId,
    staleTime: 10 * 60 * 1000, // Chi tiết bài hát gần như không đổi, Cache 10 phút
    select: (response) => response,
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
    queryFn: () => trackApi.getTracks(params),
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
    queryFn: ({ signal }) => trackApi.getTrackDetail(id, { signal }),
    enabled: !!id,

    // 🔥 SMART POLLING: Tự cập nhật trang Detail nếu hệ thống đang encode file Audio
    refetchInterval: (query) => {
      const track = query.state.data as ITrack | undefined;
      if (!track) return false;

      const isProcessing =
        track.status === "processing" || track.status === "pending";
      return isProcessing ? 5000 : false;
    },

    select: (response) => response,
  });
};
/**
 * Hook lấy danh sách Playlist Nổi bật (Hệ thống tạo / Curated)
 * Dùng cho Trang Chủ
 */
export const useFeaturedTracks = (limit = APP_CONFIG.HOME_PAGE_LIMIT) => {
  const params: TrackFilterParams = {
    limit,
    sort: "popular",
    status: "ready",
    isPublic: true,
    isDeleted: false,
  };

  return useQuery({
    queryKey: trackKeys.list(params),
    queryFn: () => trackApi.getTracks(params),
    staleTime: 1000 * 60 * 15, // Playlist hệ thống ít đổi, cache 15 phút
    select: (response) => response.data.data as ITrack[],
  });
};

/**
 * Infinite query: Top Hot Tracks Today (paged)
 */
export const useTopHotTracksInfinite = (limit = APP_CONFIG.HOME_PAGE_LIMIT) => {
  return useInfiniteQuery({
    queryKey: trackKeys.topHotToday({ limit }),
    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return trackApi.getTopHotTracksToday({
        page: pageParam,
        limit,
      });
    },
    initialPageParam: 1,

    // 2. Fix đường dẫn lấy Meta: response (ApiResponse) -> data (PagedResponse) -> meta
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta;
      return page < totalPages ? page + 1 : undefined;
    },

    placeholderData: (previousData) => previousData,

    // 3. Fix Select: Truy cập đúng cấu trúc ApiResponse -> PagedResponse -> data (mảng tracks)
    // Lưu ý: Trong ApiResponse của bạn, mảng tracks nằm trong field 'data' của PagedResponse
    select: (data) => ({
      allTracks: data.pages.flatMap((page) => page.data.data), // Phẳng hóa mảng ITrack
      totalItems: data.pages[0]?.data.meta.totalItems ?? 0,
      meta: data.pages[data.pages.length - 1]?.data.meta,
    }),

    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Infinite query: Top Favourite Tracks (paged)
 */
export const useTopFavouriteTracksInfinite = (
  limit = APP_CONFIG.HOME_PAGE_LIMIT,
) => {
  return useInfiniteQuery({
    queryKey: trackKeys.topFavourite({ limit }),
    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return trackApi.getTopFavouriteTracks({
        page: pageParam,
        limit,
      });
    },
    initialPageParam: 1,

    // 2. Fix đường dẫn lấy Meta: response (ApiResponse) -> data (PagedResponse) -> meta
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta;
      return page < totalPages ? page + 1 : undefined;
    },

    placeholderData: (previousData) => previousData,

    // 3. Fix Select: Truy cập đúng cấu trúc ApiResponse -> PagedResponse -> data (mảng tracks)
    // Lưu ý: Trong ApiResponse của bạn, mảng tracks nằm trong field 'data' của PagedResponse
    select: (data) => ({
      allTracks: data.pages.flatMap((page) => page.data.data), // Phẳng hóa mảng ITrack
      totalItems: data.pages[0]?.data.meta.totalItems ?? 0,
      meta: data.pages[data.pages.length - 1]?.data.meta,
    }),

    staleTime: 5 * 60 * 1000,
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
