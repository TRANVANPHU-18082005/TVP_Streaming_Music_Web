import api from "@/lib/axios";
import { ITrack } from "@/features/track/types";
import { IAlbum } from "@/features/album/types";
import { IPlaylist } from "@/features/playlist/types";

export interface FeedItemData {
  type: "track" | "album" | "playlist";
  data: ITrack | IAlbum | IPlaylist;
  reason: string;
}

export interface RecommendationResponse {
  success: boolean;
  data: {
    tracks: ITrack[];
    meta: {
      total: number;
      userId: string;
      needsTaste?: boolean;
    };
  };
}

export interface UnifiedFeedResponse {
  success: boolean;
  data: {
    feed: FeedItemData[];
    meta: {
      total: number;
      userId: string;
    };
  };
}

export const recommendationApi = {
  getForMeFeed: async (
    limit: number = 10,
    options?: {
      session?: boolean;
      excludeIds?: string[];
      genreIds?: string[];
      mix?: number;
      mood?: "focus" | "sad" | "energy";
    },
  ): Promise<RecommendationResponse> => {
    const response = await api.get(`/tracks/recommendations`, {
      params: {
        limit,
        session: options?.session ? 1 : undefined,
        excludeIds: options?.excludeIds?.length ? options.excludeIds.join(",") : undefined,
        genreIds: options?.genreIds?.length ? options.genreIds.join(",") : undefined,
        mix: options?.mix,
        mood: options?.mood,
      },
    });
    return response.data;
  },
  refreshSession: async () => {
    const response = await api.post(`/tracks/recommendations/refresh`, {});
    return response.data;
  },
  sendFeedback: async (trackId: string, action: "skip" | "dismiss") => {
    const response = await api.post(`/tracks/recommendations/feedback`, {
      trackId,
      action,
    });
    return response.data;
  },
  getUnifiedFeed: async (limit: number = 20): Promise<UnifiedFeedResponse> => {
    const response = await api.get(`/tracks/recommendations/feed`, {
      params: { limit },
    });
    return response.data;
  },
  getRecommendedAlbums: async (limit: number = 10) => {
    const response = await api.get(`/tracks/recommendations/albums`, { params: { limit } });
    return response.data;
  },
  getRecommendedPlaylists: async (limit: number = 10) => {
    const response = await api.get(`/tracks/recommendations/playlists`, { params: { limit } });
    return response.data;
  },
  getTrendingAlbums: async (limit: number = 10) => {
    const response = await api.get(`/tracks/top/trending-albums`, { params: { limit } });
    return response.data;
  },
  getTrendingPlaylists: async (limit: number = 10) => {
    const response = await api.get(`/tracks/top/trending-playlists`, { params: { limit } });
    return response.data;
  }
};
