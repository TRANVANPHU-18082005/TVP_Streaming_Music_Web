import { LikedContentParams } from "../types";

export const profileKeys = {
  // 1. Root Key
  all: ["profile"] as const,

  recentlyPlayed: (params: { limit?: number }) =>
    [...profileKeys.all, "recently-played", { params }] as const,
  // Key cho Favourite Tracks
  favouriteTracks: (params: { limit?: number }) =>
    [...profileKeys.all, "favourite-tracks", { params }] as const,
  // 2. Dashboard & Analytics (Dữ liệu tổng hợp)
  dashboard: () => [...profileKeys.all, "dashboard"] as const,
  analytics: () => [...profileKeys.all, "analytics"] as const,

  // 3. Playlists (Danh sách cá nhân)
  playlists: () => [...profileKeys.all, "playlists"] as const,

  // 4. Liked Content (Phân tầng để dễ invalidate theo type hoặc params)
  likedAll: () => [...profileKeys.all, "liked"] as const,
  liked: (params: LikedContentParams) =>
    [...profileKeys.likedAll(), params] as const,

  // 5. User Info (Dành cho việc cache thông tin cơ bản Name/Bio)
  me: () => [...profileKeys.all, "me"] as const,
};
