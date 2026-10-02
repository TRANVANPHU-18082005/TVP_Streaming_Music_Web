import api from "@/lib/axios";
import { ShortsResponse, ShortsListResponse, ShortsFeedResponse } from "../types";

export const shortsApi = {
  // Public Feed
  getShortsFeed: async (limit: number = 10, cursor?: string): Promise<ShortsFeedResponse> => {
    const response = await api.get("/shorts/feed", { params: { limit, cursor } });
    return response.data;
  },
  
  recordView: async (id: string): Promise<any> => {
    const response = await api.post(`/shorts/${id}/view`);
    return response.data;
  },

  getPublished: async (params?: { page?: number; limit?: number; search?: string }): Promise<ShortsListResponse> => {
    const response = await api.get("/shorts/catalog", { params });
    return response.data;
  },

  getMyShorts: async (params?: { page?: number; limit?: number }): Promise<ShortsListResponse> => {
    const response = await api.get("/shorts/my", { params });
    return response.data;
  },

  likeShort: async (id: string): Promise<{ success: boolean; data: { likeCount: number; liked: boolean } }> => {
    const response = await api.post(`/shorts/${id}/like`);
    return response.data;
  },

  shareShort: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.post(`/shorts/${id}/share`);
    return response.data;
  },

  rejectShort: async (id: string, reason?: string): Promise<ShortsResponse> => {
    const response = await api.patch(`/shorts/${id}/reject`, { reason });
    return response.data;
  },

  getShortById: async (id: string): Promise<ShortsResponse> => {
    const response = await api.get(`/shorts/${id}`);
    return response.data;
  },

  // Admin
  getAllShorts: async (params: any): Promise<ShortsListResponse> => {
    const response = await api.get("/shorts", { params });
    return response.data;
  },

  createShort: async (data: any): Promise<ShortsResponse> => {
    const response = await api.post("/shorts", data);
    return response.data;
  },

  updateShort: async (id: string, data: any): Promise<ShortsResponse> => {
    const response = await api.patch(`/shorts/${id}`, data);
    return response.data;
  },

  deleteShort: async (id: string): Promise<any> => {
    const response = await api.delete(`/shorts/${id}`);
    return response.data;
  },

  publishShort: async (id: string): Promise<ShortsResponse> => {
    const response = await api.patch(`/shorts/${id}/publish`);
    return response.data;
  },

  unpublishShort: async (id: string): Promise<ShortsResponse> => {
    const response = await api.patch(`/shorts/${id}/unpublish`);
    return response.data;
  },
};
