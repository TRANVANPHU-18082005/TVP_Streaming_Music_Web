import { memo, useMemo, type FC } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// 1. EQUALIZER BARS (Cột nhảy truyền thống)
// ─────────────────────────────────────────────────────────────────────────────
export const EqualizerBars = memo(
  ({
    active = true,
    bars = 8,
    color = "primary",
  }: {
    active?: boolean;
    bars?: number;
    color: string;
  }) => (
    <div
      aria-hidden="true"
      className={cn(
        "eq-bars shrink-0 flex items-end gap-[2px] h-4",
        !active && "paused opacity-40",
        "transition-opacity duration-300",
      )}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn("eq-bar w-[3px] rounded-full sw-animate-eq")}
          style={{ animationDelay: `${i * 0.12}s`, backgroundColor: color }}
        />
      ))}
    </div>
  ),
);
EqualizerBars.displayName = "EqualizerBars";

// ─────────────────────────────────────────────────────────────────────────────
// 2. WAVEFORM BARS (Sóng mảnh cho mini player/track row)
// ─────────────────────────────────────────────────────────────────────────────
export const WaveformBars = memo(
  ({
    color = "primary",
    active,
    bars = 5,
  }: {
    color?: string;
    active: boolean;
    bars?: number;
  }) => (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center gap-[2px] shrink-0 h-[14px]",
        !active && "opacity-30",
        "transition-opacity duration-300",
      )}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full",
            active ? "sw-animate-wave" : "h-[3px]",
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            height: active ? "100%" : "3px",
            backgroundColor: active ? color : "var(--muted)",
          }}
        />
      ))}
    </div>
  ),
);
WaveformBars.displayName = "WaveformBars";

// ─────────────────────────────────────────────────────────────────────────────
// 3. REAL WAVEFORM (Dải sóng rộng cho màn hình Now Playing)
// ─────────────────────────────────────────────────────────────────────────────
export const RealWaveform = memo(
  ({
    active = true,
    lines = 5,
    color = "primary",
  }: {
    active?: boolean;
    lines?: number;
    color?: string;
  }) => (
    <div
      className={cn(
        "flex items-center gap-[3px] shrink-0 h-8",
        !active && "opacity-30 grayscale",
        "transition-all duration-500",
      )}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full", active && "sw-animate-wave")}
          style={{
            height: `${20 + Math.random() * 80}%`,
            animationDelay: `${i * 0.05}s`,
            animationDuration: "0.8s",
            backgroundColor: active ? color : "var(--muted)",
          }}
        />
      ))}
    </div>
  ),
);
RealWaveform.displayName = "RealWaveform";

// ─────────────────────────────────────────────────────────────────────────────
// 4. VU METER (Cột đo âm lượng cổ điển)
// ─────────────────────────────────────────────────────────────────────────────
export const VUMeter = memo(
  ({
    active = true,
    bars = 12,
    color = "primary",
  }: {
    active?: boolean;
    bars?: number;
    color?: string;
  }) => (
    <div
      className={cn(
        "flex flex-col gap-[2px] w-4 h-20 justify-end items-center",
        !active && "opacity-30",
        "transition-opacity duration-300",
      )}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-full h-1 rounded-sm transition-colors duration-200",
            active
              ? i < 3
                ? "bg-error"
                : i < 6
                  ? "bg-warning"
                  : "bg-success"
              : "bg-muted",
          )}
          style={{
            opacity: active ? (Math.random() > 0.3 ? 1 : 0.2) : 1,
            transitionDelay: `${(bars - i) * 50}ms`,
            backgroundColor: active ? color : "var(--muted)",
          }}
        />
      ))}
    </div>
  ),
);
VUMeter.displayName = "VUMeter";

// ─────────────────────────────────────────────────────────────────────────────
// 5. VINYL DISC (Đĩa than xoay)
// ─────────────────────────────────────────────────────────────────────────────
export const VinylDisc = memo(
  ({
    active = true,
    size = 64,
    slow = false,
    color = "primary",
  }: {
    active?: boolean;
    size?: number;
    slow?: boolean;
    color?: string;
  }) => (
    <div
      className={cn(
        "vinyl-disc relative shrink-0 rounded-full border-4 border-black shadow-2xl",
        "bg-[conic-gradient(from_0deg,#111_0%,#333_25%,#111_50%,#333_75%,#111_100%)]",
        active
          ? slow
            ? "animate-[spin_8s_linear_infinite]"
            : "animate-[spin_3s_linear_infinite]"
          : "paused",
      )}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {/* Center Label */}
      <div className="absolute inset-[32%] rounded-full bg-primary/20 border border-white/10 flex items-center justify-center">
        <div className="size-2 rounded-full bg-white/80 shadow-[0_0_8px_white]" />
      </div>
      {/* Grooves texture */}
      <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,transparent_0,transparent_2px,rgba(255,255,255,0.03)_3px)]" />
    </div>
  ),
);
VinylDisc.displayName = "VinylDisc";

// ─────────────────────────────────────────────────────────────────────────────
// 6. PREMIUM MUSIC VISUALIZER (MỚI - Dựa trên WaveformLoader)
// ─────────────────────────────────────────────────────────────────────────────
interface PremiumVisualizerProps {
  active?: boolean;
  size?: "sm" | "md" | "lg";
  barCount?: number;
  colorVariant?: "brand" | "spectrum";
  className?: string;
  color?: string; // Cho phép tùy chỉnh màu sắc trực tiếp
}

const PREM_SIZE_MAP = {
  sm: { w: 2, h: 16, gap: 2 },
  md: { w: 3, h: 28, gap: 3 },
  lg: { w: 4, h: 48, gap: 4 },
};

export const PremiumMusicVisualizer: FC<PremiumVisualizerProps> = memo(
  ({
    active = true,
    size = "md",
    barCount = 14,
    colorVariant = "brand",
    className,
    color = "hsl(var(--primary))",
  }) => {
    const { w, h, gap } = PREM_SIZE_MAP[size];

    // Tạo phong cách hình chuông (đối xứng) cho các cột
    const heights = useMemo(() => {
      const mid = Math.floor(barCount / 2);
      return Array.from({ length: barCount }).map((_, i) => {
        const dist = Math.abs(i - mid);
        const factor = 1 - dist / (barCount / 1.5);
        return Math.max(0.2, factor * (0.6 + Math.random() * 0.4));
      });
    }, [barCount]);

    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center",
          !active && "opacity-40",
          className,
        )}
        style={{ height: h, gap }}
      >
        {heights.map((heightFactor, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full transition-all duration-500",
              active && "sw-animate-wave",
            )}
            style={{
              width: w,
              height: active ? h * heightFactor : 3,
              background:
                colorVariant === "brand"
                  ? `linear-gradient(to top, hsl(var(--primary)), hsl(var(--wave-2)))`
                  : `hsl(var(--wave-${(i % 5) + 1}))`,
              animationDelay: `${i * 0.1}s`,
              transformOrigin: "center",
              backgroundColor: active ? color : "var(--muted)",
            }}
          />
        ))}
      </div>
    );
  },
);
PremiumMusicVisualizer.displayName = "PremiumMusicVisualizer";
