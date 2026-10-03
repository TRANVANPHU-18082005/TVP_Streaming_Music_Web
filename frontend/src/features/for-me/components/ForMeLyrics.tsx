import { memo, useEffect, useState, useCallback } from "react";
import { subscribeAudioClock } from "@/features/player/utils/audioClock";
import { useLyrics } from "@/features/player/hooks/useLyrics";
import { usePlainLyrics } from "@/features/player/hooks/usePlainLyrics";
import LyricsView from "@/features/player/components/LyricEngine";
import { useAppDispatch } from "@/store/hooks";
import { seekTo } from "@/features/player/slice/playerSlice";
import { ITrack } from "@/features/track";
import { useIsMobile } from "@/components/ui/use-mobile";
import { cn } from "@/lib/utils";

interface ForMeLyricsProps {
  track: ITrack;
  isActive: boolean;
  isPlaying: boolean;
  accentColor?: string;
  mini?: boolean;
}

export const ForMeLyrics = memo(({ track, isActive, isPlaying, accentColor, mini }: ForMeLyricsProps) => {
  // Only enable lyrics fetching if this feed item is active to save bandwidth
  const { lyrics, loading } = useLyrics(track.lyricUrl, isActive);
  const plainLyrics = usePlainLyrics(track, isActive);
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isActive) return;
    const audio = document.getElementById("global-audio-player") as HTMLAudioElement | null;
    if (audio) setCurrentTime(audio.currentTime);
    return subscribeAudioClock(setCurrentTime);
  }, [isActive]);

  const handleSeek = useCallback(
    (time: number) => {
      dispatch(seekTo(time));
    },
    [dispatch]
  );

  if (!isActive) return null;
  // If no lyrics are available and it's done loading, don't show the empty state to save space.
  if (!loading && (!lyrics || lyrics.length === 0) && (!track.lyricType || track.lyricType === "none")) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full h-full relative z-20 pointer-events-auto",
        mini ? "" : "[&>div]:[--lv-padding:30vh] md:[&>div]:[--lv-padding:38vh]"
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          // Apply a very strong mask to fade out top and bottom for a sleek look
          maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)"
        }}
      >
        <LyricsView
          paddingForMe={mini ? 4 : 35}
          lyricType={track.lyricType || "synced"}
          plainLyrics={plainLyrics}
          syncedLines={lyrics}
          karaokeLines={lyrics}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          loading={loading}
          focusRadius={isMobile ? 1 : 2} // Show a few more lines for the big layout
          accentColor={accentColor}
          align="center"
        />
      </div>
    </div>
  );
});

ForMeLyrics.displayName = "ForMeLyrics";
