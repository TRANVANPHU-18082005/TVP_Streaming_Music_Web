import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shortsApi } from "../api/shortsApi";

export const useShorts = (filters: any) => {
  return useQuery({
    queryKey: ["admin-shorts", filters],
    queryFn: () => shortsApi.getAllShorts(filters),
  });
};

export const useCreateShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shortsApi.createShort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
      queryClient.invalidateQueries({ queryKey: ["shorts-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shorts"] });
    },
  });
};

export const useUpdateShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => shortsApi.updateShort(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
      queryClient.invalidateQueries({ queryKey: ["shorts-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shorts"] });
    },
  });
};

export const useDeleteShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shortsApi.deleteShort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
      queryClient.invalidateQueries({ queryKey: ["shorts-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shorts"] });
    },
  });
};

export const usePublishedShorts = (search: string, limit = 30) => {
  return useQuery({
    queryKey: ["published-shorts", search, limit],
    queryFn: () => shortsApi.getPublished({ search, limit }),
  });
};

export const useMyShorts = () => {
  return useQuery({
    queryKey: ["my-shorts"],
    queryFn: () => shortsApi.getMyShorts({ limit: 50 }),
  });
};

export const useRejectShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => shortsApi.rejectShort(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
      queryClient.invalidateQueries({ queryKey: ["shorts-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shorts"] });
    },
  });
};

export const useTogglePublish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      isPublished ? shortsApi.publishShort(id) : shortsApi.unpublishShort(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
      queryClient.invalidateQueries({ queryKey: ["shorts-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shorts"] });
    },
  });
};
