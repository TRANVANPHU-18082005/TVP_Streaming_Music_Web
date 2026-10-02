import { useQuery } from "@tanstack/react-query";
import { recommendationApi } from "../api/recommendationApi";
import type { IAlbum } from "@/features/album/types";
import type { IPlaylist } from "@/features/playlist/types";

export const useForMeFeed = (
  limit: number = 10,
  taste?: { mix?: number; mood?: "focus" | "sad" | "energy"; genreIds?: string[] },
) => {
  const genreKey = taste?.genreIds?.join(",") ?? "";
  return useQuery({
    queryKey: ["for-me-feed", "session", limit, taste?.mix ?? "default", taste?.mood ?? "any", genreKey],
    queryFn: () => recommendationApi.getForMeFeed(limit, {
      session: true,
      mix: taste?.mix,
      mood: taste?.mood,
      genreIds: taste?.genreIds,
    }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useContinueAlbums = (limit: number = 8) => {
  return useQuery({
    queryKey: ["for-me-continue", "albums", limit],
    queryFn: () => recommendationApi.getRecommendedAlbums(limit),
    select: (response: { data?: IAlbum[] }) => response?.data ?? [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useContinuePlaylists = (limit: number = 8) => {
  return useQuery({
    queryKey: ["for-me-continue", "playlists", limit],
    queryFn: () => recommendationApi.getRecommendedPlaylists(limit),
    select: (response: { data?: IPlaylist[] }) => response?.data ?? [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useUnifiedFeed = (limit: number = 50) => {
  return useQuery({
    queryKey: ["for-you-unified-feed", limit],
    queryFn: () => recommendationApi.getUnifiedFeed(limit),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
