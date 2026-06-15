/**
 * ForMeProgressBar.tsx
 *
 * Wrapper bao bọc ProgressBar chính của hệ thống để hoạt động độc lập
 * trên Feed For Me mà không cần phụ thuộc vào PlayerContext.
 *
 * Giải quyết triệt để lỗi "tua không được" do FeedItem bị detached khỏi MusicPlayer:
 * 1. Đọc currentTime trực tiếp từ thẻ <audio id="global-audio-player">
 * 2. Seek trực tiếp qua Redux action `seekTo`.
 */

import { memo, useEffect, useState, useCallback } from "react";
import { useAppDispatch } from "@/store/hooks";
import { seekTo } from "@/features/player/slice/playerSlice";
import ProgressBar from "@/features/player/components/ProgressBar";

interface ForMeProgressBarProps {
  duration: number;
}

export const ForMeProgressBar = memo(({ duration }: ForMeProgressBarProps) => {
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState(0);

  // Lấy currentTime từ thẻ audio thật đang chạy
  useEffect(() => {
    const audio = document.getElementById("global-audio-player") as HTMLAudioElement;
    if (!audio) return;

    // Lấy giá trị ban đầu
    setCurrentTime(audio.currentTime);

    // Lắng nghe sự kiện timeupdate để đồng bộ
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  const handleSeek = useCallback(
    (time: number) => {
      // Dispatch seek action để MusicPlayer và useAudioPlayer tự động đồng bộ
      dispatch(seekTo(time));
    },
    [dispatch],
  );

  return (
    <div className="w-full select-none z-30">
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        hasTimeLabels={false}
      />
    </div>
  );
});

ForMeProgressBar.displayName = "ForMeProgressBar";