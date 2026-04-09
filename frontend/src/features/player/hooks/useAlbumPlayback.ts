import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, selectPlayer } from "@/features/player";
import { usePlayCollection } from "./usePlayCollection";

import { IAlbum } from "@/features/album/types";
import { albumKeys } from "@/features/album";
import albumApi from "@/features/album/api/albumApi";

export const useAlbumPlayback = (album: IAlbum | undefined) => {
  const dispatch = useAppDispatch();
  const { currentSource, isPlaying } = useAppSelector(selectPlayer);
  const { play, isFetching } = usePlayCollection();

  /**
   * 1. Xác định trạng thái Album (Memoized)
   */
  const isThisAlbumActive = useMemo(() => {
    if (!album?._id || !currentSource?.id) return false;
    return currentSource.id === album._id && currentSource.type === "album";
  }, [currentSource?.id, currentSource?.type, album?._id]);

  const isThisAlbumPlaying = isThisAlbumActive && isPlaying;

  /**
   * 2. Phát Album thông thường (hoặc Toggle Play/Pause)
   * @param index: Vị trí bài hát muốn phát (mặc định là 0)
   */
  const togglePlayAlbum = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent, index = 0) => {
      e?.stopPropagation();
      if (!album?._id) return;

      if (isThisAlbumActive) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        play({
          queryKey: albumKeys.detail(album._id),
          fetchFn: () => albumApi.getDetail(album._id),
          sourceType: "album",
          startIndex: index,
          collectionName: album.title,
          shuffle: false, // Phát theo thứ tự
        });
      }
    },
    [isThisAlbumActive, isPlaying, album, play, dispatch],
  );

  /**
   * 3. Phát Shuffle Album (Dành riêng cho nút Shuffle ở trang Detail)
   */
  const shuffleAlbum = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (!album?._id) return;

      play({
        queryKey: albumKeys.detail(album._id),
        fetchFn: () => albumApi.getDetail(album._id),
        sourceType: "album",
        startIndex: -1, // Truyền -1 để báo hiệu chọn ngẫu nhiên bài đầu tiên
        collectionName: album.title,
        shuffle: true, // Kích hoạt flag shuffle
      });
    },
    [album, play],
  );

  return {
    togglePlayAlbum,
    shuffleAlbum, // Thêm hàm này để dùng ở Hero trang Detail
    isThisAlbumActive,
    isThisAlbumPlaying,
    isFetching,
  };
};
