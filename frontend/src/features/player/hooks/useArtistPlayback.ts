/**
 * useArtistPlayback
 * Thin wrapper của useCollectionPlayback cho Artist.
 */

import { useMemo } from "react";
import { IArtist, artistKeys } from "@/features/artist";
import artistApi from "@/features/artist/api/artistApi";
import {
  CollectionPlaybackReturn,
  useCollectionPlayback,
} from "./Usecollectionplayback";

export interface UseArtistPlaybackReturn {
  togglePlayArtist: CollectionPlaybackReturn["togglePlay"];
  shuffleArtist: CollectionPlaybackReturn["shuffle"];
  isThisArtistActive: boolean;
  isThisArtistPlaying: boolean;
  isFetching: boolean;
}

export const useArtistPlayback = (
  artist: IArtist | undefined,
): UseArtistPlaybackReturn => {
  // Memo để fetchFn & queryKey không tạo reference mới mỗi render
  const config = useMemo(
    () => ({
      collectionId: artist?._id,
      collectionName: artist?.name,
      collectionType: "artist" as const,
      queryKey: artist?._id ? artistKeys.detail(artist._id) : [],
      fetchFn: () => artistApi.getDetail(artist!._id),
    }),
    [artist?._id, artist?.name],
  );

  const { togglePlay, shuffle, isActive, isPlaying, isFetching } =
    useCollectionPlayback(config);

  return {
    togglePlayArtist: togglePlay,
    shuffleArtist: shuffle,
    isThisArtistActive: isActive,
    isThisArtistPlaying: isPlaying,
    isFetching,
  };
};
