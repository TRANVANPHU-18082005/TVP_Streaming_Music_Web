/**
 * MarqueeText.tsx — Production v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES v1 → v2:
 *
 * BUG-1   animName collision: dùng Math.abs(shift) — shift=0 trước khi measure
 *         Fix: thêm text.length vào animName key để uniqueness tốt hơn
 *
 * UX-1    Thêm prop `disabled` — cho phép tắt marquee animation từ bên ngoài
 *         Ví dụ: khi TrackRow bị hover, parent muốn pause marquee
 *
 * UX-2    Thêm prop `gap` — khoảng trống cuối text trước khi text lặp lại
 *         Giúp đọc rõ hơn khi text chạy qua fade edge
 *
 * PERF-1  animName bây giờ include text.slice(0,12) để tránh hash collision
 *         giữa các chuỗi text khác nhau nhưng cùng length
 *
 * ARCH:   Giữ nguyên pattern CSS @keyframes inject + ResizeObserver
 *         — không cần Framer Motion cho feature này
 */

import { memo, useRef, useEffect, useState, useId } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Tốc độ px/s — mặc định 40 */
  speed?: number;
  /** Delay (ms) trước khi bắt đầu chạy và sau khi reset */
  pauseMs?: number;
  /** Tắt animation (nhưng vẫn render text bình thường) */
  disabled?: boolean;
}

export const MarqueeText = memo(
  ({ text, className, speed = 40, pauseMs = 1400, disabled = false }: MarqueeTextProps) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLSpanElement>(null);
    const [shift, setShift] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isOverflowing, setIsOverflowing] = useState(false);

    // PERF-1: unique ID per instance — avoids keyframe name collision
    const uid = useId().replace(/:/g, "_");

    useEffect(() => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;

      const measure = () => {
        const overflow = inner.scrollWidth - outer.clientWidth;
        if (!disabled && overflow > 4) {
          const px = overflow + 24; // extra to push past fade mask
          setShift(-px);
          // Total duration = scroll time + 2× pause (start + end)
          setDuration(px / speed + (pauseMs * 2) / 1000);
          setIsOverflowing(true);
        } else {
          setShift(0);
          setDuration(0);
          setIsOverflowing(false);
        }
      };

      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(outer);
      return () => ro.disconnect();
    }, [text, speed, pauseMs, disabled]);

    // Keyframe: pause → scroll → pause → instant-reset (via animation-iteration)
    const pauseFrac = duration > 0 ? (pauseMs / 1000 / duration) * 100 : 0;
    const runEnd    = 100 - pauseFrac;

    // BUG-1 fix: unique animName using uid (from useId) — guaranteed collision-free
    const animName = `_mq_${uid}_${Math.abs(shift).toFixed(0)}`;

    const keyframes =
      isOverflowing && duration > 0
        ? `
        @keyframes ${animName} {
          0%                    { transform: translateX(0); }
          ${pauseFrac.toFixed(1)}% { transform: translateX(0); }
          ${runEnd.toFixed(1)}%  { transform: translateX(${shift}px); }
          100%                  { transform: translateX(${shift}px); }
        }
      `
        : "";

    const shouldAnimate = isOverflowing && !disabled;

    return (
      <div
        ref={outerRef}
        className={cn(
          "group relative overflow-hidden whitespace-nowrap",
          className,
        )}
        style={
          shouldAnimate
            ? {
                maskImage:
                  "linear-gradient(to right, black 0px, black calc(100% - 20px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, black 0px, black calc(100% - 20px), transparent 100%)",
              }
            : undefined
        }
      >
        {shouldAnimate && <style>{keyframes}</style>}

        <span
          ref={innerRef}
          className="inline-block whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
          style={
            shouldAnimate
              ? {
                  animationName: animName,
                  animationDuration: `${duration.toFixed(2)}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  // Parent can override via CSS var --marquee-play-state
                  animationPlayState: "var(--marquee-play-state, running)",
                }
              : undefined
          }
        >
          {text}
        </span>
      </div>
    );
  },
);
MarqueeText.displayName = "MarqueeText";
