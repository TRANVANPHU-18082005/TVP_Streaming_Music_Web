import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";

interface Props {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  hasTimeLabels?: boolean;
}

export const ProgressBar = ({
  currentTime,
  duration,
  onSeek,
  className,
  hasTimeLabels = true,
}: Props) => {
  const [isDragging, setIsDragging] = useState(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isDragging && duration > 0) {
      setValue((currentTime / duration) * 100);
    }
  }, [currentTime, duration, isDragging]);

  const handleChange = useCallback((v: number[]) => {
    setIsDragging(true);
    setValue(v[0]);
  }, []);

  const handleCommit = useCallback(
    (v: number[]) => {
      onSeek((v[0] / 100) * duration);
      requestAnimationFrame(() => setIsDragging(false));
    },
    [duration, onSeek],
  );

  const previewTime = isDragging ? (value / 100) * duration : currentTime;

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Slider row */}
      <div className="flex items-center h-4">
        <Slider
          value={[value]}
          max={100}
          step={0.1}
          onValueChange={handleChange}
          onValueCommit={handleCommit}
          className={cn(
            "w-full",
            "h-1.5", // 🔑 height cố định
            "cursor-pointer",
            "[&_[role=slider]]:opacity-0",
            "hover:[&_[role=slider]]:opacity-100",
            isDragging && "[&_[role=slider]]:opacity-100",
          )}
        />
      </div>

      {/* Time labels (chỉ dùng khi cần) */}
      {hasTimeLabels && (
        <div className="mt-1 flex justify-between text-[10px] sm:text-xs font-mono text-muted-foreground select-none">
          <span>{formatTime(previewTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
};
export default ProgressBar;
