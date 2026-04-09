import {
  useQuery,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import albumApi from "../api/albumApi";
import { albumKeys } from "../utils/albumKeys";
import type { AlbumFilterParams, IAlbum } from "../types";

// ==========================================
// 1. PUBLIC LISTS (Trang Albums, Search)
// ==========================================
export const useAlbumsQuery = (params: AlbumFilterParams) => {
  return useQuery({
    queryKey: albumKeys.list(params),
    queryFn: () => albumApi.getAlbums({ ...params }),

    // Giữ data cũ trên màn hình trong lúc fetch data trang mới -> Tránh Layout Shift
    placeholderData: keepPreviousData,

    // Cache 2 phút (List có thể thay đổi thứ tự/số lượng)
    staleTime: 2 * 60 * 1000,

    // Bóc tách data ngay tại Hook, Component gọi ra là xài được luôn
    select: (response) => ({
      albums: response.data.data as IAlbum[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
// ==========================================
// 2. SPOTLIGHTS (Trang Home / Khám phá)
// ==========================================
export const useNewReleases = (limit = 10) => {
  // Fix cứng params để đảm bảo queryKey luôn match chuẩn xác
  const params: AlbumFilterParams = { limit, sort: "newest", isPublic: true };

  return useQuery({
    queryKey: albumKeys.list(params),
    queryFn: () => albumApi.getAlbums(params),
    staleTime: 5 * 60 * 1000, // Cache 5 phút
    select: (response) => response.data.data as IAlbum[],
  });
};
// ==========================================
// 3. FEATURE ALBUMS
// ==========================================
export const useFeatureAlbums = (limit = 10) => {
  const params: AlbumFilterParams = { limit, sort: "popular", isPublic: true };

  return useQuery({
    queryKey: albumKeys.list(params),
    queryFn: () => albumApi.getAlbums(params),
    staleTime: 10 * 60 * 1000, // Cache 10 phút (Popular ít biến động hơn)
    select: (response) => response.data.data as IAlbum[],
  });
};
// ==========================================
// 4. DETAIL & RELATED (Trang Chi tiết Album)
// ==========================================
export const useAlbumDetail = (slugOrId: string) => {
  return useQuery({
    queryKey: albumKeys.detail(slugOrId),
    queryFn: () => albumApi.getDetail(slugOrId),

    // Chỉ chạy query nếu slugOrId tồn tại (tránh lỗi gọi API rỗng)
    enabled: !!slugOrId,

    // Cache 30 phút vì chi tiết Album (Tên, cover, tracklist) rất hiếm khi thay đổi
    staleTime: 30 * 60 * 1000,
    retry: 1, // Nếu sai slug/id (404) thì không cần retry nhiều lần làm nghẽn mạng

    // Bóc tách thẳng vào object data (để xài res.data thay vì res.data.data)
    select: (response) => response.data,
  });
};
// ==========================================
// 5. ALBUM TRACKS (Dùng cho trang Detail để hiển thị danh sách bài hát trong Album)
// ==========================================
export const useAlbumTracksInfinite = (
  albumId: string | undefined,
  limit = 20,
) => {
  return useInfiniteQuery({
    queryKey: albumKeys.trackList(albumId!, { limit }),

    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return albumApi.getAlbumTracks(albumId!, { page: pageParam, limit });
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
/**
 * Hook lấy Album liên quan (Ví dụ: Cùng Thể loại)
 * Dùng để hiển thị ở mục "Có thể bạn cũng thích" cuối trang Detail.
 */
export const useRelatedAlbums = (currentAlbumId: string, genreId?: string) => {
  const params: AlbumFilterParams = {
    limit: 6, // Fetch dư ra 1 cái để phòng trường hợp bị trùng với currentAlbumId
    genreId,
    isPublic: true,
  };

  return useQuery({
    // Sử dụng currentAlbumId trong key ảo để buộc query cache riêng cho từng trang detail
    queryKey: ["albums", "related", currentAlbumId, genreId],

    queryFn: () => albumApi.getAlbums(params),

    enabled: !!currentAlbumId && !!genreId, // Buộc phải có đủ ID và Genre
    staleTime: 15 * 60 * 1000, // Cache 15 phút

    // Select: Lọc bỏ chính bài đang xem ở Client-side (Trường hợp Backend không hỗ trợ query exclude)
    select: (response) => {
      const albums = response.data.data as IAlbum[];
      return albums.filter((album) => album._id !== currentAlbumId).slice(0, 5); // Cắt lấy đúng 5 album liên quan sau khi đã lọc
    },
  });
};
