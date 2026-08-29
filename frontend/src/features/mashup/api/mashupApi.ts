import api from "@/lib/axios";
import { MashupResponse, MashupFeedResponse, MashupSuggestResponse } from "../types";

export interface MashupListParams {
  search?: string;
  status?: "all" | "published" | "draft";
  type?: "all" | "auto" | "manual" | "ai";
  sortBy?: "createdAt" | "playCount" | "likeCount" | "totalDuration";
  page?: number;
  limit?: number;
}

export interface MashupListResponse {
  success: boolean;
  data: {
    mashups: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const mashupApi = {
  // ── User / Public ─────────────────────────────────────────────────────────
  getFeed: async (limit: number = 10, cursor?: string): Promise<MashupFeedResponse> => {
    const response = await api.get("/mashups/feed", { params: { limit, cursor } });
    return response.data;
  },

  getMyMashups: async (params?: MashupListParams): Promise<MashupListResponse> => {
    const response = await api.get("/mashups/my", { params });
    // Handle specific backend wrapper { success, data: { data: [], total } }
    const raw = response.data;
    return {
      success: raw.success,
      data: {
        mashups: raw.data?.data || [],
        total: raw.data?.total || 0,
        page: params?.page || 1,
        limit: params?.limit || 20,
        totalPages: Math.ceil((raw.data?.total || 0) / (params?.limit || 20)) || 1,
      },
    };
  },

  getMashupById: async (id: string): Promise<MashupResponse> => {
    const response = await api.get(`/mashups/${id}`);
    return response.data;
  },

  createMashup: async (data: any): Promise<MashupResponse> => {
    const response = await api.post("/mashups/create", data);
    return response.data;
  },

  suggestShorts: async (currentShortIds: string[]): Promise<MashupSuggestResponse> => {
    const response = await api.post("/mashups/suggest", { currentShortIds });
    return response.data;
  },

  likeMashup: async (id: string): Promise<any> => {
    const response = await api.post(`/mashups/${id}/like`);
    return response.data;
  },

  shareMashup: async (id: string): Promise<any> => {
    const response = await api.post(`/mashups/${id}/share`);
    return response.data;
  },

  aiGenerateMashup: async (prompt: string): Promise<MashupSuggestResponse> => {
    const response = await api.post("/mashups/ai-generate", { prompt });
    return response.data;
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminGetAll: async (params: MashupListParams = {}): Promise<MashupListResponse> => {
    // Falls back to feed endpoint with admin params if no dedicated admin route
    const response = await api.get("/mashups/feed", { params: { ...params, limit: params.limit || 100 } });
    // Normalize response to MashupListResponse shape
    const raw = response.data;
    return {
      success: raw.success,
      data: {
        mashups: raw.data?.feed || raw.data?.mashups || [],
        total: raw.data?.total || 0,
        page: params.page || 1,
        limit: params.limit || 100,
        totalPages: raw.data?.totalPages || 1,
      },
    };
  },

  adminUpdate: async (id: string, data: Partial<{ title: string; description: string; isPublished: boolean }>): Promise<MashupResponse> => {
    const response = await api.put(`/mashups/${id}`, data);
    return response.data;
  },

  adminDelete: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/mashups/${id}`);
    return response.data;
  },

  adminTogglePublish: async (id: string, isPublished?: boolean): Promise<MashupResponse> => {
    // Use publish/draft endpoints depending on desired state
    const endpoint = isPublished === false ? `/mashups/${id}/draft` : `/mashups/${id}/publish`;
    const response = await api.post(endpoint);
    return response.data;
  },
};
