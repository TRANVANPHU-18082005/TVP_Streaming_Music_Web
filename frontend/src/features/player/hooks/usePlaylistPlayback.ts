/**
 * usePlaylistPlayback
 * Thin wrapper của useCollectionPlayback cho Playlist.
 */
import { useMemo } from "react";

import {
  CollectionPlaybackReturn,
  useCollectionPlayback,
} from "./Usecollectionplayback";

import { IPlaylist, playlistKeys } from "@/features/playlist";
import playlistApi from "@/features/playlist/api/playlistApi";

export interface UsePlaylistPlaybackReturn {
  togglePlayPlaylist: CollectionPlaybackReturn["togglePlay"];
  shufflePlaylist: CollectionPlaybackReturn["shuffle"];
  isThisPlaylistActive: boolean;
  isThisPlaylistPlaying: boolean;
  isFetching: boolean;
}

export const usePlaylistPlayback = (
  playlist: IPlaylist | undefined,
): UsePlaylistPlaybackReturn => {
  const config = useMemo(
    () => ({
      collectionId: playlist?._id,
      collectionName: playlist?.title,
      collectionType: "playlist" as const,
      queryKey: playlist?._id ? playlistKeys.detail(playlist._id) : [],
      fetchFn: () => playlistApi.getDetail(playlist!._id),
    }),
    [playlist?._id, playlist?.title],
  );

  const { togglePlay, shuffle, isActive, isPlaying, isFetching } =
    useCollectionPlayback(config);

  return {
    togglePlayPlaylist: togglePlay,
    shufflePlaylist: shuffle,
    isThisPlaylistActive: isActive,
    isThisPlaylistPlaying: isPlaying,
    isFetching,
  };
};
