// src/features/karaoke/hooks/useKaraokeMutations.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import karaokeApi from "../api/karaokeApi";
import { karaokeKeys } from "../utils/karaokeKeys";
import {
  UploadRecordingDto,
  UpdateRecordingDto,
  AdminReviewDto,
  GrantPermissionDto,
} from "../types";

export const useUploadRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (payload: UploadRecordingDto) => karaokeApi.uploadRecording(payload),
    onSuccess: () => {
      // Refresh user recordings and permission (to update quota)
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myPermission() });
    },
  });
};

export const useUpdateRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRecordingDto }) =>
      karaokeApi.updateRecording(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.detail(id) });
    },
  });
};

export const useSubmitForReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (id: string) => karaokeApi.submitForReview(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.detail(id) });
    },
  });
};

export const useDeleteRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (id: string) => karaokeApi.deleteRecording(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.myPermission() });
    },
  });
};

// ==========================================
// ADMIN MUTATIONS
// ==========================================

export const useAdminReviewRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: ({ id, payload }: { id: string; payload: AdminReviewDto }) =>
      karaokeApi.adminReviewRecording(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminStats() });
    },
  });
};

export const useAdminGrantPermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: ({ userId, payload }: { userId: string; payload: GrantPermissionDto }) =>
      karaokeApi.adminGrantPermission(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminPermissionsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminStats() });
    },
  });
};

export const useAdminRevokePermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (userId: string) => karaokeApi.adminRevokePermission(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminPermissionsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.adminStats() });
    },
  });
};

// ==========================================
// COMMUNITY MUTATIONS
// ==========================================

export const useToggleLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (id: string) => karaokeApi.toggleLike(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.publicRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.detail(id) });
    },
  });
};

export const useIncrementPlayCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Call-site tự toast lỗi, bỏ qua toast toàn cục
    meta: { skipGlobalError: true },
    mutationFn: (id: string) => karaokeApi.incrementPlayCount(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: karaokeKeys.publicRecordingsLists() });
      queryClient.invalidateQueries({ queryKey: karaokeKeys.detail(id) });
    },
  });
};
