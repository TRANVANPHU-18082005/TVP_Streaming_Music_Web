import { ArtistFilterParams } from "@/features/artist/types";

export const artistKeys = {
  all: ["artists"] as const,
  lists: () => [...artistKeys.all, "list"] as const,
  list: (filter: ArtistFilterParams) =>
    [...artistKeys.lists(), { filter }] as const,
  details: () => [...artistKeys.all, "detail"] as const,
  profile: () => ["profile"] as const,
  detail: (slug: string) => [...artistKeys.details(), slug] as const,
  search: (query: string) => [...artistKeys.all, "search", query] as const,
  tracks: () => [...artistKeys.all, "tracks"] as const,
  trackList: (idOrSlug: string, params: { page?: number; limit?: number }) =>
    [...artistKeys.tracks(), idOrSlug, { params }] as const,
};
