import api from "@/lib/axios";
import { ITrack } from "@/features/track/types";

export interface RecommendationResponse {
  success: boolean;
  data: {
    tracks: ITrack[];
    meta: {
      total: number;
      userId: string;
    };
  };
}

export const recommendationApi = {
  getForMeFeed: async (limit: number = 20): Promise<RecommendationResponse> => {
    const response = await api.get(`/tracks/recommendations`, {
      params: { limit },
    });
    return response.data;
  },
};
