import {
  useQuery,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import artistApi from "../api/artistApi";
import { artistKeys } from "@/features/artist/utils/artistKeys";
import type { ArtistFilterParams } from "../types";

// ==========================================
// 1. PUBLIC HOOKS (Dành cho Người dùng cuối)
// ==========================================

/**
 * Hook lấy danh sách Nghệ sĩ (Có phân trang & Lọc)
 * - Tối ưu UX: Không bị giật layout khi chuyển trang nhờ `keepPreviousData`
 * - Tối ưu Data: Bóc tách sẵn `artists` và `meta`
 */
export const useArtistsQuery = (params: ArtistFilterParams) => {
  return useQuery({
    queryKey: artistKeys.list(params),
    queryFn: () => artistApi.getArtists(params),

    // UX: Giữ data cũ trên màn hình trong lúc fetch data trang mới -> Tránh Layout Shift
    placeholderData: keepPreviousData,

    // Performance: Dữ liệu public ít thay đổi liên tục, cache 5 phút là hợp lý
    staleTime: 1000 * 60 * 5,

    // Select: Bóc tách data ngay tại Hook, Component không cần gọi `data.data.data` nữa
    select: (response) => ({
      artists: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

/**
 * Hook lấy danh sách Nghệ sĩ nổi bật (Trang chủ)
 */
export const useSpotlightArtists = (limit = 10) => {
  return useQuery({
    // Đảm bảo queryKey phản ánh đúng params được truyền vào API
    queryKey: artistKeys.list({ sort: "popular", limit, isActive: true }),
    queryFn: () =>
      artistApi.getArtists({
        page: 1,
        limit,
        sort: "popular",
        isActive: true,
      }),
    staleTime: 1000 * 60 * 10, // Cache 10 phút vì độ hot không thay đổi từng giây
    select: (response) => response.data.data, // Chỉ trả về mảng artists
  });
};

/**
 * Hook lấy chi tiết 1 Nghệ sĩ (Theo ID hoặc Slug)
 */
export const useArtistDetail = (slugOrId: string) => {
  return useQuery({
    queryKey: artistKeys.detail(slugOrId),
    queryFn: () => artistApi.getDetail(slugOrId),
    enabled: !!slugOrId, // Chỉ chạy khi có ID/Slug hợp lệ
    staleTime: 1000 * 60 * 5,
    select: (response) => response.data, // Bóc tách thẳng data của artist
  });
};
export const useArtistTracksInfinite = (
  albumId: string | undefined,
  limit = 20,
) => {
  return useInfiniteQuery({
    queryKey: artistKeys.trackList(albumId!, { limit }),

    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return artistApi.getArtistTracks(albumId!, { page: pageParam, limit });
    },

    enabled: !!albumId,
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
// ==========================================
// 2. STUDIO HOOKS (Dành cho Nghệ sĩ tự quản lý)
// ==========================================

/**
 * Hook lấy Profile của chính Nghệ sĩ đang đăng nhập
 */
export const useMyArtistProfile = () => {
  return useQuery({
    queryKey: artistKeys.profile(),
    queryFn: artistApi.getMyProfile,
    retry: 1, // Không retry nhiều lần nếu họ chưa phải là artist (tránh spam API lỗi 403/404)
    select: (response) => response.data,
  });
};
