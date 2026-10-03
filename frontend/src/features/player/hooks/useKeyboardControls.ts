import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectPlayer,
  setIsPlaying,
  setVolume,
  toggleMute,
} from "../slice/playerSlice";

export const useKeyboardControls = (
  seek: (t: number) => void,
  getCurrentTime: () => number,
) => {
  const dispatch = useDispatch();
  const { isPlaying, volume } = useSelector(selectPlayer);
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable
      )
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          dispatch(setIsPlaying(!isPlaying));
          break;
        case "ArrowRight":
          seek(getCurrentTimeRef.current() + 5);
          break;
        case "ArrowLeft":
          seek(Math.max(0, getCurrentTimeRef.current() - 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch(setVolume(Math.min(1, volume + 0.1)));
          break;
        case "ArrowDown":
          e.preventDefault();
          dispatch(setVolume(Math.max(0, volume - 0.1)));
          break;
        case "KeyM":
          dispatch(toggleMute());
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, dispatch, seek]);
};
