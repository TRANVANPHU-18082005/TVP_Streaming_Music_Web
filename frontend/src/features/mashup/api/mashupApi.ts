import api from "@/lib/axios";
import { MashupResponse, MashupFeedResponse, MashupSuggestResponse } from "../types";

export const mashupApi = {
  getFeed: async (limit: number = 10, cursor?: string): Promise<MashupFeedResponse> => {
    const response = await api.get("/mashups/feed", { params: { limit, cursor } });
    return response.data;
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

  aiGenerateMashup: async (): Promise<MashupSuggestResponse> => {
    const response = await api.get("/mashups/ai-generate");
    return response.data;
  }
};
