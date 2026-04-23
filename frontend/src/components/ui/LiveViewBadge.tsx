import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ── Helpers ── */
function formatCount(n: number | null | undefined): string | null {
  if (n == null || isNaN(n) || n < 0) return null;
  if (n === 0) return null;
  if (n < 100) return String(n);
  if (n < 1_000) return "99+";
  if (n < 1_000_000) return Math.round(n / 100) / 10 + "k";
  return Math.round(n / 100_000) / 10 + "M+";
}

/* ── Props ── */
interface EyeViewBadgeProps {
  count?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
}

const SIZE = {
  sm: {
    wrap: "w-8 h-8",
    icon: "w-[15px] h-[15px]",
    badge: "min-w-[15px] h-[15px] text-[9px] -top-1 -right-1.5",
  },
  md: {
    wrap: "w-10 h-10",
    icon: "w-5 h-5",
    badge: "min-w-[18px] h-[18px] text-[10px] -top-1.5 -right-1.5",
  },
  lg: {
    wrap: "w-13 h-13",
    icon: "w-6 h-6",
    badge: "min-w-5 h-5 text-[11px] -top-1.5 -right-2",
  },
};

/* ── EyeViewBadge ── */
export function EyeViewBadge({
  count,
  size = "md",
  className,
  onClick,
  "aria-label": ariaLabel,
}: EyeViewBadgeProps) {
  const formatted = formatCount(count);
  const visible = formatted !== null;
  // animate count khi thay đổi
  const [animKey, setAnimKey] = useState(0);
  const prevFormatted = useRef(formatted);
  useEffect(() => {
    if (formatted !== prevFormatted.current) {
      setAnimKey((k) => k + 1);
      prevFormatted.current = formatted;
    }
  }, [formatted]);

  const s = SIZE[size];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${count ?? 0} lượt xem`}
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-full cursor-pointer select-none",
        "transition-transform duration-150 ease-out",
        "hover:scale-105 active:scale-95",
        s.wrap,
        // icon bg từ design system của bạn
        "bg-muted border border-border",
        className,
      )}
    >
      {/* Eye SVG */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={s.icon}
        aria-hidden
      >
        <g
          style={{
            animation: "sw-blink 4s ease-in-out infinite",
            transformOrigin: "center 50%",
          }}
        >
          <path d="M1 12C1 12 5 5 12 5s11 7 11 7" />
          <path d="M1 12C1 12 5 19 12 19s11-7 11-7" />
        </g>
        <circle
          cx="12"
          cy="12"
          r="3.5"
          style={{
            animation: "sw-pupil 3s ease-in-out infinite",
            transformOrigin: "center",
          }}
        />
        <circle
          cx="13.2"
          cy="10.8"
          r="1"
          fill="currentColor"
          stroke="none"
          opacity={0.3}
        />
      </svg>

      {/* Count badge */}
      <span
        aria-live="polite"
        className={cn(
          "absolute flex items-center justify-center",
          "rounded-full px-1 border-[1.5px] border-background",
          "bg-destructive text-white font-medium leading-none",
          "transition-all duration-300",
          s.badge,
          visible
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none",
        )}
      >
        <span
          key={animKey}
          style={{
            animation: "sw-count-pop 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {formatted}
        </span>
      </span>
    </button>
  );
}
