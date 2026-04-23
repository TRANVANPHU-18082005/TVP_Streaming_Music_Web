import { memo, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Tốc độ px/s — mặc định 40 */
  speed?: number;
  /** Delay (ms) trước khi bắt đầu chạy và sau khi reset */
  pauseMs?: number;
}

export const MarqueeText = memo(
  ({ text, className, speed = 40, pauseMs = 1400 }: MarqueeTextProps) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLSpanElement>(null);
    const [shift, setShift] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;

      const measure = () => {
        const overflow = inner.scrollWidth - outer.clientWidth;
        if (overflow > 4) {
          const px = overflow + 7; // 32px extra để text ra khỏi fade hoàn toàn
          setShift(-px);
          // Tổng duration = chạy + 2 lần dừng (đầu + cuối)
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
    }, [text, speed, pauseMs]);

    // Tính % keyframe để chia ra: pause đầu → chạy → pause cuối → reset
    const pauseFrac = duration > 0 ? (pauseMs / 1000 / duration) * 100 : 0;
    const runEnd = 100 - pauseFrac;

    const animName = `_mq_${Math.abs(shift)}_${duration.toFixed(0)}`;

    const keyframes =
      isOverflowing && duration > 0
        ? `
        @keyframes ${animName} {
          0% { transform: translateX(0); }
          ${pauseFrac.toFixed(1)}% { transform: translateX(0); }
          ${runEnd.toFixed(1)}% { transform: translateX(${shift}px); }
          100% { transform: translateX(${shift}px); }
        }
      `
        : "";

    return (
      <div
        ref={outerRef}
        className={cn(
          "group relative overflow-hidden whitespace-nowrap",
          className,
        )}
        style={{
          // Fade edges chỉ khi overflow
          ...(isOverflowing && {
            maskImage:
              "linear-gradient(to right, black 0px, black calc(100% - 20px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 0px, black calc(100% - 20px), transparent 100%)",
          }),
        }}
      >
        {isOverflowing && <style>{keyframes}</style>}

        <span
          ref={innerRef}
          className="inline-block whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
          style={
            isOverflowing
              ? {
                  // ✅ FIX: Tách nhỏ animation shorthand thành các thuộc tính riêng lẻ
                  animationName: animName,
                  animationDuration: `${duration.toFixed(2)}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  // animationPlayState vẫn có thể dùng biến CSS hoặc giá trị trực tiếp
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
