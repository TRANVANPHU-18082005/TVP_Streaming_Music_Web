import { useQuery } from "@tanstack/react-query";
import { recommendationApi } from "../api/recommendationApi";

export const useForMeFeed = (limit: number = 50) => {
  return useQuery({
    queryKey: ["for-me-feed", limit],
    queryFn: () => recommendationApi.getForMeFeed(limit),
    staleTime: 5 * 60 * 1000, // 5 phút
    refetchOnWindowFocus: false,
  });
};
