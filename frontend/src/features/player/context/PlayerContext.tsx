/**
 * @file PlayerContext.tsx
 * @description Cung cấp các imperative functions của audio player (getCurrentTime, seek)
 * xuống toàn bộ cây component mà không cần prop drilling.
 * Chỉ có MusicPlayer cung cấp giá trị cho context này.
 */

import { createContext, useContext } from "react";

interface PlayerContextValue {
  /** Đọc thời gian hiện tại trực tiếp từ audio element (không qua React state) */
  getCurrentTime: () => number;
  /** Tua đến thời điểm nhất định (giây) */
  seek: (time: number) => void;
}

const noop = () => 0;
const noopSeek = (_: number) => {};

export const PlayerContext = createContext<PlayerContextValue>({
  getCurrentTime: noop,
  seek: noopSeek,
});

export const usePlayerContext = () => useContext(PlayerContext);
