// features/dashboard/hooks/useDashboard.ts

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/features/dashboard/api/dashboardApi";
import { DashboardData, DashboardRange } from "@/features/dashboard/types";

const DASHBOARD_QUERY_KEY = (range: DashboardRange) => [
  "dashboard",
  "analytics",
  range,
];

// Refetch interval: 5 phút
// - Ngắn hơn DASHBOARD_CACHE_TTL (10 phút) để UI luôn sync với fresh cache
// - Kết hợp với SWR backend: lần refetch đầu thường nhận stale=false (fresh)
const REFETCH_INTERVAL = 5 * 60 * 1000;

export interface UseDashboardAnalyticsResult {
  data: DashboardData | undefined;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean; // NEW: backend SWR flag — true = data đang được refresh ngầm
  isRefetching: boolean;
  refetch: () => void;
}

export function useDashboardAnalytics(
  range: DashboardRange = "7d",
): UseDashboardAnalyticsResult {
  const query = useQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY(range),
    queryFn: () => dashboardApi.getAnalytics(range),
    staleTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    // Đọc isStale từ _meta được backend inject vào response
    isStale: query.data?._meta?.isStale ?? false,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
