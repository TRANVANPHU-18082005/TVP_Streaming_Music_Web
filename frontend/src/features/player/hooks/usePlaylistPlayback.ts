import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, selectPlayer } from "@/features/player";
import { usePlayCollection } from "./usePlayCollection";

import { IPlaylist } from "@/features/playlist/types";
import { playlistKeys } from "@/features/playlist";
import playlistApi from "@/features/playlist/api/playlistApi";

export const usePlaylistPlayback = (playlist: IPlaylist | undefined) => {
  const dispatch = useAppDispatch();
  const { currentSource, isPlaying } = useAppSelector(selectPlayer);
  const { play, isFetching } = usePlayCollection();

  /**
   * 1. Xác định trạng thái Playlist (Memoized)
   * Phân biệt rõ loại 'playlist' để không bị chồng lấn ID với Album hoặc Artist.
   */
  const isThisPlaylistActive = useMemo(() => {
    if (!playlist?._id || !currentSource?.id) return false;
    return (
      currentSource.id === playlist._id && currentSource.type === "playlist"
    );
  }, [currentSource?.id, currentSource?.type, playlist?._id]);

  const isThisPlaylistPlaying = isThisPlaylistActive && isPlaying;

  /**
   * 2. Logic xử lý Toggle
   * Cho phép truyền startIndex để phát từ một bài cụ thể trong Playlist.
   */
  const togglePlayPlaylist = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent, index = 0) => {
      e?.stopPropagation();

      if (!playlist?._id) return;

      if (isThisPlaylistActive) {
        // Nếu đang nghe playlist này -> Toggle Play/Pause
        dispatch(setIsPlaying(!isPlaying));
      } else {
        // Phát playlist mới
        play({
          queryKey: playlistKeys.detail(playlist._id),
          fetchFn: () => playlistApi.getDetail(playlist._id),
          sourceType: "playlist",
          startIndex: index,
          collectionName: playlist.title, // Để Toast hiện: "Đang phát Playlist: ..."
        });
      }
    },
    [isThisPlaylistActive, isPlaying, playlist, play, dispatch],
  );
  const shufflePlaylist = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (!playlist?._id) return;

      play({
        queryKey: playlistKeys.detail(playlist._id),
        fetchFn: () => playlistApi.getDetail(playlist._id),
        sourceType: "album",
        startIndex: -1, // Truyền -1 để báo hiệu chọn ngẫu nhiên bài đầu tiên
        collectionName: playlist.title,
        shuffle: true, // Kích hoạt flag shuffle
      });
    },
    [playlist, play],
  );

  return {
    togglePlayPlaylist,
    shufflePlaylist,
    isThisPlaylistActive,
    isThisPlaylistPlaying,
    isFetching,
  };
};
