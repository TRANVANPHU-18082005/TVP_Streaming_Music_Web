/**
 * useGenrePlayback
 * Thin wrapper của useCollectionPlayback cho Genre.
 *
 * Note: getDetail dùng `genre.slug` (không phải `_id`) — giữ nguyên theo API.
 */
import { useMemo } from "react";

import {
  CollectionPlaybackReturn,
  useCollectionPlayback,
} from "./Usecollectionplayback";

import { IGenre, genreKeys } from "@/features/genre";
import genreApi from "@/features/genre/api/genreApi";

export interface UseGenrePlaybackReturn {
  togglePlayGenre: CollectionPlaybackReturn["togglePlay"];
  shuffleGenre: CollectionPlaybackReturn["shuffle"];
  isThisGenreActive: boolean;
  isThisGenrePlaying: boolean;
  isFetching: boolean;
}

export const useGenrePlayback = (
  genre: IGenre | undefined,
): UseGenrePlaybackReturn => {
  const config = useMemo(
    () => ({
      collectionId: genre?._id,
      collectionName: genre?.name,
      collectionType: "genre" as const,
      queryKey: genre?._id ? genreKeys.detail(genre._id) : [],
      // slug cho getDetail (API yêu cầu slug), _id cho queryKey (cache key)
      fetchFn: () => genreApi.getDetail(genre!.slug),
    }),
    [genre?._id, genre?.name, genre?.slug],
  );

  const { togglePlay, shuffle, isActive, isPlaying, isFetching } =
    useCollectionPlayback(config);

  return {
    togglePlayGenre: togglePlay,
    shuffleGenre: shuffle,
    isThisGenreActive: isActive,
    isThisGenrePlaying: isPlaying,
    isFetching,
  };
};
