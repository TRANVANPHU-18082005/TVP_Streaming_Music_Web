/**
 * ForMeProgressBar.tsx
 *
 * Wrapper bao bọc ProgressBar chính của hệ thống để hoạt động độc lập
 * trên Feed For Me mà không cần phụ thuộc vào PlayerContext.
 *
 * Giải quyết triệt để lỗi "tua không được" do FeedItem bị detached khỏi MusicPlayer:
 * 1. Đọc currentTime từ đồng hồ audio chung (publish trên timeupdate của player).
 * 2. Seek trực tiếp qua Redux action `seekTo`.
 */

import { memo, useEffect, useState, useCallback } from "react";
import { useAppDispatch } from "@/store/hooks";
import { seekTo } from "@/features/player/slice/playerSlice";
import { subscribeAudioClock } from "@/features/player/utils/audioClock";
import ProgressBar from "@/features/player/components/ProgressBar";

interface ForMeProgressBarProps {
  duration: number;
}

export const ForMeProgressBar = memo(({ duration }: ForMeProgressBarProps) => {
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = document.getElementById("global-audio-player") as HTMLAudioElement | null;
    if (audio) setCurrentTime(audio.currentTime);
    return subscribeAudioClock(setCurrentTime);
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