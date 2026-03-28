import { useQuery, keepPreviousData } from "@tanstack/react-query";
import playlistApi from "../api/playlistApi";
import { playlistKeys } from "../utils/playlistKeys";
import type { PlaylistFilterParams, Playlist } from "../types";

// ==========================================
// 1. PUBLIC QUERIES (Khám phá & Tìm kiếm)
// ==========================================

/**
 * Hook lấy danh sách Playlist Public (Phân trang, Lọc)
 */
export const usePlaylistsQuery = (params: PlaylistFilterParams) => {
  return useQuery({
    queryKey: playlistKeys.list(params),
    queryFn: () => playlistApi.getAll({ ...params }),

    // UX: Giữ data cũ khi chuyển trang -> Tránh Layout Shift
    placeholderData: keepPreviousData,

    // Performance: Cache 2 phút
    staleTime: 1000 * 60 * 2,

    // Select: Bóc tách data gọn gàng
    select: (response) => ({
      playlists: response.data.data as Playlist[],
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

/**
 * Hook lấy danh sách Playlist Nổi bật (Hệ thống tạo / Curated)
 * Dùng cho Trang Chủ
 */
export const useFeaturedPlaylists = (limit = 10) => {
  const params: PlaylistFilterParams = {
    limit,
    sort: "popular",
    isSystem: true, // Thường hiển thị playlist của Hệ thống trên trang chủ
    visibility: "public",
  };

  return useQuery({
    queryKey: playlistKeys.list(params),
    queryFn: () => playlistApi.getAll(params),
    staleTime: 1000 * 60 * 15, // Playlist hệ thống ít đổi, cache 15 phút
    select: (response) => response.data.data as Playlist[],
  });
};

/**
 * Hook lấy Chi tiết Playlist
 */
export const usePlaylistDetail = (slugOrId: string) => {
  return useQuery({
    queryKey: playlistKeys.detail(slugOrId),
    queryFn: () => playlistApi.getById(slugOrId),
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
    queryKey: playlistKeys.list({ type: "all" }), // Key riêng biệt
    queryFn: () => playlistApi.getMyPlaylists(),
    staleTime: 1000 * 60 * 5,
    select: (response) => response.data.data as Playlist[],
  });
};
/**
 * Hook lấy danh sách Playlist của chính User đang đăng nhập
 * Dùng cho Sidebar hoặc trang My Playlists trong Profile
 */
export const useMyLibraryQuery = (params?: PlaylistFilterParams) => {
  return useQuery({
    // Sử dụng một queryKey riêng biệt ['playlists', 'me'] để tránh cache chung với public lists
    queryKey: [...playlistKeys.all, "me", params],
    queryFn: () => playlistApi.getMyLibrary(params),
    staleTime: 1000 * 60 * 5, // Cache 5 phút
    select: (response) => ({
      playlists: response.data.data as Playlist[],
      meta: response.data.meta,
    }),
  });
};
