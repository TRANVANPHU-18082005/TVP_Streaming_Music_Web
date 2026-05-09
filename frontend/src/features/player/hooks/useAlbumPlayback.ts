/**
 * useAlbumPlayback
 * Thin wrapper của useCollectionPlayback cho Album.
 */
import { useMemo } from "react";

import {
  CollectionPlaybackReturn,
  useCollectionPlayback,
} from "./Usecollectionplayback";

import albumApi from "@/features/album/api/albumApi";
import { albumKeys, IAlbum } from "@/features/album";

export interface UseAlbumPlaybackReturn {
  togglePlayAlbum: CollectionPlaybackReturn["togglePlay"];
  shuffleAlbum: CollectionPlaybackReturn["shuffle"];
  isThisAlbumActive: boolean;
  isThisAlbumPlaying: boolean;
  isFetching: boolean;
}

export const useAlbumPlayback = (
  album: IAlbum | undefined,
): UseAlbumPlaybackReturn => {
  const config = useMemo(
    () => ({
      collectionId: album?._id,
      collectionName: album?.title,
      collectionType: "album" as const,
      queryKey: album?._id ? albumKeys.detail(album._id) : [],
      fetchFn: () => albumApi.getAlbumDetail(album!.slug),
    }),
    [album?._id, album?.title, album?.slug],
  );

  const { togglePlay, shuffle, isActive, isPlaying, isFetching } =
    useCollectionPlayback(config);

  return {
    togglePlayAlbum: togglePlay,
    shuffleAlbum: shuffle,
    isThisAlbumActive: isActive,
    isThisAlbumPlaying: isPlaying,
    isFetching,
  };
};
