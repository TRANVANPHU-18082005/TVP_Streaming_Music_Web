import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { mashupApi } from "../api/mashupApi";

export const useMashupFeed = (limit: number = 10) => {
  return useInfiniteQuery({
    queryKey: ["mashup-feed"],
    queryFn: ({ pageParam }) => mashupApi.getFeed(limit, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.data?.nextCursor ?? undefined,
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
    },
  });
};

export const useSuggestShorts = () => {
  return useMutation({
    mutationFn: mashupApi.suggestShorts
  });
};
