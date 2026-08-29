import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { mashupApi, MashupListParams } from "../api/mashupApi";

// ── User / Public ─────────────────────────────────────────────────────────────
export const useMashupFeed = (limit: number = 10) => {
  return useInfiniteQuery({
    queryKey: ["mashup-feed"],
    queryFn: ({ pageParam }) => mashupApi.getFeed(limit, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data?.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
};

export const useMyMashups = (params?: MashupListParams) => {
  return useQuery({
    queryKey: ["mashup-my", params],
    queryFn: () => mashupApi.getMyMashups(params),
    staleTime: 5 * 60 * 1000,
  });
};

export const useMashupDetail = (id: string) => {
  return useQuery({
    queryKey: ["mashup-detail", id],
    queryFn: () => mashupApi.getMashupById(id),
    enabled: !!id,
  });
};

export const useCreateMashup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mashupApi.createMashup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mashup-feed"] });
      queryClient.invalidateQueries({ queryKey: ["mashups-admin"] });
    },
  });
};

export const useSuggestShorts = () => {
  return useMutation({
    mutationFn: mashupApi.suggestShorts,
  });
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const useMashupsAdmin = (params: MashupListParams = {}) => {
  return useQuery({
    queryKey: ["mashups-admin", params],
    queryFn: () => mashupApi.adminGetAll(params),
    staleTime: 30 * 1000,
  });
};

export const useUpdateMashup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      mashupApi.adminUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mashups-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mashup-feed"] });
    },
  });
};

export const useDeleteMashup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mashupApi.adminDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mashups-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mashup-feed"] });
    },
  });
};

export const useToggleMashupPublish = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      mashupApi.adminTogglePublish(id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mashups-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mashup-feed"] });
    },
  });
};
