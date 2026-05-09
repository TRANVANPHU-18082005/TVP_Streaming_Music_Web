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
  const config = useMemo(() => {
    const id = playlist?._id;
    return {
      collectionId: id,
      collectionName: playlist?.title,
      collectionType: "playlist" as const,
      // ✅ Không tạo config rác khi chưa có id
      queryKey: id ? playlistKeys.detail(id) : (["__noop__"] as const),
      // ✅ Guard an toàn, không dùng non-null assertion
      fetchFn: () => {
        if (!id) return Promise.reject(new Error("Missing playlist id"));
        return playlistApi.getDetail(id);
      },
    };
  }, [playlist?._id, playlist?.title]);

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
