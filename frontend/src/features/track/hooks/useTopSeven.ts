import { useQuery } from "@tanstack/react-query";
import trackApi from "@/features/track/api/trackApi";

export const useTopSeven = (period: "day" | "week" | "month" = "day") => {
  return useQuery({
    queryKey: ["top-seven", period],
    queryFn: () => trackApi.getTopSeven(period),
    staleTime: 5 * 60 * 1000, // 5 minutes cache to sync with backend Redis
    gcTime: 30 * 60 * 1000, // 30 mins
  });
};
