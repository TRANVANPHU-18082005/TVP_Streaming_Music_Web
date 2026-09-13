// features/music-room/components/RoomVisualizer.tsx
/**
 * Audio Visualizer animation dựa trên CSS.
 * Không cần Web Audio API — dùng pulse animation theo BPM.
 * Khi isPaused = true → bars đứng im.
 */

import React, { memo } from "react";

interface Props {
  isPlaying: boolean;
  accentColor: string;
  barsCount?: number;
  bpm?: number; // BPM từ aiMetadata.tempo
}

const RoomVisualizer = memo(({ isPlaying, accentColor, barsCount = 32, bpm = 120 }: Props) => {
  // Tính duration của một beat
  const beatDuration = 60 / bpm;

  return (
    <div className="flex items-end justify-center gap-[3px] h-16 w-full">
      {Array.from({ length: barsCount }).map((_, i) => {
        // Chiều cao ngẫu nhiên nhưng deterministic theo index
        const baseHeight = 20 + Math.sin(i * 0.8) * 15 + Math.cos(i * 0.4) * 10;
        const animDuration = (beatDuration * (0.4 + (i % 4) * 0.15)).toFixed(2);
        const animDelay = ((i * beatDuration) / barsCount).toFixed(2);

        return (
          <div
            key={i}
            className="rounded-full transition-opacity duration-300"
            style={{
              width: "3px",
              height: isPlaying ? `${baseHeight}%` : "15%",
              backgroundColor: accentColor,
              opacity: isPlaying ? 0.7 + Math.sin(i * 0.3) * 0.3 : 0.3,
              animation: isPlaying
                ? `visualizer-bar ${animDuration}s ease-in-out ${animDelay}s infinite alternate`
                : "none",
              transformOrigin: "bottom",
            }}
          />
        );
      })}

      <style>{`
        @keyframes visualizer-bar {
          0% { transform: scaleY(0.3); opacity: 0.4; }
          100% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
});

RoomVisualizer.displayName = "RoomVisualizer";
export default RoomVisualizer;
