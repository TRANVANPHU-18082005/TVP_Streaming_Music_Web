import React, { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EqualizerBars } from "@/components/MusicVisualizer";
import { prefersReducedMotion } from "@/utils/playerLayout";

interface PlayCellProps {
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  // Accept an optional MouseEvent so callers can receive the click event
  onPlay: (e?: React.MouseEvent) => void;
}

export const PlayCell = memo(
  ({ index, isActive, isPlaying, onPlay }: PlayCellProps) => {
    const showBars = isActive && isPlaying;

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onPlay?.();
        }
      },
      [onPlay],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPlay?.(e);
      },
      [onPlay],
    );

    return (
      <div
        role="button"
        tabIndex={-1}
        aria-label={
          showBars ? `Tạm dừng bài ${index + 1}` : `Phát bài ${index + 1}`
        }
        aria-pressed={showBars}
        className="relative flex size-full items-center justify-center cursor-pointer select-none outline-none"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute text-[12px] font-medium tabular-nums leading-none pointer-events-none",
            isActive ? "text-primary" : "text-muted-foreground/60",
            prefersReducedMotion
              ? showBars
                ? "opacity-0"
                : "opacity-100 group-hover:opacity-0"
              : [
                  "transition-[opacity,transform] duration-200 ease-out",
                  showBars
                    ? "opacity-0 scale-75"
                    : "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75",
                ],
          )}
        >
          {index + 1}
        </span>

        {isActive && isPlaying ? (
          <EqualizerBars active={showBars} color="primary" bars={3} />
        ) : null}
      </div>
    );
  },
);

PlayCell.displayName = "PlayCell";
export default PlayCell;
