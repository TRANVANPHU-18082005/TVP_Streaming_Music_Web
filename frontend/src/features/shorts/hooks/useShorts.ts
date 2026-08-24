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
    },
  });
};

export const useUpdateShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => shortsApi.updateShort(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
    },
  });
};

export const useDeleteShort = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shortsApi.deleteShort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shorts"] });
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
    },
  });
};
