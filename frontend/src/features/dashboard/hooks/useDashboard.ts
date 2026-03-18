import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboardApi";
import { DashboardRange } from "@/features/dashboard/schemas/dashboard.schema";

// Keys để quản lý cache
export const dashboardKeys = {
  all: ["dashboard"] as const,
  analytics: (range: string) =>
    [...dashboardKeys.all, "analytics", range] as const,
};

export const useDashboardAnalytics = (range: DashboardRange) => {
  return useQuery({
    // Cache key phụ thuộc vào range. Khi range đổi -> key đổi -> fetch lại
    queryKey: dashboardKeys.analytics(range),

    // Hàm gọi API
    queryFn: () => dashboardApi.getAnalytics(range),

    // --- CÁC TÙY CHỌN TỐI ƯU UX ---

    // 1. Giữ dữ liệu cũ hiển thị trong lúc đang fetch dữ liệu mới
    // (Tránh hiện loading spinner nhấp nháy khi đổi từ 7d sang 30d)
    placeholderData: keepPreviousData,

    // 2. Thời gian data được coi là "tươi" (Fresh)
    // Backend cache 10 phút, thì Frontend cũng nên để tầm 5-10 phút để đỡ spam request
    staleTime: 5 * 60 * 1000,

    // 3. Tự động fetch lại khi focus window (giúp dữ liệu realtime hơn)
    refetchOnWindowFocus: true,

    // 4. Retry nếu lỗi mạng (tối đa 2 lần)
    retry: 2,
  });
};
