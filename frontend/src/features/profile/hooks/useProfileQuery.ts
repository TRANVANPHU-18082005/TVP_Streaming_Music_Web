import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import profileApi from "../api/profileApi";
import { profileKeys } from "../utils/profileKeys";

/**
 * 1. Hook Dashboard (Sử dụng cho cả HomePage và ProfilePage)
 * @param mode 'essential' (Dữ liệu nhẹ cho Home) | 'full' (Đầy đủ cho Profile)
 */
export const useProfileDashboard = (mode: "full" | "essential" = "full") => {
  return useQuery({
    // Thêm mode vào queryKey để React Query phân biệt cache giữa Home và Profile
    queryKey: [...profileKeys.dashboard(), mode],
    queryFn: () => profileApi.getDashboard({ mode }),
    staleTime: mode === "essential" ? 1 * 60 * 1000 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (res) => res.data,
  });
};

/**
 * 2. Hook Analytics (Dành riêng cho tab Overview/Biểu đồ)
 */
export const useProfileAnalytics = () => {
  return useQuery({
    queryKey: profileKeys.analytics(),
    queryFn: profileApi.getAnalytics,
    staleTime: 15 * 60 * 1000, // Dữ liệu thống kê không cần làm mới liên tục
    select: (res) => res.data,
  });
};

/**
 * 4. Hook Library (Lấy danh sách Playlist cá nhân)
 */
export const useUserLibrary = () => {
  return useQuery({
    queryKey: [...profileKeys.all, "library"],
    queryFn: profileApi.getLibrary,
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data,
  });
};

// ── HOOK: LẤY BÀI HÁT YÊU THÍCH ──────────────────────────────────────────
export const useFavouriteTracksInfinite = (limit = 20) => {
  return useInfiniteQuery({
    queryKey: profileKeys.favouriteTracks({ limit }),

    queryFn: async ({ pageParam = 1 }) => {
      // Gọi profileApi đã nâng cấp ở bước trước
      return profileApi.getFavouriteTracks({ page: pageParam, limit });
    },

    initialPageParam: 1,

    // Logic lấy trang tiếp theo từ meta backend
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta;
      return page < totalPages ? page + 1 : undefined;
    },

    // Phẳng hóa dữ liệu để render Virtual Scroll
    select: (data) => ({
      allTracks: data.pages.flatMap((page) => page.data.data),
      totalItems: data.pages[0]?.data.meta.totalItems ?? 0,
      meta: data.pages[data.pages.length - 1]?.data.meta,
    }),

    staleTime: 2 * 60 * 1000, // Nhạc yêu thích cho phép cache 2 phút
  });
};

// ── HOOK: LẤY LỊCH SỬ NGHE NHẠC ──────────────────────────────────────────
export const useRecentlyPlayedInfinite = (limit = 20) => {
  return useInfiniteQuery({
    queryKey: profileKeys.recentlyPlayed({ limit }),

    queryFn: async ({ pageParam = 1 }) => {
      return profileApi.getRecentlyPlayed({ page: pageParam, limit });
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta;
      return page < totalPages ? page + 1 : undefined;
    },

    select: (data) => ({
      allTracks: data.pages.flatMap((page) => page.data.data),
      totalItems: data.pages[0]?.data.meta.totalItems ?? 0,
      meta: data.pages[data.pages.length - 1]?.data.meta,
    }),

    // Recently played nên để staleTime thấp hoặc = 0 để luôn cập nhật bài vừa nghe xong
    staleTime: 0,
  });
};
