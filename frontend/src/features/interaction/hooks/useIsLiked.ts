import { useAppSelector } from "@/store/hooks";

export const useIsLiked = (
  id: string,
  type: "track" | "album" | "playlist",
) => {
  return useAppSelector((state) => {
    const maps = {
      track: "likedTracks",
      album: "likedAlbums",
      playlist: "likedPlaylists",
    } as const;
    return !!state.interaction[maps[type]][id];
  });
};
export const useIsLoading = (id: string) => {
  return useAppSelector((state) => !!state.interaction.loadingIds[id]);
};
