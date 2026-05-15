import { TrackFilterParams } from "@/features/track/types";

export const trackKeys = {
  all: ["tracks"] as const,

  // Danh sách cơ bản
  lists: () => [...trackKeys.all, "list"] as const,
  list: (filter: TrackFilterParams) =>
    [...trackKeys.lists(), { filter }] as const,

  // Chi tiết bài hát
  details: () => [...trackKeys.all, "detail"] as const,
  detail: (slug: string) => [...trackKeys.details(), slug] as const,

  // Tìm kiếm
  search: (query: string) => [...trackKeys.all, "search", query] as const,

  // 🔥 MỚI: Recommendation & Similar (Cá nhân hóa)
  recommendations: (params: { limit: number; excludeTrackId?: string }) =>
    [...trackKeys.all, "recommendations", params] as const,

  similar: (slug: string, params: { limit: number }) =>
    [...trackKeys.all, "similar", slug, params] as const,
  topHotToday: (params: { page?: number; limit?: number }) =>
    [...trackKeys.all, "topHotToday", params] as const,
  topFavourite: (params: { page?: number; limit?: number }) =>
    [...trackKeys.all, "topFavourite", params] as const,
};
