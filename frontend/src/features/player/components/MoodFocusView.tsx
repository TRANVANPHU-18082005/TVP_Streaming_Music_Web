import { useEffect, memo, useCallback, useMemo } from "react";
import { VideoMoodEngine } from "./VideoMoodEngine";
import { MoodLyricLine } from "./MoodLyricLine";
import { ILyricLine, ITrack } from "@/features/track";

// ── CSS ──────────────────────────────────────────────────────────────────────

const MFV_STYLE_ID = "__mfv-styles__";
const MFV_CSS = `
  @keyframes mfv-breathe {
    0%,100% { transform: scale(1); }
    50%      { transform: scale(1.004); }
  }
  .mfv-breathing {
    animation: mfv-breathe 5s ease-in-out infinite;
  }
`;

function injectMFVStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(MFV_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = MFV_STYLE_ID;
  s.textContent = MFV_CSS;
  document.head.appendChild(s);
}

// ── Binary search ─────────────────────────────────────────────────────────────

function findCurrentIndex(lines: ILyricLine[], timeMs: number): number {
  let lo = 0,
    hi = lines.length - 1,
    candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    const end = line.endTime ?? line.startTime + 5000;
    if (timeMs >= line.startTime && timeMs <= end) return mid;
    if (timeMs < line.startTime) {
      hi = mid - 1;
    } else {
      candidate = mid;
      lo = mid + 1;
    }
  }
  return candidate;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MoodFocusViewProps {
  lyrics: ILyricLine[] | null;
  loading: boolean;
  track: ITrack;
  currentTimeMs: number;
  isPlaying: boolean;
  onSeek?: (timeS: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MoodFocusView = memo(
  ({
    lyrics,
    loading,
    track,
    currentTimeMs,
    isPlaying,
    onSeek,
  }: MoodFocusViewProps) => {
    useEffect(() => {
      injectMFVStyles();
    }, []);

    const accentColor = "#7c3aed";

    const currentIndex = useMemo(
      () => findCurrentIndex(lyrics || [], currentTimeMs),
      [lyrics, currentTimeMs],
    );

    const currentLine = lyrics?.[currentIndex] ?? null;

    const handleSeek = useCallback(
      (timeS: number) => {
        onSeek?.(timeS);
      },
      [onSeek],
    );

    if (loading && !lyrics?.length) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "rgba(255,255,255,0.3)",
            fontSize: 14,
          }}
        >
          Loading...
        </div>
      );
    }

    return (
      <div
        className={isPlaying ? "mfv-breathing" : ""}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#000",
          // Tăng nhẹ border-radius nếu dùng trong card
          borderRadius: "inherit",
          willChange: "transform",
        }}
        aria-label="Mood focus view"
      >
        {/* LAYER 1 — Video (Ken Burns + grain + vignette + accent breath bên trong) */}
        <VideoMoodEngine
          src={track.moodVideo?.videoUrl}
          isPlaying={isPlaying}
          accentColor={accentColor}
          opacity={0.78}
        />

        {/* LAYER 2 — Lyric: 1 line duy nhất, position absolute bottom */}
        <MoodLyricLine
          currentText={currentLine?.text ?? ""}
          accentColor={accentColor}
          onSeek={onSeek ? handleSeek : undefined}
          currentStartTimeMs={currentLine?.startTime}
          currentIndex={currentIndex}
        />
      </div>
    );
  },
);
MoodFocusView.displayName = "MoodFocusView";
