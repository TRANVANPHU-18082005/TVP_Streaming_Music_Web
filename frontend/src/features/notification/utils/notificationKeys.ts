import { AlbumFilterParams } from "@/features/album/types";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (filter: AlbumFilterParams) =>
    [...notificationKeys.lists(), { filter }] as const,
  details: () => [...notificationKeys.all, "detail"] as const,
  detail: (slug: string) => [...notificationKeys.details(), slug] as const,
};
