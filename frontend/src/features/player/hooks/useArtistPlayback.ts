import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, selectPlayer } from "@/features/player";
import { usePlayCollection } from "./usePlayCollection";

import { artistKeys, IArtist } from "@/features/artist";
import artistApi from "@/features/artist/api/artistApi";

export const useArtistPlayback = (artist: IArtist | undefined) => {
  const dispatch = useAppDispatch();
  const { currentSource, isPlaying } = useAppSelector(selectPlayer);
  const { play, isFetching } = usePlayCollection();

  /**
   * 1. Xác định trạng thái   (Memoized)
   */
  const isThisAristActive = useMemo(() => {
    if (!artist?._id || !currentSource?.id) return false;
    return currentSource.id === artist._id && currentSource.type === "artist";
  }, [currentSource?.id, currentSource?.type, artist?._id]);
  const isThisartistPlaying = isThisAristActive && isPlaying;

  /**
   * 2. Phát   thông thường (hoặc Toggle Play/Pause)
   * @param index: Vị trí bài hát muốn phát (mặc định là 0)
   */
  const togglePlayArtist = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent, index = 0) => {
      e?.stopPropagation();
      if (!artist?._id) return;

      if (isThisAristActive) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        play({
          queryKey: artistKeys.detail(artist._id),
          fetchFn: () => artistApi.getDetail(artist._id),
          sourceType: "artist",
          startIndex: index,
          collectionName: artist.name,
          shuffle: false, // Phát theo thứ tự
        });
      }
    },
    [isThisAristActive, isPlaying, artist, play, dispatch],
  );

  /**
   * 3. Phát Shuffle   (Dành riêng cho nút Shuffle ở trang Detail)
   */
  const shuffleArtist = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (!artist?._id) return;

      play({
        queryKey: artistKeys.detail(artist._id),
        fetchFn: () => artistApi.getDetail(artist._id),
        sourceType: "artist",
        startIndex: -1, // Truyền -1 để báo hiệu chọn ngẫu nhiên bài đầu tiên
        collectionName: artist.name,
        shuffle: true, // Kích hoạt flag shuffle
      });
    },
    [artist, play],
  );

  return {
    togglePlayArtist,
    shuffleArtist, // Thêm hàm này để dùng ở Hero trang Detail
    isThisAristActive,
    isThisartistPlaying,
    isFetching,
  };
};
