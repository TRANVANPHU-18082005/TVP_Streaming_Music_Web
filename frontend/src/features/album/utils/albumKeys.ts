import { AlbumAdminFilterParams } from "../schemas/album.schema";

export const albumKeys = {
  all: ["albums"] as const,
  lists: () => [...albumKeys.all, "list"] as const,
  list: (filter: AlbumAdminFilterParams) =>
    [...albumKeys.lists(), { filter }] as const,
  details: () => [...albumKeys.all, "detail"] as const,
  detail: (slug: string) => [...albumKeys.details(), slug] as const,
  tracks: () => [...albumKeys.all, "tracks"] as const,
  trackList: (idOrSlug: string, params: { page?: number; limit?: number }) =>
    [...albumKeys.tracks(), idOrSlug, { params }] as const,
};
