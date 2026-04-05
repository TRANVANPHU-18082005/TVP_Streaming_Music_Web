import { useQuery } from "@tanstack/react-query";
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

/**
 * 5. Hook Recently Played (Lấy lịch sử nghe nhạc)
 */
export const useRecentlyPlayed = (limit: number = 10) => {
  return useQuery({
    queryKey: [...profileKeys.all, "recently-played", limit],
    queryFn: () => profileApi.getRecentlyPlayed(limit),
    staleTime: 30 * 1000, // Lịch sử nên được làm mới thường xuyên hơn
    select: (res) => res.data,
  });
};
