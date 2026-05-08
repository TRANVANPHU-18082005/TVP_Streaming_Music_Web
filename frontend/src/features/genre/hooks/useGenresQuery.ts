import {
  useQuery,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import genreApi from "../api/genreApi";
import { genreKeys } from "../utils/genreKeys";
import {   IGenre } from "../types";
import { APP_CONFIG } from "@/config/constants";
import { GenreAdminFilterParams, GenreFilterParams } from "../schemas/genre.schema";

// 1. Hook lấy danh sách thể loại theo filter params (Dùng cho trang list và homepage)
export const useGenresByUserQuery = (params: GenreFilterParams) => {
  return useQuery({
    // Key unique dựa trên filter params
    queryKey: genreKeys.list(params),

    // Hàm fetch data
    queryFn: () => genreApi.getGenresByUser(params),

    // UX: Giữ data cũ khi chuyển trang -> Không bị nháy Loading (Skeleton chỉ hiện lần đầu)
    placeholderData: keepPreviousData,

    // Performance: Cache data trong 1 phút.
    // Nếu user qua tab khác rồi quay lại ngay, data sẽ hiện tức thì từ cache.
    staleTime: 1000 * 60,

    // Optimization: Transform data ngay tại đây để UI gọn gàng
    select: (response) => ({
      genres: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
// 2 . Lấy danh sách cho admin (Có thêm filter isActive, isTrending, isDeleted)
export const useGenresByAdminQuery = (params: GenreAdminFilterParams) => {
  return useQuery({
    // Key unique dựa trên filter params
    queryKey: genreKeys.list(params),
    // Hàm fetch data
    queryFn: () => genreApi.getGenresByAdmin(params),

    // UX: Giữ data cũ khi chuyển trang -> Không bị nháy Loading (Skeleton chỉ hiện lần đầu)
    placeholderData: keepPreviousData,

    // Performance: Cache data trong 1 phút.
    // Nếu user qua tab khác rồi quay lại ngay, data sẽ hiện tức thì từ cache.
    staleTime: 1000 * 60,

    // Optimization: Transform data ngay tại đây để UI gọn gàng
    select: (response) => ({
      genres: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
// 3. Hook lấy danh sách thể loại đang trending (Dùng cho homepage)
export const useTrendingGenres = (limit = APP_CONFIG.HOME_PAGE_LIMIT) => {
  const params: GenreFilterParams = {
    page: 1,
    limit: limit,
    isTrending: true,
    sort: "priority",
  };
  return useQuery({
    queryKey: genreKeys.list(params),
    queryFn: () => genreApi.getGenresByUser(params),
    staleTime: 1000 * 60 * 15, // Genre hệ thống ít đổi, cache 15 phút
    select: (response) => response.data.data as IGenre[],
  });
};
// 4. Hook lấy cấu trúc cây thể loại (Dùng cho dropdown chọn thể loại khi tạo/sửa track, album, artist)
export const useGenreTreeQuery = () => {
  return useQuery({
    queryKey: genreKeys.tree(),
    queryFn: genreApi.getTree,

    // Tree ít khi thay đổi, cache lâu hơn (5 phút)
    staleTime: 1000 * 60 * 5,

    select: (response) => response.data, // Trả về mảng Genre[] dạng cây
  });
};

// 5. Hook lấy chi tiết thể loại theo slug (Dùng cho trang detail)
export const useGenreDetailQuery = (slug: string, enabled = true) => {
  return useQuery({
    queryKey: genreKeys.detail(slug),
    queryFn: () => genreApi.getGenreDetail(slug),
    enabled: !!slug && enabled, // Chỉ fetch khi có slug
    staleTime: 1000 * 60,
    select: (response) => response.data,
  });
};
// 6. Hook lấy tracks theo genre id với phân trang vô hạn (Dùng cho trang detail khi cuộn xuống phần track list)
export const useGenreTracksInfinite = (
  genreId: string | undefined,
  limit = 20,
) => {
  return useInfiniteQuery({
    queryKey: genreKeys.trackList(genreId!, { limit }),

    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return genreApi.getGenreTracks(genreId!, { page: pageParam, limit });
    },

    enabled: !!genreId,
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
