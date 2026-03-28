import { useQuery, keepPreviousData } from "@tanstack/react-query";
import profileApi from "../api/profileApi";
import { profileKeys } from "../utils/profileKeys";
import type { LikedContentParams } from "../types";

/**
 * 1. Hook Dashboard (Sử dụng cho trang chính Profile)
 * Fetch 1 lần lấy toàn bộ: Analytics, Playlists, và Preview Liked
 */
export const useProfileDashboard = () => {
  return useQuery({
    queryKey: profileKeys.dashboard(),
    queryFn: profileApi.getDashboard,
    staleTime: 5 * 60 * 1000, // Dashboard ít thay đổi, cache 5 phút
    select: (res) => res.data,
  });
};

/**
 * 2. Hook Liked Content (Dùng cho trang "Xem tất cả" bài hát/album đã thích)
 * Hỗ trợ phân trang mượt mà với placeholderData
 */
export const useLikedContent = (params: LikedContentParams) => {
  return useQuery({
    queryKey: profileKeys.liked(params),
    queryFn: () => profileApi.getLikedContent(params),
    placeholderData: keepPreviousData, // Tránh giật lag khi chuyển trang
    staleTime: 2 * 60 * 1000,
    enabled: !!params.type, // Chỉ chạy khi xác định được user muốn xem Track hay Album
    select: (res) => ({
      items: res.data,
      meta: res.meta,
    }),
  });
};

/**
 * 3. Hook Analytics (Nếu chỉ muốn refresh biểu đồ mà không load lại cả trang)
 */
export const useProfileAnalytics = () => {
  return useQuery({
    queryKey: profileKeys.analytics(),
    queryFn: profileApi.getAnalytics,
    staleTime: 15 * 60 * 1000, // Dữ liệu biểu đồ cache lâu hơn (15p)
    select: (res) => res.data,
  });
};

/**
 * 4. Hook Playlists cá nhân
 */
export const useMyPlaylists = () => {
  return useQuery({
    queryKey: profileKeys.playlists(),
    queryFn: profileApi.getMyPlaylists,
    select: (res) => res.data,
  });
};
