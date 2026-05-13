import { AlbumAdminFilterParams } from "@/features/album";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (filter: AlbumAdminFilterParams) =>
    [...notificationKeys.lists(), { filter }] as const,
  details: () => [...notificationKeys.all, "detail"] as const,
  detail: (slug: string) => [...notificationKeys.details(), slug] as const,
};
