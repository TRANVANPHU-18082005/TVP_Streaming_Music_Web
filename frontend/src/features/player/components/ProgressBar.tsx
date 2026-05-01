/**
 * ProgressBar.tsx — Custom seek bar với full design-system integration.
 *
 * Không dùng Radix Slider để có full control over:
 *   - Gradient fill (--primary → --wave-1 → --wave-2)
 *   - Thumb spring animation
 *   - Hover-reveal thumb
 *   - .text-duration token cho time labels
 *
 * Perf notes:
 *   - Dùng pointer events (mouse + touch) thay vì synthetic React events
 *     để tránh SyntheticEvent pooling overhead
 *   - requestAnimationFrame cho smooth drag
 *   - onValueCommit chỉ gọi onSeek 1 lần khi commit (không gọi liên tục)
 */

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/utils/format";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  hasTimeLabels?: boolean;
}

// Spring preset cho thumb — snappy nhưng không overshoot
const THUMB_SPRING = { type: "spring", stiffness: 500, damping: 32 } as const;

export const ProgressBar = memo(
  ({
    currentTime,
    duration,
    onSeek,
    className,
    hasTimeLabels = true,
  }: ProgressBarProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [dragPercent, setDragPercent] = useState(0);

    // Tính percent hiện tại — clamp [0, 100]
    const currentPercent =
      duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const displayPercent = isDragging ? dragPercent : currentPercent;
    const previewTime = isDragging ? (dragPercent / 100) * duration : currentTime;

    // ── Helpers ─────────────────────────────────────────────────────────────

    const getPercentFromEvent = useCallback(
      (clientX: number): number => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const raw = (clientX - rect.left) / rect.width;
        return Math.min(100, Math.max(0, raw * 100));
      },
      [],
    );

    // ── Mouse drag ───────────────────────────────────────────────────────────

    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        setDragPercent(getPercentFromEvent(e.clientX));
      },
      [getPercentFromEvent],
    );

    const handleMouseUp = useCallback(
      (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        const pct = getPercentFromEvent(e.clientX);
        setDragPercent(pct);
        onSeek((pct / 100) * duration);
      },
      [getPercentFromEvent, duration, onSeek],
    );

    const handleTrackMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const pct = getPercentFromEvent(e.clientX);
        setDragPercent(pct);
      },
      [getPercentFromEvent],
    );

    // ── Touch drag ───────────────────────────────────────────────────────────

    const handleTouchMove = useCallback(
      (e: TouchEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault(); // stop page scroll while seeking
        setDragPercent(getPercentFromEvent(e.touches[0].clientX));
      },
      [getPercentFromEvent],
    );

    const handleTouchEnd = useCallback(
      (e: TouchEvent) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        const pct = getPercentFromEvent(e.changedTouches[0].clientX);
        setDragPercent(pct);
        onSeek((pct / 100) * duration);
      },
      [getPercentFromEvent, duration, onSeek],
    );

    const handleTrackTouchStart = useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        setIsDragging(true);
        setDragPercent(getPercentFromEvent(e.touches[0].clientX));
      },
      [getPercentFromEvent],
    );

    // ── Global event listeners khi đang drag ────────────────────────────────

    useEffect(() => {
      if (!isDragging) return;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    const showThumb = isHovering || isDragging;

    return (
      <div className={cn("w-full flex flex-col select-none", className)}>
        {/* ── Track area ── */}
        <div
          className="group relative flex items-center"
          style={{ height: 20, cursor: isDragging ? "grabbing" : "pointer" }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => !isDragging && setIsHovering(false)}
          onMouseDown={handleTrackMouseDown}
          onTouchStart={handleTrackTouchStart}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          aria-label="Seek"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(Math.min(duration, currentTime + 5));
            if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 5));
          }}
        >
          {/* Track background */}
          <div
            ref={trackRef}
            className="relative w-full rounded-full overflow-hidden"
            style={{
              height: showThumb ? 5 : 3,
              transition: "height 0.15s ease",
              background: "hsl(var(--muted) / 0.35)",
            }}
          >
            {/* Buffered (subtle) — optional visual */}
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${displayPercent}%`,
                background: `linear-gradient(
                  to right,
                  hsl(var(--primary)),
                  hsl(var(--wave-1)),
                  hsl(var(--wave-2))
                )`,
                boxShadow: isDragging
                  ? "0 0 8px hsl(var(--brand-glow) / 0.5)"
                  : "0 0 4px hsl(var(--brand-glow) / 0.22)",
                transition: isDragging ? "none" : "width 0.25s linear",
              }}
            />
          </div>

          {/* Thumb */}
          <AnimatePresence>
            {showThumb && (
              <motion.div
                key="thumb"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={THUMB_SPRING}
                className="absolute pointer-events-none"
                style={{
                  left: `${displayPercent}%`,
                  transform: "translateX(-50%)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "hsl(var(--primary))",
                  boxShadow: `
                    0 0 0 3px hsl(var(--background) / 0.9),
                    0 0 0 5px hsl(var(--primary) / 0.3),
                    0 0 12px hsl(var(--brand-glow) / 0.5)
                  `,
                  zIndex: 2,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Time labels ── */}
        {hasTimeLabels && (
          <div className="mt-1.5 flex justify-between">
            <span
              className="text-duration"
              style={{ color: "hsl(var(--muted-foreground) / 0.75)" }}
            >
              {formatTime(previewTime)}
            </span>
            <span
              className="text-duration"
              style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}
            >
              {formatTime(duration)}
            </span>
          </div>
        )}
      </div>
    );
  },
);

ProgressBar.displayName = "ProgressBar";
export default ProgressBar;
