import { memo, useEffect, useState, useCallback } from "react";
import { useLyrics } from "@/features/player/hooks/useLyrics";
import LyricsView from "@/features/player/components/LyricEngine";
import { useAppDispatch } from "@/store/hooks";
import { seekTo } from "@/features/player/slice/playerSlice";
import { ITrack } from "@/features/track";
import { useIsMobile } from "@/components/ui/use-mobile";

interface ForMeLyricsProps {
  track: ITrack;
  isActive: boolean;
  isPlaying: boolean;
  accentColor?: string;
}

export const ForMeLyrics = memo(({ track, isActive, isPlaying, accentColor }: ForMeLyricsProps) => {
  // Only enable lyrics fetching if this feed item is active to save bandwidth
  const { lyrics, loading } = useLyrics(track.lyricUrl, isActive);
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState(0);
  const isMobile = useIsMobile();

  // Sync currentTime with the global audio element
  useEffect(() => {
    if (!isActive) return;
    const audio = document.getElementById("global-audio-player") as HTMLAudioElement;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    const syncTime = () => setCurrentTime(audio.currentTime);

    // Listen to major events to keep our base time perfectly in sync
    audio.addEventListener("seeked", syncTime);
    audio.addEventListener("pause", syncTime);
    audio.addEventListener("play", syncTime);

    // Occasional poll to ensure no drift
    const interval = setInterval(syncTime, 1000);

    return () => {
      audio.removeEventListener("seeked", syncTime);
      audio.removeEventListener("pause", syncTime);
      audio.removeEventListener("play", syncTime);
      clearInterval(interval);
    };
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
      className="w-full h-full relative z-20 pointer-events-auto [&>div]:[--lv-padding:30vh] md:[&>div]:[--lv-padding:38vh]"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
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
          paddingForMe={isMobile ? 7 : 36}
          lyricType={track.lyricType || "synced"}

          syncedLines={lyrics}
          karaokeLines={lyrics}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          loading={loading}
          focusRadius={isMobile ? 1 : 2} // Show a few more lines for the big layout
          accentColor={accentColor}
        />
      </div>
    </div>
  );
});

ForMeLyrics.displayName = "ForMeLyrics";
