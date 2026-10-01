import api from "@/lib/axios";
import { AnalyticsResponse } from "../types";

const analyticsApi = {
  getRealtimeStats: async (): Promise<AnalyticsResponse> => {
    const { data } = await api.get("/analytics/realtime");
    return data;
  },
};

export default analyticsApi;
