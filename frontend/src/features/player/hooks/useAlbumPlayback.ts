/**
 * useAlbumPlayback
 * Thin wrapper của useCollectionPlayback cho Album.
 */
import { useMemo } from "react";

import {
  CollectionPlaybackReturn,
  useCollectionPlayback,
} from "./Usecollectionplayback";

import { albumKeys, IAlbum } from "@/features";
import albumApi from "@/features/album/api/albumApi";

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
      fetchFn: () => albumApi.getDetail(album!._id),
    }),
    [album?._id, album?.title],
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
