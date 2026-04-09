import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, selectPlayer } from "@/features/player";
import { usePlayCollection } from "./usePlayCollection";

import { genreKeys, IGenre } from "@/features/genre";
import genreApi from "@/features/genre/api/genreApi";

export const useGenrePlayback = (genre: IGenre | undefined) => {
  const dispatch = useAppDispatch();
  const { currentSource, isPlaying } = useAppSelector(selectPlayer);
  const { play, isFetching } = usePlayCollection();

  /**
   * 1. Xác định trạng thái genre (Memoized)
   */
  const isThisGenreActive = useMemo(() => {
    if (!genre?._id || !currentSource?.id) return false;
    return currentSource.id === genre._id && currentSource.type === "genre";
  }, [currentSource?.id, currentSource?.type, genre?._id]);

  const isThisGenrePlaying = isThisGenreActive && isPlaying;

  /**
   * 2. Phát genre thông thường (hoặc Toggle Play/Pause)
   * @param index: Vị trí bài hát muốn phát (mặc định là 0)
   */
  const togglePlayGenre = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent, index = 0) => {
      e?.stopPropagation();
      if (!genre?._id) return;

      if (isThisGenreActive) {
        dispatch(setIsPlaying(!isPlaying));
      } else {
        play({
          queryKey: genreKeys.detail(genre._id),
          fetchFn: () => genreApi.getDetail(genre.slug),
          sourceType: "genre",
          startIndex: index,
          collectionName: genre.name,
          shuffle: false, // Phát theo thứ tự
        });
      }
    },
    [isThisGenreActive, isPlaying, genre, play, dispatch],
  );

  /**
   * 3. Phát Shuffle genre (Dành riêng cho nút Shuffle ở trang Detail)
   */
  const shuffleGenre = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (!genre?._id) return;

      play({
        queryKey: genreKeys.detail(genre._id),
        fetchFn: () => genreApi.getDetail(genre._id),
        sourceType: "genre",
        startIndex: -1, // Truyền -1 để báo hiệu chọn ngẫu nhiên bài đầu tiên
        collectionName: genre.name,
        shuffle: true, // Kích hoạt flag shuffle
      });
    },
    [genre, play],
  );

  return {
    togglePlayGenre,
    shuffleGenre, // Thêm hàm này để dùng ở Hero trang Detail
    isThisGenreActive,
    isThisGenrePlaying,
    isFetching,
  };
};
