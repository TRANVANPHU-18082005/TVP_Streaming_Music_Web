// src/features/karaoke/hooks/useKaraokeQueries.ts

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import karaokeApi from "../api/karaokeApi";
import { karaokeKeys } from "../utils/karaokeKeys";
import { KaraokeFilterParams, KaraokePermissionFilterParams } from "../types";

// ==========================================
// USER & PUBLIC QUERIES
// ==========================================

export const useMyKaraokePermission = () => {
  return useQuery({
    queryKey: karaokeKeys.myPermission(),
    queryFn: () => karaokeApi.getMyPermission(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useMyRecordings = (params: KaraokeFilterParams) => {
  return useQuery({
    queryKey: karaokeKeys.myRecordings(params),
    queryFn: () => karaokeApi.getMyRecordings(params),
    placeholderData: keepPreviousData,
  });
};

export const usePublicRecordings = (params: KaraokeFilterParams) => {
  return useQuery({
    queryKey: karaokeKeys.publicRecordings(params),
    queryFn: () => karaokeApi.getPublicRecordings(params),
    placeholderData: keepPreviousData,
  });
};

export const useRecordingDetail = (id: string) => {
  return useQuery({
    queryKey: karaokeKeys.detail(id),
    queryFn: () => karaokeApi.getRecordingDetail(id),
    enabled: !!id,
  });
};

// ==========================================
// ADMIN QUERIES
// ==========================================

export const useAdminRecordings = (params: KaraokeFilterParams) => {
  return useQuery({
    queryKey: karaokeKeys.adminRecordings(params),
    queryFn: () => karaokeApi.adminGetRecordings(params),
    placeholderData: keepPreviousData,
  });
};

export const useAdminPermissions = (params: KaraokePermissionFilterParams) => {
  return useQuery({
    queryKey: karaokeKeys.adminPermissions(params),
    queryFn: () => karaokeApi.adminGetPermissions(params),
    placeholderData: keepPreviousData,
  });
};

export const useAdminKaraokeStats = () => {
  return useQuery({
    queryKey: karaokeKeys.adminStats(),
    queryFn: () => karaokeApi.adminGetStats(),
    staleTime: 60 * 1000,
  });
};

// ==========================================
// YOUTUBE QUERIES
// ==========================================

export const useYoutubeSearch = (query: string, limit: number = 10) => {
  return useQuery({
    queryKey: ["youtube-search", query, limit],
    queryFn: () => karaokeApi.searchYoutube(query, limit),
    enabled: !!query && query.trim().length > 0,
    staleTime: 1000 * 60 * 60, // 1 giờ cache
  });
};
