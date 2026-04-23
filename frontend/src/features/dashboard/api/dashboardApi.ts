// features/dashboard/api/dashboardApi.ts

import {
  DashboardData,
  DashboardRange,
  DashboardResponse,
} from "@/features/dashboard/types";
import api from "@/lib/axios";

export const dashboardApi = {
  getAnalytics: async (
    range: DashboardRange = "7d",
  ): Promise<DashboardData> => {
    const response = await api.get<DashboardResponse>("/dashboard/analytics", {
      params: { range },
    });
    // Backend trả về { status, data: DashboardData }
    // DashboardData bây giờ bao gồm cả _meta.isStale
    return response.data.data;
  },
};
