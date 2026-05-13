import {
  useQuery,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import artistApi from "../api/artistApi";
import { artistKeys } from "@/features/artist/utils/artistKeys";

import { APP_CONFIG } from "@/config/constants";
import { ArtistFilterParams } from "../schemas/artist.schema";

// ==========================================
// 1. PUBLIC HOOKS (Dành cho Người dùng cuối)
// ==========================================

/**
 * Hook lấy danh sách Nghệ sĩ (Có phân trang & Lọc)
 * - Tối ưu UX: Không bị giật layout khi chuyển trang nhờ `keepPreviousData`
 * - Tối ưu Data: Bóc tách sẵn `artists` và `meta`
 */
export const useArtistsByUserQuery = (params: ArtistFilterParams) => {
  return useQuery({
    queryKey: artistKeys.list(params),
    queryFn: () => artistApi.getArtistsByUser(params),

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
 * Hook lấy danh sách Nghệ sĩ (Có phân trang & Lọc)
 * - Tối ưu UX: Không bị giật layout khi chuyển trang nhờ `keepPreviousData`
 * - Tối ưu Data: Bóc tách sẵn `artists` và `meta`
 */
export const useArtistsByAdminQuery = (params: ArtistFilterParams) => {
  return useQuery({
    queryKey: artistKeys.list(params),
    queryFn: () => artistApi.getArtistsByAdmin(params),

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
export const useSpotlightArtists = (limit = APP_CONFIG.HOME_PAGE_LIMIT) => {
  return useQuery({
    // Đảm bảo queryKey phản ánh đúng params được truyền vào API
    queryKey: artistKeys.list({ sort: "popular", limit, isActive: true }),
    queryFn: () =>
      artistApi.getArtistsByUser({
        page: 1,
        limit,
        sort: "popular",
      }),
    staleTime: 1000 * 60 * 10, // Cache 10 phút vì độ hot không thay đổi từng giây
    select: (response) => response.data.data, // Chỉ trả về mảng artists
  });
};

/**
 * Hook lấy chi tiết 1 Nghệ sĩ (Theo ID hoặc Slug)
 */
export const useArtistDetail = (slug: string) => {
  return useQuery({
    queryKey: artistKeys.detail(slug),
    queryFn: () => artistApi.getArtistDetail(slug),
    enabled: !!slug, // Chỉ chạy khi có Slug hợp lệ
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

/**
 * Hook lấy danh sách Nghệ sĩ mà user đang follow
 */
export const useMyFollowedArtists = (params: ArtistFilterParams) => {
  return useQuery({
    queryKey: artistKeys.following(params),
    queryFn: () => artistApi.getMyFollowedArtists(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    select: (response) => ({
      artists: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
