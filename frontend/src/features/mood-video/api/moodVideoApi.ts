import api from "@/lib/axios";
import type { MoodVideo, MoodVideoFilterParams } from "../types";
import type { ApiResponse, PagedResponse } from "@/types";

const moodVideoApi = {
  getAll: async (params: MoodVideoFilterParams) => {
    const response = await api.get<ApiResponse<PagedResponse<MoodVideo>>>(
      "/mood-videos",
      { params },
    );
    return response.data;
  },

  create: async (data: FormData) => {
    const response = await api.post("/mood-videos", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  update: async (id: string, data: FormData | Partial<MoodVideo>) => {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/mood-videos/${id}`, data, {
      headers: {
        "Content-Type": isFormData ? "multipart/form-data" : "application/json",
      },
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/mood-videos/${id}`);
    return response.data;
  },
};

export default moodVideoApi;
