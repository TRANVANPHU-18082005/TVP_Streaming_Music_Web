import {
  useQuery,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import playlistApi from "../api/playlistApi";
import { playlistKeys } from "../utils/playlistKeys";
import type { IPlaylist } from "../types";
import { APP_CONFIG } from "@/config/constants";
import {
  PlaylistAdminFilterParams,
  PlaylistFilterParams,
} from "../schemas/playlist.schema";

// ==========================================
// 1. PUBLIC QUERIES (Khám phá & Tìm kiếm)
// ==========================================

/**
 * Hook lấy danh sách Playlist Public (Phân trang, Lọc)
 */
export const usePlaylistsByUserQuery = (params: PlaylistFilterParams) => {
  return useQuery({
    queryKey: playlistKeys.list(params),
    queryFn: () => playlistApi.getPlaylistsByUser({ ...params }),

    // UX: Giữ data cũ khi chuyển trang -> Tránh Layout Shift
    placeholderData: keepPreviousData,

    // Performance: Cache 2 phút
    staleTime: 1000 * 60 * 2,

    // Select: Bóc tách data gọn gàng
    select: (response) => ({
      playlists: response.data.data as IPlaylist[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
/**
 * Hook lấy danh sách Playlist Public (Phân trang, Lọc)
 */
export const usePlaylistsByAdminQuery = (params: PlaylistAdminFilterParams) => {
  return useQuery({
    queryKey: playlistKeys.list(params),
    queryFn: () => playlistApi.getPlaylistsByAdmin({ ...params }),

    // UX: Giữ data cũ khi chuyển trang -> Tránh Layout Shift
    placeholderData: keepPreviousData,

    // Performance: Cache 2 phút
    staleTime: 1000 * 60 * 2,

    // Select: Bóc tách data gọn gàng
    select: (response) => ({
      playlists: response.data.data as IPlaylist[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};
export const usePlaylistTracksInfinite = (
  playlistId: string | undefined,
  limit = 20,
) => {
  return useInfiniteQuery({
    queryKey: playlistKeys.trackList(playlistId!, { limit }),

    queryFn: async ({ pageParam = 1 }) => {
      // 1. Phải gọi đúng API
      return playlistApi.getPlaylistTracks(playlistId!, {
        page: pageParam,
        limit,
      });
    },

    enabled: !!playlistId,
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
 * Hook lấy danh sách Playlist Nổi bật (Hệ thống tạo / Curated)
 * Dùng cho Trang Chủ
 */
export const useFeaturedPlaylists = (limit = APP_CONFIG.HOME_PAGE_LIMIT) => {
  const params: PlaylistFilterParams = {
    limit,
    sort: "popular",
  };

  return useQuery({
    queryKey: playlistKeys.list(params),
    queryFn: () => playlistApi.getPlaylistsByUser({ ...params }),
    staleTime: 1000 * 60 * 15, // Playlist hệ thống ít đổi, cache 15 phút
    select: (response) => response.data.data as IPlaylist[],
  });
};

/**
 * Hook lấy Chi tiết Playlist
 */
export const usePlaylistDetail = (slugOrId: string) => {
  return useQuery({
    queryKey: playlistKeys.detail(slugOrId),
    queryFn: () => playlistApi.getDetail(slugOrId),
    enabled: !!slugOrId,
    staleTime: 1000 * 60 * 2, // Cache 2 phút (để cập nhật nhanh khi có người thêm/bớt bài hát)
    retry: 1,
    select: (response) => response.data,
  });
};

// ==========================================
// 2. PERSONAL QUERIES (Thư viện cá nhân)
// ==========================================

/**
 * Hook lấy danh sách Playlist của User đang đăng nhập (My Library)
 */
export const useMyPlaylists = () => {
  return useQuery({
    queryKey: playlistKeys.myList(), // Key riêng biệt
    queryFn: () => playlistApi.getMyLibrary(),
    staleTime: 1000 * 60 * 5,
    select: (response) => response.data.data,
  });
};
