// features/interaction/utils/interactionKeys.ts

export const interactionKeys = {
  all: ["interactions"] as const,

  // Quản lý Like
  likes: () => [...interactionKeys.all, "likes"] as const,
  favoriteTracks: (userId: string) =>
    [...interactionKeys.likes(), "favorites", userId] as const,
  checkBatch: (trackIds: string[]) =>
    [...interactionKeys.likes(), "batch", { trackIds }] as const,

  // Quản lý Follow
  follows: () => [...interactionKeys.all, "follows"] as const,
  followingArtists: (userId: string) =>
    [...interactionKeys.follows(), "artists", userId] as const,
};
